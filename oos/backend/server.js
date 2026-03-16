// Load environment variables
require('dotenv').config();

// Import dependencies
const express = require('express');
const cors = require('cors');

// Import routes
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const authRoutes = require('./routes/authRoutes');  // ← NEW

// Initialize Express app
const app = express();

// Get port from environment or use default
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

// Enable CORS (allows frontend to access API)
// CORS Configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGIN
        //: '*',
    //credentials: true
    :'*'
};
app.use(cors(corsOptions));

// Parse JSON request bodies
app.use(express.json());

// Log incoming requests (helpful for debugging)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ==========================================
// ROUTES
// ==========================================

// Health check endpoint (public)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'La API de la panadería está funcionando',
        timestamp: new Date().toISOString()
    });
});

// Authentication routes (public)
app.use('/api/auth', authRoutes);  // ← NEW

// Product routes (public - customers need access)
app.use('/api/products', productRoutes);

// Order routes (mixed - customer order creation is public, admin management is protected)
app.use('/api/orders', orderRoutes);

const printJobRoutes = require('./routes/printJobRoutes');
app.use('/api/print-job', printJobRoutes);

// Handle 404 - Route not found
app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        message: `No se puede ${req.method} ${req.path}`,
        available_routes: [
            'GET /api/health',
            'POST /api/auth/login',          // ← NEW
            'POST /api/auth/logout',         // ← NEW
            'GET /api/auth/verify',          // ← NEW
            'GET /api/auth/status',          // ← NEW
            'GET /api/products',
            'GET /api/products/:id',
            'POST /api/orders',
            'GET /api/orders',
            'GET /api/orders/:id',
            'PATCH /api/orders/:id/status'
        ]
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Algo salió mal en el servidor'
    });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
    console.log('\n🎂 ========================================');
    console.log('   BAKERY ORDERING SYSTEM API');
    console.log('   ========================================');
    console.log(`   Status: ✅ Running`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log('   ========================================');
    console.log('\n   📋 Available Endpoints:');
    console.log(`   GET    http://localhost:${PORT}/api/health`);
    console.log(`   POST   http://localhost:${PORT}/api/auth/login`);        // ← NEW
    console.log(`   POST   http://localhost:${PORT}/api/auth/logout`);       // ← NEW
    console.log(`   GET    http://localhost:${PORT}/api/auth/verify`);       // ← NEW
    console.log(`   GET    http://localhost:${PORT}/api/auth/status`);       // ← NEW
    console.log(`   GET    http://localhost:${PORT}/api/products`);
    console.log(`   GET    http://localhost:${PORT}/api/products/:id`);
    console.log(`   POST   http://localhost:${PORT}/api/orders`);
    console.log(`   GET    http://localhost:${PORT}/api/orders`);
    console.log(`   GET    http://localhost:${PORT}/api/orders/:id`);
    console.log(`   PATCH  http://localhost:${PORT}/api/orders/:id/status`);
    console.log('   ========================================\n');
    console.log('   Press Ctrl+C to stop the server\n');
});
