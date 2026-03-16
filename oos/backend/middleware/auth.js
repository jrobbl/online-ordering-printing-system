// ============================================
// AUTHENTICATION MIDDLEWARE
// Verifies JWT tokens for protected routes
// ============================================

const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token
 * Protects admin-only routes
 */
function authenticateToken(req, res, next) {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    // Check if token exists
    if (!token) {
        return res.status(401).json({
            error: 'Acceso denegado',
            message: 'Se requiere un token de autenticación'
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Add user info to request object
        req.user = decoded;

        // Log successful authentication (optional)
        console.log('✅ Authenticated request from:', decoded.username);

        // Continue to next middleware/route handler
        next();

    } catch (error) {
        // Token is invalid or expired
        console.log('❌ Authentication failed:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expirado',
                message: 'Tu sesión ha expirado. Por favor inicia sesión de nuevo.'
            });
        }

        return res.status(403).json({
            error: 'Token inválido',
            message: 'El token de autenticación es inválido'
        });
    }
}

/**
 * Optional middleware for routes that can work with or without auth
 * Sets req.user if token is valid, but doesn't reject if missing
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // No token provided, continue without authentication
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
    } catch (error) {
        // Invalid token, but don't reject - just continue without auth
        req.user = null;
    }

    next();
}

// Export middleware functions
module.exports = {
    authenticateToken,
    optionalAuth
};
