const pool = require('../config/database');

/**
 * Create 2 print jobs (customer + store copy) for an order.
 * Idempotent: if jobs already exist for the order, returns them without inserting.
 * @param {number} orderId
 * @returns {{ jobs: Array, alreadyPrinted: boolean }}
 */
async function createJobsForOrder(orderId) {
    // Check if jobs already exist
    const existing = await pool.query(
        'SELECT * FROM print_jobs WHERE order_id = $1',
        [orderId]
    );

    if (existing.rows.length > 0) {
        return { jobs: existing.rows, alreadyPrinted: true };
    }

    const result = await pool.query(
        `INSERT INTO print_jobs (order_id, copy_type)
         VALUES ($1, 'customer'), ($1, 'store')
         RETURNING *`,
        [orderId]
    );

    return { jobs: result.rows, alreadyPrinted: false };
}

/**
 * Find all orders from the last N minutes that have no print jobs yet,
 * and create 2 jobs for each.
 * @param {number} minutes
 * @returns {number} count of orders queued
 */
async function createJobsForRecentOrders(minutes) {
    const result = await pool.query(
        `SELECT o.order_id
         FROM orders o
         LEFT JOIN print_jobs pj ON pj.order_id = o.order_id
         WHERE o.order_date >= NOW() - ($1 || ' minutes')::INTERVAL
           AND pj.id IS NULL`,
        [minutes]
    );

    const orderIds = result.rows.map(r => r.order_id);
    for (const orderId of orderIds) {
        await createJobsForOrder(orderId);
    }

    return orderIds.length;
}

/**
 * Get the oldest pending print job with full order data.
 * Used by the Raspberry Pi poller.
 * @returns {Object|null}
 */
async function getPendingJob() {
    const result = await pool.query(
        `SELECT pj.id, pj.order_id, pj.copy_type, pj.created_at,
                o.customer_name, o.customer_branch, o.order_date,
                json_agg(json_build_object(
                    'name', p.product_name,
                    'qty', oi.quantity,
                    'price', oi.unit_price::float
                ) ORDER BY oi.item_id) AS items
         FROM print_jobs pj
         JOIN orders o ON pj.order_id = o.order_id
         JOIN order_items oi ON oi.order_id = o.order_id
         JOIN products p ON p.product_id = oi.product_id
         WHERE pj.status = 'pending' AND pj.printed_at IS NULL
         GROUP BY pj.id, pj.order_id, pj.copy_type, pj.created_at,
                  o.customer_name, o.customer_branch, o.order_date
         ORDER BY pj.created_at ASC
         LIMIT 1`
    );

    return result.rows[0] || null;
}

/**
 * Mark a print job as done.
 * @param {number} id
 * @returns {Object|null}
 */
async function markJobDone(id) {
    const result = await pool.query(
        `UPDATE print_jobs
         SET status = 'done', printed_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
    );

    return result.rows[0] || null;
}

module.exports = {
    createJobsForOrder,
    createJobsForRecentOrders,
    getPendingJob,
    markJobDone,
};
