// Import Express Router
const express = require('express');
const router = express.Router();

// Import product model
const productModel = require('../models/productModel');

/**
 * GET /api/products
 * Get all products
 */
router.get('/', async (req, res) => {
    try {
        const products = await productModel.getAllProducts();

        // Convert price from string to number for JSON response
        const formattedProducts = products.map(product => ({
            ...product,
            price: parseFloat(product.price)
        }));

        res.status(200).json(formattedProducts);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            error: 'No se pudieron obtener los productos',
            message: 'Ocurrió un error interno del servidor'
        });
    }
});

/**
 * GET /api/products/:id
 * Get a single product by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const productId = parseInt(req.params.id);

        // Validate ID is a number
        if (isNaN(productId)) {
            return res.status(400).json({
                error: 'ID de producto inválido',
                message: 'El ID del producto debe ser un número'
            });
        }

        const product = await productModel.getProductById(productId);

        // Check if product exists
        if (!product) {
            return res.status(404).json({
                error: 'Producto no encontrado',
                message: `No se encontró un producto con el ID ${productId}`
            });
        }

        // Convert price to number
        const formattedProduct = {
            ...product,
            price: parseFloat(product.price)
        };

        res.status(200).json(formattedProduct);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({
            error: 'No se pudo obtener el producto',
            message: 'Ocurrió un error interno del servidor'
        });
    }
});

// Export router
module.exports = router;
