const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: 'Access denied',
            message: 'Authentication token required'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        console.log('✅ Authenticated request from:', decoded.username);
        next();

    } catch (error) {
        console.log('❌ Authentication failed:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired',
                message: 'Your session has expired, please log in again'
            });
        }

        return res.status(403).json({
            error: 'Invalid token',
            message: 'Authentication token is invalid'
        });
    }
}

module.exports = { authenticateToken };
