// Import database pool
const pool = require('../config/database');

/**
 * Create a new order with items
 * Uses a transaction to ensure data consistency
 * @param {Object} orderData - Order information
 * @param {string} orderData.customer_name - Customer's name
 * @param {string} orderData.customer_phone - Customer's phone number
 * @param {string} orderData.customer_email - Customer's email address
 * @param {string} orderData.notes - Optional order notes
 * @param {Array} orderData.items - Array of items [{product_id, quantity}, ...]
 * @returns {Promise<Object>} Created order with order_id and total_amount
 */
async function createOrder(orderData) {
    const { customer_name, customer_branch, customer_phone, customer_email, notes, items } = orderData;

    // Start a database transaction
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Step 1: Get current prices for all products
        const productIds = items.map(item => item.product_id);
        const productsResult = await client.query(
            'SELECT product_id, product_name, price FROM products WHERE product_id = ANY($1)',
            [productIds]
        );

        // Create a map for quick price lookup
        const productMap = {};
        productsResult.rows.forEach(product => {
            productMap[product.product_id] = {
                name: product.product_name,
                price: parseFloat(product.price)
            };
        });

        // Step 2: Validate all products exist
        const missingProducts = items.filter(item => !productMap[item.product_id]);
        if (missingProducts.length > 0) {
            throw new Error(`Products not found: ${missingProducts.map(i => i.product_id).join(', ')}`);
        }

        // Step 3: Calculate total amount
        let totalAmount = 0;
        items.forEach(item => {
            const price = productMap[item.product_id].price;
            totalAmount += price * item.quantity;
        });

        // Step 4: Insert into orders table
        const orderResult = await client.query(
            `INSERT INTO orders (customer_name, customer_branch, customer_phone, customer_email, total_amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING order_id, order_date, status`,
            [customer_name, customer_branch, customer_phone || null, customer_email || null, totalAmount, notes || null]
        );

        const order = orderResult.rows[0];

        // Step 5: Insert into order_items table
        for (const item of items) {
            const unitPrice = productMap[item.product_id].price;
            await client.query(
                `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
                [order.order_id, item.product_id, item.quantity, unitPrice]
            );
        }

        // Commit transaction
        await client.query('COMMIT');

        // Return order summary
        return {
            order_id: order.order_id,
            customer_name,
            customer_branch,
            customer_phone: customer_phone || null,
            customer_email: customer_email || null,
            order_date: order.order_date,
            total_amount: totalAmount,
            status: order.status,
            items: items.map(item => ({
                product_id: item.product_id,
                product_name: productMap[item.product_id].name,
                quantity: item.quantity,
                unit_price: productMap[item.product_id].price
            }))
        };

    } catch (error) {
        // Rollback transaction on error
        await client.query('ROLLBACK');
        console.error('Error in createOrder:', error);
        throw error;
    } finally {
        // Release client back to pool
        client.release();
    }
}

/**
 * Get order by ID with all items
 * @param {number} orderId - The order ID
 * @returns {Promise<Object|null>} Order object with items or null if not found
 */
async function getOrderById(orderId) {
    try {
        // Get order details
        const orderResult = await pool.query(
            `SELECT order_id, customer_name, customer_branch, customer_phone, customer_email,
              order_date, total_amount, status, notes
       FROM orders
       WHERE order_id = $1`,
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            return null;
        }

        const order = orderResult.rows[0];

        // Get order items with product details
        const itemsResult = await pool.query(
            `SELECT oi.item_id, oi.product_id, oi.quantity, oi.unit_price,
              p.product_name
       FROM order_items oi
       JOIN products p ON oi.product_id = p.product_id
       WHERE oi.order_id = $1
       ORDER BY oi.item_id`,
            [orderId]
        );

        // Format response
        return {
            order_id: order.order_id,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            customer_email: order.customer_email,
            order_date: order.order_date,
            total_amount: parseFloat(order.total_amount),
            status: order.status,
            notes: order.notes,
            items: itemsResult.rows.map(item => ({
                item_id: item.item_id,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: parseFloat(item.unit_price),
                subtotal: item.quantity * parseFloat(item.unit_price)
            }))
        };

    } catch (error) {
        console.error('Error in getOrderById:', error);
        throw error;
    }
}

/**
 * Get all orders (for admin dashboard)
 * @param {Object} filters - Optional filters
 * @param {string} filters.status - Filter by status (pending/completed/cancelled)
 * @returns {Promise<Array>} Array of order objects
 */
async function getAllOrders(filters = {}) {
    try {
        let query = `
      SELECT o.order_id, o.customer_name, o.customer_branch, o.customer_phone, o.customer_email,
             o.order_date, o.total_amount, o.status,
             CASE WHEN COUNT(pj.id) > 0 THEN true ELSE false END AS has_print_jobs
      FROM orders o
      LEFT JOIN print_jobs pj ON pj.order_id = o.order_id
    `;

        const params = [];

        // Add status filter if provided
        if (filters.status) {
            query += ' WHERE o.status = $1';
            params.push(filters.status);
        }

        query += ' GROUP BY o.order_id ORDER BY o.order_date DESC';

        const result = await pool.query(query, params);

        return result.rows.map(order => ({
            ...order,
            total_amount: parseFloat(order.total_amount)
        }));

    } catch (error) {
        console.error('Error in getAllOrders:', error);
        throw error;
    }
}

/**
 * Update order status
 * @param {number} orderId - The order ID
 * @param {string} status - New status (pending/completed/cancelled)
 * @returns {Promise<Object>} Updated order
 */
async function updateOrderStatus(orderId, status) {
    try {
        // Validate status
        const validStatuses = ['pending', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        const result = await pool.query(
            `UPDATE orders 
       SET status = $1 
       WHERE order_id = $2
       RETURNING order_id, status`,
            [status, orderId]
        );

        if (result.rows.length === 0) {
            throw new Error(`Order ${orderId} not found`);
        }

        return result.rows[0];

    } catch (error) {
        console.error('Error in updateOrderStatus:', error);
        throw error;
    }
}

// Export all functions
module.exports = {
    createOrder,
    getOrderById,
    getAllOrders,
    updateOrderStatus
};