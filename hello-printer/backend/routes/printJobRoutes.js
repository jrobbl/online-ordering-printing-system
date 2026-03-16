const express = require('express');
const router = express.Router();
const { createJob, getPendingJob, markJobDone } = require('../models/printJobModel');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/print-job
 * Creates a new print job
 * Called by the admin page when the Print button is clicked
 * PROTECTED - requires valid JWT token
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const job = await createJob();

        res.status(201).json({
            success: true,
            message: 'Print job created successfully',
            job: job
        });

    } catch (error) {
        console.error('Error creating print job:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Could not create print job'
        });
    }
});

/**
 * GET /api/print-job/pending
 * Returns the oldest pending unprinted job
 * Called by the Raspberry Pi every 3 seconds
 * PROTECTED - requires valid JWT token
 */
router.get('/pending', authenticateToken, async (req, res) => {
    try {
        const job = await getPendingJob();

        res.status(200).json({
            success: true,
            job: job
        });

    } catch (error) {
        console.error('Error fetching pending job:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Could not fetch pending job'
        });
    }
});

/**
 * PATCH /api/print-job/:id/done
 * Marks a job as done and sets printed_at timestamp
 * Called by the Raspberry Pi after successfully printing
 * PROTECTED - requires valid JWT token
 */
router.patch('/:id/done', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                error: 'Invalid ID',
                message: 'Job ID must be a positive integer'
            });
        }

        const job = await markJobDone(id);

        if (!job) {
            return res.status(404).json({
                error: 'Job not found',
                message: `No pending job found with ID ${id}`
            });
        }

        res.status(200).json({
            success: true,
            message: 'Job marked as done',
            job: job
        });

    } catch (error) {
        console.error('Error marking job as done:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Could not mark job as done'
        });
    }
});

module.exports = router;
