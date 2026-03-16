const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
    createJobsForOrder,
    createJobsForRecentOrders,
    getPendingJob,
    markJobDone,
} = require('../models/printJobModel');

// POST /api/print-job/order/:id — queue 2 print jobs for a single order
router.post('/order/:id', authenticateToken, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId)) {
            return res.status(400).json({ error: 'ID de pedido inválido' });
        }

        const { jobs, alreadyPrinted } = await createJobsForOrder(orderId);
        res.status(201).json({ jobs, alreadyPrinted });
    } catch (error) {
        console.error('Error in POST /print-job/order/:id:', error);
        res.status(500).json({ error: 'Error al crear trabajos de impresión' });
    }
});

// POST /api/print-job/recent — queue jobs for all recent unprinted orders
router.post('/recent', authenticateToken, async (req, res) => {
    try {
        const minutes = parseInt(process.env.RECENT_ORDER_MINUTES) || 30;
        const queued = await createJobsForRecentOrders(minutes);
        res.status(201).json({ queued });
    } catch (error) {
        console.error('Error in POST /print-job/recent:', error);
        res.status(500).json({ error: 'Error al encolar pedidos recientes' });
    }
});

// GET /api/print-job/pending — oldest pending job with full order data (for Pi)
router.get('/pending', authenticateToken, async (req, res) => {
    try {
        const job = await getPendingJob();
        res.json({ job: job || null });
    } catch (error) {
        console.error('Error in GET /print-job/pending:', error);
        res.status(500).json({ error: 'Error al obtener trabajo pendiente' });
    }
});

// PATCH /api/print-job/:id/done — mark a job as done (for Pi)
router.patch('/:id/done', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID de trabajo inválido' });
        }

        const job = await markJobDone(id);
        if (!job) {
            return res.status(404).json({ error: 'Trabajo de impresión no encontrado' });
        }

        res.json({ job });
    } catch (error) {
        console.error('Error in PATCH /print-job/:id/done:', error);
        res.status(500).json({ error: 'Error al marcar trabajo como terminado' });
    }
});

module.exports = router;
