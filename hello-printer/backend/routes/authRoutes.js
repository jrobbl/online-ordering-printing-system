const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { verifyAdminCredentials } = require('../models/adminModel');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Missing credentials',
                message: 'Username and password are required'
            });
        }

        const isValid = await verifyAdminCredentials(username, password);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
                message: 'Username or password is incorrect'
            });
        }

        const token = jwt.sign(
            { admin: true, username: username },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token: token,
            username: username,
            expiresIn: '8h'
        });

    } catch (error) {
        console.error('Error in login route:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticateToken, (req, res) => {
    console.log('🚪 Admin logged out:', req.user.username);
    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
});

/**
 * GET /api/auth/verify
 */
router.get('/verify', authenticateToken, (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Token is valid',
        user: {
            username: req.user.username,
            admin: req.user.admin
        }
    });
});

module.exports = router;
