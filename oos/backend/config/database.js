// Load environment variables
require('dotenv').config();

// Import PostgreSQL Pool
const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// Test connection on startup
pool.on('connect', () => {
    console.log('✅ Database connected successfully');
});

// Handle connection errors
pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
    process.exit(-1);
});

// Export pool for use in other files
module.exports = pool;