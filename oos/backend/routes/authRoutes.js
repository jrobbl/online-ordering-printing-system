// ============================================
// AUTHENTICATION ROUTES
// Login, logout, and token verification
// ============================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { verifyAdminCredentials, getAdminUsername } = require('../models/adminModel');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Admin login - verify credentials and return JWT token
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Credenciales faltantes',
                message: 'El usuario y la contraseña son obligatorios'
            });
        }

        // Verify credentials
        const isValid = await verifyAdminCredentials(username, password);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Credenciales inválidas',
                message: 'Usuario o contraseña incorrectos'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                admin: true,
                username: username
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }  // Token expires in 8 hours
        );

        // Return success with token
        res.status(200).json({
            success: true,
            message: 'Inicio de sesión exitoso',
            token: token,
            username: username,
            expiresIn: '8h'
        });

    } catch (error) {
        console.error('Error in login route:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            message: 'Ocurrió un error durante el inicio de sesión'
        });
    }
});

/**
 * POST /api/auth/logout
 * Admin logout - client-side token invalidation
 * (Server doesn't track tokens, so this is informational only)
 */
router.post('/logout', authenticateToken, (req, res) => {
    // In JWT-based auth, logout is handled client-side by removing the token
    // This endpoint exists for consistency and to confirm the action

    console.log('🚪 Admin logged out:', req.user.username);

    res.status(200).json({
        success: true,
        message: 'Cierre de sesión exitoso'
    });
});

/**
 * GET /api/auth/verify
 * Verify if current token is valid
 * Requires authentication (token must be valid to access)
 */
router.get('/verify', authenticateToken, (req, res) => {
    // If we reach here, token is valid (authenticateToken middleware passed)

    res.status(200).json({
        success: true,
        message: 'El token es válido',
        user: {
            username: req.user.username,
            admin: req.user.admin
        }
    });
});

/**
 * GET /api/auth/status
 * Check authentication status without requiring a token
 * Returns info about whether user is authenticated
 */
router.get('/status', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(200).json({
            authenticated: false,
            message: 'No se proporcionó un token'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.status(200).json({
            authenticated: true,
            username: decoded.username
        });
    } catch (error) {
        res.status(200).json({
            authenticated: false,
            message: 'Token inválido o expirado'
        });
    }
});

// Export router
module.exports = router;
