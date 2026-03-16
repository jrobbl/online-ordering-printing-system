require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const printJobRoutes = require('./routes/printJobRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// ==========================================
// ROUTES
// ==========================================

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Hello Printer API is running',
        timestamp: new Date().toISOString()
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/print-job', printJobRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.path}`,
        available_routes: [
            'GET  /api/health',
            'POST /api/auth/login',
            'POST /api/auth/logout',
            'GET  /api/auth/verify',
            'POST /api/print-job',
            'GET  /api/print-job/pending',
            'PATCH /api/print-job/:id/done'
        ]
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error'
    });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
    console.log('\n🖨️  ========================================');
    console.log('   HELLO PRINTER API');
    console.log('   ========================================');
    console.log(`   Status: ✅ Running`);
    console.log(`   Port:   ${PORT}`);
    console.log(`   Env:    ${process.env.NODE_ENV || 'development'}`);
    console.log('   ========================================');
    console.log(`\n   GET   http://localhost:${PORT}/api/health`);
    console.log(`   POST  http://localhost:${PORT}/api/auth/login`);
    console.log(`   POST  http://localhost:${PORT}/api/auth/logout`);
    console.log(`   GET   http://localhost:${PORT}/api/auth/verify`);
    console.log(`   POST  http://localhost:${PORT}/api/print-job`);
    console.log(`   GET   http://localhost:${PORT}/api/print-job/pending`);
    console.log(`   PATCH http://localhost:${PORT}/api/print-job/:id/done`);
    console.log('\n========================================\n');
});