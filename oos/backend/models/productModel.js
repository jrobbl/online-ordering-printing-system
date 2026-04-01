// Import database pool
const pool = require('../config/database');

/**
 * Get all products from the database
 * @returns {Promise<Array>} Array of product objects
 */
async function getAllProducts() {
    try {
        const result = await pool.query(
            'SELECT product_id, product_name, price, category, created_at FROM products ORDER BY category, product_name'
        );
        return result.rows;
    } catch (error) {
        console.error('Error in getAllProducts:', error);
        throw error;
    }
}

/**
 * Get a single product by ID
 * @param {number} productId - The product ID
 * @returns {Promise<Object|null>} Product object or null if not found
 */
async function getProductById(productId) {
    try {
        const result = await pool.query(
            'SELECT product_id, product_name, price, created_at FROM products WHERE product_id = $1',
            [productId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error in getProductById:', error);
        throw error;
    }
}

/**
 * Get multiple products by their IDs
 * @param {Array<number>} productIds - Array of product IDs
 * @returns {Promise<Array>} Array of product objects
 */
async function getProductsByIds(productIds) {
    try {
        const result = await pool.query(
            'SELECT product_id, product_name, price FROM products WHERE product_id = ANY($1)',
            [productIds]
        );
        return result.rows;
    } catch (error) {
        console.error('Error in getProductsByIds:', error);
        throw error;
    }
}

/**
 * Check if a product exists
 * @param {number} productId - The product ID
 * @returns {Promise<boolean>} True if product exists, false otherwise
 */
async function productExists(productId) {
    try {
        const result = await pool.query(
            'SELECT EXISTS(SELECT 1 FROM products WHERE product_id = $1)',
            [productId]
        );
        return result.rows[0].exists;
    } catch (error) {
        console.error('Error in productExists:', error);
        throw error;
    }
}

// Export all functions
module.exports = {
    getAllProducts,
    getProductById,
    getProductsByIds,
    productExists
};