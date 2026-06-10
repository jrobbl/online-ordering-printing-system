const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const pool = require('../config/database');

router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT product_id, product_name, category, active FROM products ORDER BY category, product_name'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching admin products:', err);
        res.status(500).json({ error: 'No se pudieron obtener los productos' });
    }
});

router.post('/', authenticateToken, async (req, res) => {
    const { product_name, category } = req.body;
    if (!product_name || !category) {
        return res.status(400).json({ error: 'Nombre y categoría son requeridos' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO products (product_name, price, category) VALUES ($1, 0.00, $2) RETURNING product_id, product_name, category, active',
            [product_name.trim(), category]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating product:', err);
        res.status(500).json({ error: 'No se pudo crear el producto' });
    }
});

router.patch('/:id', authenticateToken, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { product_name, category, active } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (product_name !== undefined) { fields.push(`product_name = $${idx++}`); values.push(product_name.trim()); }
    if (category !== undefined)     { fields.push(`category = $${idx++}`);     values.push(category); }
    if (active !== undefined)       { fields.push(`active = $${idx++}`);       values.push(active); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    values.push(id);
    try {
        const result = await pool.query(
            `UPDATE products SET ${fields.join(', ')} WHERE product_id = $${idx} RETURNING product_id, product_name, category, active`,
            values
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating product:', err);
        res.status(500).json({ error: 'No se pudo actualizar el producto' });
    }
});

module.exports = router;
