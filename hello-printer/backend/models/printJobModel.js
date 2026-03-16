const pool = require('../config/database');

/**
 * Create a new print job
 * Called when the admin clicks the Print button
 * @returns {Promise<Object>} The created job
 */
async function createJob() {
    try {
        const result = await pool.query(
            `INSERT INTO print_jobs (status)
             VALUES ('pending')
             RETURNING id, status, created_at`
        );

        return result.rows[0];

    } catch (error) {
        console.error('Error in createJob:', error);
        throw error;
    }
}

/**
 * Get the oldest pending job that has not been printed yet
 * Called by the Raspberry Pi every 3 seconds
 * @returns {Promise<Object|null>} The oldest pending job or null if none
 */
async function getPendingJob() {
    try {
        const result = await pool.query(
            `SELECT id, status, created_at
             FROM print_jobs
             WHERE status = 'pending'
               AND printed_at IS NULL
             ORDER BY created_at ASC
             LIMIT 1`
        );

        return result.rows[0] || null;

    } catch (error) {
        console.error('Error in getPendingJob:', error);
        throw error;
    }
}

/**
 * Mark a job as done by setting printed_at to now
 * Called by the Raspberry Pi after successfully printing
 * @param {number} id - The job ID to mark as done
 * @returns {Promise<Object|null>} The updated job or null if not found
 */
async function markJobDone(id) {
    try {
        const result = await pool.query(
            `UPDATE print_jobs
             SET status = 'done',
                 printed_at = NOW()
             WHERE id = $1
               AND printed_at IS NULL
             RETURNING id, status, created_at, printed_at`,
            [id]
        );

        return result.rows[0] || null;

    } catch (error) {
        console.error('Error in markJobDone:', error);
        throw error;
    }
}

module.exports = {
    createJob,
    getPendingJob,
    markJobDone
};
