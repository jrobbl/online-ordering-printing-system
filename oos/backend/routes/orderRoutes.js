const express = require('express');
const router = express.Router();
const orderModel = require('../models/orderModel');
const { createJobsForOrder } = require('../models/printJobModel');
const validateOrderingTime = require('../middleware/validateTime');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/orders
 * Create a new order (PUBLIC - customers can create orders)
 */
router.post('/', validateOrderingTime, async (req, res) => {
    try {
        const { customer_name, customer_branch, customer_phone, customer_email, notes, items } = req.body;

        // Validate required fields
        if (!customer_name || !customer_branch) {
            return res.status(400).json({
                error: 'Campos obligatorios faltantes',
                message: 'nombre y sucursal son obligatorios'
            });
        }

        // Validate items array
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                error: 'Artículos inválidos',
                message: 'Los artículos deben ser un arreglo no vacío'
            });
        }

        // Validate each item
        for (const item of items) {
            if (!Number.isInteger(item.product_id) || item.product_id <= 0) {
                return res.status(400).json({
                    error: 'product_id inválido',
                    message: 'Cada artículo debe tener un product_id entero positivo válido'
                });
            }

            if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
                return res.status(400).json({
                    error: 'Cantidad inválida',
                    message: 'Cada artículo debe tener una cantidad entera positiva válida'
                });
            }
        }

        // Create order
        const order = await orderModel.createOrder({
            customer_name,
            customer_branch,
            customer_phone,
            customer_email,
            notes,
            items
        });

        // Auto-enqueue print jobs (fire-and-forget — never blocks the order response)
        createJobsForOrder(order.order_id).catch(err =>
            console.error('Auto-print job creation failed for order', order.order_id, err)
        );

        res.status(201).json({
            success: true,
            message: 'Pedido creado exitosamente',
            order: order
        });

    } catch (error) {
        console.error('Error creating order:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Productos no encontrados',
                message: 'Algunos productos del pedido no fueron encontrados'
            });
        }

        res.status(500).json({
            error: 'Error interno del servidor',
            message: 'No se pudo crear el pedido'
        });
    }
});

/**
 * GET /api/orders
 * Get all orders (PROTECTED - admin only)
 */
router.get('/', authenticateToken, async (req, res) => {  // ← ADDED authenticateToken
    try {
        const { status } = req.query;

        // Validate status filter if provided
        if (status && !['pending', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({
                error: 'Estado inválido',
                message: 'El estado debe ser uno de: pending, completed, cancelled'
            });
        }

        const filters = status ? { status } : {};
        const orders = await orderModel.getAllOrders(filters);

        res.status(200).json(orders);

    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            message: 'No se pudieron obtener los pedidos'
        });
    }
});

/**
 * GET /api/orders/:id
 * Get single order with items (PROTECTED - admin only)
 */
router.get('/:id', authenticateToken, async (req, res) => {  // ← ADDED authenticateToken
    try {
        const orderId = parseInt(req.params.id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                error: 'ID de pedido inválido',
                message: 'El ID del pedido debe ser un entero positivo'
            });
        }

        const order = await orderModel.getOrderById(orderId);

        if (!order) {
            return res.status(404).json({
                error: 'Pedido no encontrado',
                message: `No se encontró un pedido con el ID ${orderId}`
            });
        }

        res.status(200).json(order);

    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            message: 'No se pudo obtener el pedido'
        });
    }
});

/**
 * PATCH /api/orders/:id/status
 * Update order status (PROTECTED - admin only)
 */
router.patch('/:id/status', authenticateToken, async (req, res) => {  // ← ADDED authenticateToken
    try {
        const orderId = parseInt(req.params.id);
        const { status } = req.body;

        // Validate order ID
        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                error: 'ID de pedido inválido',
                message: 'El ID del pedido debe ser un entero positivo'
            });
        }

        // Validate status
        if (!status || !['pending', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({
                error: 'Estado inválido',
                message: 'El estado debe ser uno de: pending, completed, cancelled'
            });
        }

        const updatedOrder = await orderModel.updateOrderStatus(orderId, status);

        if (!updatedOrder) {
            return res.status(404).json({
                error: 'Pedido no encontrado',
                message: `No se encontró un pedido con el ID ${orderId}`
            });
        }

        res.status(200).json({
            success: true,
            message: `Estado del pedido actualizado a ${status}`,
            order: updatedOrder
        });

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            message: 'No se pudo actualizar el estado del pedido'
        });
    }
});

module.exports = router;
