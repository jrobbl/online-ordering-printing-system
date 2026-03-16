---
aliases:
  - OOS Project Log
  - EMMER Bakery Dev Log
tags:
  - project
  - dev-log
  - bakery
  - oos
  - emmer
created: 2026-02-14
status: in-progress
---

# EMMER Panaderia - Online Ordering System (OOS)

> Complete development log and reproduction guide for the OOS project. Contains every file, every change, every decision, and every bug found during the Claude Code-assisted development session.

## Table of Contents

- [[#Project Overview]]
- [[#Tech Stack]]
- [[#Git History]]
- [[#Session Log - Conversation Chronology]]
  - [[#Phase 1 - Project Audit]]
  - [[#Phase 2 - Test Plan Creation]]
  - [[#Phase 3 - Spanish Translation]]
  - [[#Phase 4 - Admin Dashboard Audit]]
- [[#Known Bugs and Issues]]
- [[#Complete Source Code]]
  - [[#Database Layer]]
  - [[#Backend]]
  - [[#Frontend - Customer]]
  - [[#Frontend - Admin]]
  - [[#Infrastructure]]
- [[#Reproduction Guide]]

---

## Project Overview

| Field | Value |
|---|---|
| **Project Name** | OOS (Online Ordering System) |
| **Brand** | EMMER Panaderia |
| **Purpose** | Online bakery ordering system for a Mexican local bakery |
| **Language** | UI in Spanish (es-MX), documentation/code in English |
| **Repository** | Local at `/home/jrobbl/Documents/dev/oos` |
| **AI Assistant** | Claude Opus 4.6 (via Claude Code CLI) |
| **Session Date** | 2026-02-14 |

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Runtime** | Node.js | 18+ |
| **Backend Framework** | Express.js | 5.2.1 |
| **Database** | PostgreSQL | 15 (via Docker) |
| **DB Driver** | pg (node-postgres) | 8.18.0 |
| **Auth** | JWT (jsonwebtoken) | 9.0.3 |
| **Password Hashing** | bcrypt | 6.0.0 |
| **Environment** | dotenv | 17.2.4 |
| **CORS** | cors | 2.8.6 |
| **Dev Server** | nodemon | 3.1.11 |
| **Frontend** | Vanilla HTML/CSS/JS | No framework |
| **Containerization** | Docker + Docker Compose | 3.8 |
| **Reverse Proxy** | Nginx | Alpine |

---

## Git History

```
53a6df0 initial commit: database ready
46804dd Phase 2: Backend API Done
7bbf267 phases 3 and 4 done: customer and admin frontend
88330b4 phase 5- security without frontend
a94d094 Phase 5 complete: Security and authentication
```

All changes below (translation, branding, bug identification) were made on top of commit `a94d094` and are staged but not yet committed.

---

## Session Log - Conversation Chronology

### Phase 1 - Project Audit

> **User request:** "Please, help me auditing this project. I need you to read it and give a general opinion of the app: security, cleanliness, structure and usability. Don't change anything, just give me an overall assessment."

**What was done:** Read every file in the project and produced a comprehensive audit.

**Key findings:**

> [!danger] Critical Security Issues
> - `.env` committed to git (contains DB password, JWT secret, bcrypt hashes)
> - Duplicate `.env` entries (lines 10-12 and 14-16) - `dotenv` silently uses last values
> - Hardcoded DB credentials in `database/docker-compose.yml`
> - `JWT_SECRET` generated with `Math.random()` (not cryptographically secure)
> - No rate limiting on `/api/auth/login`
> - CORS wide open: `app.use(cors())`
> - XSS in admin dashboard - `customer_name` and `customer_phone` unescaped in template literals

> [!warning] Moderate Issues
> - No token blacklist/revocation (logout is cosmetic)
> - `validateTime` mismatch: code allows until 11 PM, message says 6 PM
> - Token decoded on client with `atob` without signature verification

> [!success] Strengths
> - Clean MVC-like separation (`models/`, `routes/`, `middleware/`, `config/`, `utils/`)
> - Database transactions with proper `BEGIN`/`COMMIT`/`ROLLBACK` and `client.release()` in `finally`
> - Parameterized queries everywhere - no SQL injection risk
> - Clean, warm visual design with CSS variables
> - Good UX flow with toast notifications, loading states, error states

**Output:** Created `aux/audit-report.md`

---

### Phase 1b - Admin Dashboard Bug Diagnosis

> **User request:** "I tried to open /frontend/admin/login.html. Logged in and experienced weird behavior, no orders were listed and logout was not working. Help me figuring out the reason... create another markdown with a set of explicit explanation and test for other functionalities."

**Root cause identified:**

> [!bug] `const API_URL` Redeclaration Bug
> `auth.js:6` declares `const API_URL = 'http://localhost:3000/api'`
> `script.js:5` declares the **same** `const API_URL`
>
> Both scripts load in the same global scope via `index.html`:
> ```html
> <script src="auth.js"></script>    <!-- line 110 -->
> <script src="script.js"></script>  <!-- line 111 -->
> ```
>
> The browser throws `SyntaxError: Identifier 'API_URL' has already been declared`, **killing the entire `script.js` file**. This breaks:
> - Order fetching (`fetchOrders()`)
> - Logout button (event listener never attached)
> - Stats display (`updateStats()`)
> - Time display (`updateCurrentTime()`)
> - Auto-refresh (`setInterval` calls)
> - Filter buttons (`filterOrders()`)
>
> **Login works** because `login.html` only loads `auth.js` (single script).

**Fix applied:** Commented out line 5 of `script.js`: `//const API_URL = 'http://localhost:3000/api';`

**Output:** Created `aux/test-plan.md` with 60+ tests across 8 test suites.

---

### Phase 3 - Spanish Translation

> **User request:** "This project will serve a Mexican local bakery so every displayed text must be in Spanish. Please translate all prints and displayed text to Spanish but keep all documentation in English."

**Files modified:**

| File | Changes |
|---|---|
| `frontend/customer/index.html` | All labels, placeholders, error messages, success messages to Spanish |
| `frontend/customer/script.js` | "Agregar al Carrito", "Eliminar", "Cantidad", toast messages, error messages |
| `frontend/admin/index.html` | Dashboard labels, stats cards, filter buttons, error/empty states |
| `frontend/admin/script.js` | Added `STATUS_LABELS` and `STATUS_LABELS_LOWER` translation maps, `translateStatus()` function, changed locale to `es-MX`, all template literals translated |
| `frontend/admin/login.html` | Form labels, placeholders, button text, error messages |
| `frontend/admin/auth.js` | "Iniciando sesion...", "Iniciar Sesion", error messages |
| `backend/middleware/validateTime.js` | Error response messages, time locale to `es-MX` |
| `backend/server.js` | Health check message, 404 handler, global error handler |
| `backend/middleware/auth.js` | "Acceso denegado", "Token expirado", "Token invalido" |
| `backend/routes/authRoutes.js` | All login/logout/verify/status responses |
| `backend/routes/orderRoutes.js` | All validation errors, success messages, 404/500 responses |
| `backend/routes/productRoutes.js` | Error responses |

**XSS fix applied during translation:** Added `escapeHtml()` calls around `order.customer_name` and `order.customer_phone` in `createOrderCard()` (they were previously unescaped).

**Status translation system added to `admin/script.js`:**

```javascript
const STATUS_LABELS = {
    'pending': 'PENDIENTE',
    'completed': 'COMPLETADO',
    'cancelled': 'CANCELADO'
};

const STATUS_LABELS_LOWER = {
    'pending': 'pendiente',
    'completed': 'completado',
    'cancelled': 'cancelado'
};

function translateStatus(status) {
    return STATUS_LABELS[status] || status.toUpperCase();
}
```

**Branding changes (made by user manually):**
- Header changed from "Sweet Delights Bakery" to "EMMER Panaderia"
- Footer changed to "2026 EMMER Panaderia"
- Customer CSS comment changed to "Emmer - MAIN STYLESHEET"

---

### Phase 4 - Admin Dashboard Audit

> **User request:** "Neither the counters on top nor all orders button are working... I need an audition... create a markdown file at aux/ which all the steps first to find out the problem with counters and views and a guide to solve them manually, then tell me exactly how to remove those from displayed information (layout) but don't remove from backend computation."

**Diagnosis:**

1. **Stats counters showing 0** - Three possible causes:
   - `const API_URL` bug is back (verify line 5 of `script.js` is commented)
   - Empty database (no orders)
   - Auth token invalid, triggering redirect before counts are set

2. **"Todos los Pedidos" button not visually responding** - Missing `.btn-outline.active` CSS rule. The `active` class is toggled in JS but no CSS styles it differently.

3. **`updateStats()` double-fetch** - Makes a redundant `GET /api/orders` call every time, even though `fetchOrders()` already has the data.

4. **"Completados Hoy" label mismatch** - Counts ALL completed orders, not just today's.

**Output:** Created `aux/admin-dashboard-audit.md` with:
- Part 1: Diagnosis of all problems
- Part 2: Manual fix guides (4 fixes)
- Part 3: Step-by-step removal guide for stats cards and "Todos los Pedidos" button

---

## Known Bugs and Issues

| # | Severity | Location | Description | Status |
|---|---|---|---|---|
| 1 | **CRITICAL** | `auth.js:6` + `script.js:5` | `const API_URL` redeclaration crashes admin dashboard | Fixed (commented out in script.js) |
| 2 | **HIGH** | `admin/script.js:163,247-249` | XSS via unescaped customer data in admin UI | Fixed (added `escapeHtml()` during translation) |
| 3 | **MEDIUM** | `validateTime.js:11` | Code allows orders until 11 PM, message says 6 PM | Documented, not fixed |
| 4 | **MEDIUM** | `admin/script.js:371` | "Completados Hoy" counts ALL completed orders, not today's | Documented, not fixed |
| 5 | **MEDIUM** | `admin/styles.css` | Missing `.btn-outline.active` CSS rule for filter buttons | Documented, not fixed |
| 6 | **MEDIUM** | `admin/script.js:350-380` | `updateStats()` makes redundant API call | Documented, not fixed |
| 7 | **LOW** | `backend/.env:10-16` | Duplicate env vars; first set silently ignored | Documented, not fixed |
| 8 | **LOW** | `orderRoutes.js` | No backend email validation | Documented, not fixed |
| 9 | **LOW** | Customer frontend | Cart not persisted across page refresh | Documented, not fixed |
| 10 | **INFO** | `admin/index.html` | HTML flashes briefly before auth redirect | Documented, not fixed |
| 11 | **INFO** | `setup-admin.js:83-88` | `Math.random()` for JWT secret generation | Documented, not fixed |

---

## Complete Source Code

> [!info] File Tree
> ```
> oos/
> +-- .dockerignore
> +-- .gitignore
> +-- Dockerfile
> +-- docker-compose.yml
> +-- nginx/
> |   +-- nginx.conf
> +-- database/
> |   +-- docker-compose.yml
> |   +-- init.sql
> +-- backend/
> |   +-- .env
> |   +-- package.json
> |   +-- server.js
> |   +-- setup-admin.js
> |   +-- config/
> |   |   +-- database.js
> |   +-- middleware/
> |   |   +-- auth.js
> |   |   +-- validateTime.js
> |   +-- models/
> |   |   +-- adminModel.js
> |   |   +-- orderModel.js
> |   |   +-- productModel.js
> |   +-- routes/
> |   |   +-- authRoutes.js
> |   |   +-- orderRoutes.js
> |   |   +-- productRoutes.js
> |   +-- utils/
> |       +-- password.js
> +-- frontend/
> |   +-- customer/
> |   |   +-- index.html
> |   |   +-- script.js
> |   |   +-- styles.css
> |   +-- admin/
> |       +-- index.html
> |       +-- login.html
> |       +-- auth.js
> |       +-- script.js
> |       +-- styles.css
> +-- aux/
>     +-- add-sample-products.js
>     +-- audit-report.md
>     +-- test-plan.md
>     +-- admin-dashboard-audit.md
>     +-- project-log.md  (this file)
>     +-- test-*.js  (various ad-hoc test scripts)
> ```

---

### Database Layer

#### `database/docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: oos_postgres
    environment:
      POSTGRES_USER: oos_admin
      POSTGRES_PASSWORD: oos_secret_2024
      POSTGRES_DB: oos_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

#### `database/init.sql`

```sql
create table IF NOT EXISTS products (
	product_id SERIAL primary key,
	product_name VARCHAR(100) not null unique,
	price DECIMAL(10,2) not null check (price > 0),
	created_at TIMESTAMP default CURRENT_TIMESTAMP
);


create table orders (
	order_id SERIAL primary key ,
	customer_name VARCHAR(100) not null,
	customer_phone VARCHAR(100) not null,
	customer_email varchar(100) not null,
	order_date TIMESTAMP default CURRENT_TIMESTAMP,
	total_amount DECIMAL(10,2) not null check (total_amount > 0),
	status VARCHAR(20) default 'pending' check (status in ('pending','completed','cancelled')),
	notes TEXT
);


create table order_items (
	item_id SERIAL primary key,
	order_id INTEGER not null,
	product_id INTEGER not null,
	quantity INTEGER not null,
	unit_price DECIMAL(10,2) not null,
	foreign key (order_id) references orders(order_id) on delete cascade,
	foreign key (product_id) references products(product_id) on delete RESTRICT
);
```

> [!note] Schema Notes
> - `products` has `IF NOT EXISTS` but `orders` and `order_items` do not
> - No indexes on `orders.status` or `orders.order_date`
> - No `CHECK` constraint on `customer_email` format
> - `ON DELETE CASCADE` on order_items -> orders (delete order = delete its items)
> - `ON DELETE RESTRICT` on order_items -> products (can't delete a product that's been ordered)

#### `aux/add-sample-products.js`

```javascript
const pool = require('../backend/config/database');

async function addSampleProducts() {
    try {
        await pool.query(`
      INSERT INTO products (product_name, price) VALUES
      ('Chocolatin', 15.00),
      ('Galleta de avena', 10),
      ('Croissant', 7),
      ('Muffin', 12),
      ('Baguette', 5.00)
      ON CONFLICT (product_name) DO NOTHING
    `);

        console.log('Sample products added!');

        const result = await pool.query('SELECT * FROM products');
        console.log('\nProducts in database:');
        result.rows.forEach(p => {
            console.log(`  ${p.product_id}. ${p.product_name} - $${p.price}`);
        });

        await pool.end();
    } catch (error) {
        console.error('Error adding products:', error);
    }
}

addSampleProducts();
```

---

### Backend

#### `backend/.env`

> [!danger] This file is committed to git - it should NOT be. Contains secrets.

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=oos_db
DB_USER=oos_admin
DB_PASSWORD=oos_secret_2024
PORT=3000
NODE_ENV=development

#
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$10$A691HiI5Eox5WgekRCmur.QZkaejMDr/1GwVpwCSo.9mFwiYVSiPe
JWT_SECRET=M#2GoQdm835tfdHbgDM71%w0l!%xW1xZaP$1qOSFafjtLooa#NgpHTzdTL$Ti72p

ADMIN_USERNAME=rob
ADMIN_PASSWORD_HASH=$2b$10$GVR5AUNTlus38ampTe0gu.WpvHoJAMnzam8HF/WGqu/dCpPmFlAem
JWT_SECRET=%2B60!KmW99D8m%Jt6gPXbCr4mTnXftLjzgRD7^RW1*ne&Zd0shVL4dw7^nAMqXh
```

> [!warning] Duplicate entries
> `dotenv` uses the **last** value for each key. Active credentials: `ADMIN_USERNAME=rob`, the second password hash, and the second JWT secret. The first set (`admin`) is silently ignored.

#### `backend/package.json`

```json
{
  "name": "backend",
  "version": "1.0.0",
  "description": "Online Ordering System (OOL) backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["oos", "postgresql", "express"],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "bcrypt": "^6.0.0",
    "cors": "^2.8.6",
    "dotenv": "^17.2.4",
    "express": "^5.2.1",
    "jsonwebtoken": "^9.0.3",
    "pg": "^8.18.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.11"
  }
}
```

#### `backend/config/database.js`

```javascript
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
    console.log('Database connected successfully');
});

// Handle connection errors
pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    process.exit(-1);
});

// Export pool for use in other files
module.exports = pool;
```

#### `backend/server.js`

```javascript
// Load environment variables
require('dotenv').config();

// Import dependencies
const express = require('express');
const cors = require('cors');

// Import routes
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const authRoutes = require('./routes/authRoutes');

// Initialize Express app
const app = express();

// Get port from environment or use default
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

// Enable CORS (allows frontend to access API)
app.use(cors());

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
        message: 'La API de la panaderia esta funcionando',
        timestamp: new Date().toISOString()
    });
});

// Authentication routes (public)
app.use('/api/auth', authRoutes);

// Product routes (public - customers need access)
app.use('/api/products', productRoutes);

// Order routes (mixed - customer order creation is public, admin management is protected)
app.use('/api/orders', orderRoutes);

// Handle 404 - Route not found
app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        message: `No se puede ${req.method} ${req.path}`,
        available_routes: [
            'GET /api/health',
            'POST /api/auth/login',
            'POST /api/auth/logout',
            'GET /api/auth/verify',
            'GET /api/auth/status',
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
        message: 'Algo salio mal en el servidor'
    });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('   BAKERY ORDERING SYSTEM API');
    console.log('   ========================================');
    console.log(`   Status: Running`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log('   ========================================');
    console.log('\n   Available Endpoints:');
    console.log(`   GET    http://localhost:${PORT}/api/health`);
    console.log(`   POST   http://localhost:${PORT}/api/auth/login`);
    console.log(`   POST   http://localhost:${PORT}/api/auth/logout`);
    console.log(`   GET    http://localhost:${PORT}/api/auth/verify`);
    console.log(`   GET    http://localhost:${PORT}/api/auth/status`);
    console.log(`   GET    http://localhost:${PORT}/api/products`);
    console.log(`   GET    http://localhost:${PORT}/api/products/:id`);
    console.log(`   POST   http://localhost:${PORT}/api/orders`);
    console.log(`   GET    http://localhost:${PORT}/api/orders`);
    console.log(`   GET    http://localhost:${PORT}/api/orders/:id`);
    console.log(`   PATCH  http://localhost:${PORT}/api/orders/:id/status`);
    console.log('   ========================================\n');
    console.log('   Press Ctrl+C to stop the server\n');
});
```

#### `backend/utils/password.js`

```javascript
// ============================================
// PASSWORD UTILITIES
// Uses bcrypt for secure password hashing
// ============================================

const bcrypt = require('bcrypt');

// Number of salt rounds for bcrypt
const SALT_ROUNDS = 10;

/**
 * Hash a plain-text password
 * @param {string} plainPassword - The password to hash
 * @returns {Promise<string>} The hashed password
 */
async function hashPassword(plainPassword) {
    try {
        const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
        return hash;
    } catch (error) {
        console.error('Error hashing password:', error);
        throw new Error('Password hashing failed');
    }
}

/**
 * Verify a plain-text password against a hash
 * @param {string} plainPassword - The password to verify
 * @param {string} hashedPassword - The hash to compare against
 * @returns {Promise<boolean>} True if password matches, false otherwise
 */
async function verifyPassword(plainPassword, hashedPassword) {
    try {
        const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
        return isMatch;
    } catch (error) {
        console.error('Error verifying password:', error);
        throw new Error('Password verification failed');
    }
}

// Export functions
module.exports = {
    hashPassword,
    verifyPassword
};
```

#### `backend/setup-admin.js`

```javascript
// ============================================
// ADMIN SETUP SCRIPT
// One-time script to generate admin password hash
// Run this to set up your admin credentials
// ============================================

const readline = require('readline');
const { hashPassword } = require('./utils/password');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Prompt user for input
function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            resolve(answer);
        });
    });
}

async function setupAdmin() {
    console.log('\n========================================');
    console.log('   ADMIN CREDENTIALS SETUP');
    console.log('========================================\n');

    try {
        // Get admin username
        const username = await question('Enter admin username (default: admin): ');
        const adminUsername = username.trim() || 'admin';

        // Get admin password
        const password = await question('Enter admin password: ');

        if (!password || password.length < 8) {
            console.log('\nError: Password must be at least 8 characters long');
            rl.close();
            return;
        }

        // Confirm password
        const confirmPassword = await question('Confirm admin password: ');

        if (password !== confirmPassword) {
            console.log('\nError: Passwords do not match');
            rl.close();
            return;
        }

        console.log('\nGenerating password hash...\n');

        // Hash the password
        const passwordHash = await hashPassword(password);

        console.log('Admin credentials generated successfully!\n');
        console.log('========================================');
        console.log('   ADD THESE TO YOUR .env FILE');
        console.log('========================================\n');
        console.log('ADMIN_USERNAME=' + adminUsername);
        console.log('ADMIN_PASSWORD_HASH=' + passwordHash);
        console.log('JWT_SECRET=' + generateRandomSecret());
        console.log('\n========================================\n');
        console.log('Instructions:');
        console.log('1. Copy the lines above');
        console.log('2. Open backend/.env file');
        console.log('3. Paste these lines at the end');
        console.log('4. Save the file');
        console.log('5. Never commit .env to git!');
        console.log('\n========================================\n');

    } catch (error) {
        console.error('\nError:', error.message);
    } finally {
        rl.close();
    }
}

// Generate random secret for JWT
// WARNING: Uses Math.random() which is NOT cryptographically secure
// Should use crypto.randomBytes(64).toString('hex') instead
function generateRandomSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let secret = '';
    for (let i = 0; i < 64; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
}

// Run the setup
setupAdmin();
```

#### `backend/middleware/auth.js`

```javascript
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
            message: 'Se requiere un token de autenticacion'
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Add user info to request object
        req.user = decoded;

        // Log successful authentication (optional)
        console.log('Authenticated request from:', decoded.username);

        // Continue to next middleware/route handler
        next();

    } catch (error) {
        // Token is invalid or expired
        console.log('Authentication failed:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expirado',
                message: 'Tu sesion ha expirado. Por favor inicia sesion de nuevo.'
            });
        }

        return res.status(403).json({
            error: 'Token invalido',
            message: 'El token de autenticacion es invalido'
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
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
    } catch (error) {
        req.user = null;
    }

    next();
}

// Export middleware functions
module.exports = {
    authenticateToken,
    optionalAuth
};
```

#### `backend/middleware/validateTime.js`

```javascript
/**
 * Middleware to validate ordering hours (6:00 AM - 6:00 PM)
 * Rejects requests outside business hours
 */
function validateOrderingTime(req, res, next) {
    // Get current time
    const now = new Date();
    const currentHour = now.getHours();

    // BUG: Code checks >= 23 but message says 6 PM
    // Check if current time is within ordering hours (6 AM to 6 PM)
    if (currentHour < 6 || currentHour >= 23) {
        return res.status(400).json({
            error: 'No se aceptan pedidos a esta hora',
            message: 'Los pedidos solo se pueden realizar entre 6:00 AM y 6:00 PM',
            current_time: now.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }),
            ordering_hours: '6:00 AM - 6:00 PM'
        });
    }

    // Time is valid, proceed to next middleware/route handler
    next();
}

// Export middleware function
module.exports = validateOrderingTime;
```

#### `backend/models/adminModel.js`

```javascript
// ============================================
// ADMIN MODEL
// Handles admin authentication
// ============================================

const { verifyPassword } = require('../utils/password');

/**
 * Verify admin credentials
 * @param {string} username - The entered username
 * @param {string} password - The entered plain-text password
 * @returns {Promise<boolean>} True if credentials are valid, false otherwise
 */
async function verifyAdminCredentials(username, password) {
    try {
        // Get admin credentials from environment variables
        const validUsername = process.env.ADMIN_USERNAME;
        const storedPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        // Check if environment variables are set
        if (!validUsername || !storedPasswordHash) {
            console.error('Admin credentials not configured in environment variables');
            return false;
        }

        // Check username
        if (username !== validUsername) {
            console.log('Invalid username attempt:', username);
            return false;
        }

        // Verify password against stored hash
        const isPasswordValid = await verifyPassword(password, storedPasswordHash);

        if (isPasswordValid) {
            console.log('Admin login successful:', username);
        } else {
            console.log('Invalid password attempt for:', username);
        }

        return isPasswordValid;

    } catch (error) {
        console.error('Error verifying admin credentials:', error);
        return false;
    }
}

/**
 * Get admin username (for token payload)
 * @returns {string|null} Admin username or null if not configured
 */
function getAdminUsername() {
    return process.env.ADMIN_USERNAME || null;
}

// Export functions
module.exports = {
    verifyAdminCredentials,
    getAdminUsername
};
```

#### `backend/models/productModel.js`

```javascript
// Import database pool
const pool = require('../config/database');

/**
 * Get all products from the database
 * @returns {Promise<Array>} Array of product objects
 */
async function getAllProducts() {
    try {
        const result = await pool.query(
            'SELECT product_id, product_name, price, created_at FROM products ORDER BY product_name'
        );
        return result.rows;
    } catch (error) {
        console.error('Error in getAllProducts:', error);
        throw error;
    }
}

/**
 * Get a single product by ID
 * @param {number} productId - The product ID
 * @returns {Promise<Object|null>} Product object or null if not found
 */
async function getProductById(productId) {
    try {
        const result = await pool.query(
            'SELECT product_id, product_name, price, created_at FROM products WHERE product_id = $1',
            [productId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error in getProductById:', error);
        throw error;
    }
}

/**
 * Get multiple products by their IDs
 * @param {Array<number>} productIds - Array of product IDs
 * @returns {Promise<Array>} Array of product objects
 */
async function getProductsByIds(productIds) {
    try {
        const result = await pool.query(
            'SELECT product_id, product_name, price FROM products WHERE product_id = ANY($1)',
            [productIds]
        );
        return result.rows;
    } catch (error) {
        console.error('Error in getProductsByIds:', error);
        throw error;
    }
}

/**
 * Check if a product exists
 * @param {number} productId - The product ID
 * @returns {Promise<boolean>} True if product exists, false otherwise
 */
async function productExists(productId) {
    try {
        const result = await pool.query(
            'SELECT EXISTS(SELECT 1 FROM products WHERE product_id = $1)',
            [productId]
        );
        return result.rows[0].exists;
    } catch (error) {
        console.error('Error in productExists:', error);
        throw error;
    }
}

// Export all functions
module.exports = {
    getAllProducts,
    getProductById,
    getProductsByIds,
    productExists
};
```

#### `backend/models/orderModel.js`

```javascript
// Import database pool
const pool = require('../config/database');

/**
 * Create a new order with items
 * Uses a transaction to ensure data consistency
 * @param {Object} orderData - Order information
 * @param {string} orderData.customer_name - Customer's name
 * @param {string} orderData.customer_phone - Customer's phone number
 * @param {string} orderData.customer_email - Customer's email address
 * @param {string} orderData.notes - Optional order notes
 * @param {Array} orderData.items - Array of items [{product_id, quantity}, ...]
 * @returns {Promise<Object>} Created order with order_id and total_amount
 */
async function createOrder(orderData) {
    const { customer_name, customer_phone, customer_email, notes, items } = orderData;

    // Start a database transaction
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Step 1: Get current prices for all products
        const productIds = items.map(item => item.product_id);
        const productsResult = await client.query(
            'SELECT product_id, product_name, price FROM products WHERE product_id = ANY($1)',
            [productIds]
        );

        // Create a map for quick price lookup
        const productMap = {};
        productsResult.rows.forEach(product => {
            productMap[product.product_id] = {
                name: product.product_name,
                price: parseFloat(product.price)
            };
        });

        // Step 2: Validate all products exist
        const missingProducts = items.filter(item => !productMap[item.product_id]);
        if (missingProducts.length > 0) {
            throw new Error(`Products not found: ${missingProducts.map(i => i.product_id).join(', ')}`);
        }

        // Step 3: Calculate total amount
        let totalAmount = 0;
        items.forEach(item => {
            const price = productMap[item.product_id].price;
            totalAmount += price * item.quantity;
        });

        // Step 4: Insert into orders table
        const orderResult = await client.query(
            `INSERT INTO orders (customer_name, customer_phone, customer_email, total_amount, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING order_id, order_date, status`,
            [customer_name, customer_phone, customer_email, totalAmount, notes || null]
        );

        const order = orderResult.rows[0];

        // Step 5: Insert into order_items table
        for (const item of items) {
            const unitPrice = productMap[item.product_id].price;
            await client.query(
                `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
                [order.order_id, item.product_id, item.quantity, unitPrice]
            );
        }

        // Commit transaction
        await client.query('COMMIT');

        // Return order summary
        return {
            order_id: order.order_id,
            customer_name,
            customer_phone,
            customer_email,
            order_date: order.order_date,
            total_amount: totalAmount,
            status: order.status,
            items: items.map(item => ({
                product_id: item.product_id,
                product_name: productMap[item.product_id].name,
                quantity: item.quantity,
                unit_price: productMap[item.product_id].price
            }))
        };

    } catch (error) {
        // Rollback transaction on error
        await client.query('ROLLBACK');
        console.error('Error in createOrder:', error);
        throw error;
    } finally {
        // Release client back to pool
        client.release();
    }
}

/**
 * Get order by ID with all items
 * @param {number} orderId - The order ID
 * @returns {Promise<Object|null>} Order object with items or null if not found
 */
async function getOrderById(orderId) {
    try {
        // Get order details
        const orderResult = await pool.query(
            `SELECT order_id, customer_name, customer_phone, customer_email,
              order_date, total_amount, status, notes
       FROM orders
       WHERE order_id = $1`,
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            return null;
        }

        const order = orderResult.rows[0];

        // Get order items with product details
        const itemsResult = await pool.query(
            `SELECT oi.item_id, oi.product_id, oi.quantity, oi.unit_price,
              p.product_name
       FROM order_items oi
       JOIN products p ON oi.product_id = p.product_id
       WHERE oi.order_id = $1
       ORDER BY oi.item_id`,
            [orderId]
        );

        // Format response
        return {
            order_id: order.order_id,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            customer_email: order.customer_email,
            order_date: order.order_date,
            total_amount: parseFloat(order.total_amount),
            status: order.status,
            notes: order.notes,
            items: itemsResult.rows.map(item => ({
                item_id: item.item_id,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: parseFloat(item.unit_price),
                subtotal: item.quantity * parseFloat(item.unit_price)
            }))
        };

    } catch (error) {
        console.error('Error in getOrderById:', error);
        throw error;
    }
}

/**
 * Get all orders (for admin dashboard)
 * @param {Object} filters - Optional filters
 * @param {string} filters.status - Filter by status (pending/completed/cancelled)
 * @returns {Promise<Array>} Array of order objects
 */
async function getAllOrders(filters = {}) {
    try {
        let query = `
      SELECT order_id, customer_name, customer_phone, customer_email,
             order_date, total_amount, status
      FROM orders
    `;

        const params = [];

        // Add status filter if provided
        if (filters.status) {
            query += ' WHERE status = $1';
            params.push(filters.status);
        }

        query += ' ORDER BY order_date DESC';

        const result = await pool.query(query, params);

        return result.rows.map(order => ({
            ...order,
            total_amount: parseFloat(order.total_amount)
        }));

    } catch (error) {
        console.error('Error in getAllOrders:', error);
        throw error;
    }
}

/**
 * Update order status
 * @param {number} orderId - The order ID
 * @param {string} status - New status (pending/completed/cancelled)
 * @returns {Promise<Object>} Updated order
 */
async function updateOrderStatus(orderId, status) {
    try {
        // Validate status
        const validStatuses = ['pending', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        const result = await pool.query(
            `UPDATE orders
       SET status = $1
       WHERE order_id = $2
       RETURNING order_id, status`,
            [status, orderId]
        );

        if (result.rows.length === 0) {
            throw new Error(`Order ${orderId} not found`);
        }

        return result.rows[0];

    } catch (error) {
        console.error('Error in updateOrderStatus:', error);
        throw error;
    }
}

// Export all functions
module.exports = {
    createOrder,
    getOrderById,
    getAllOrders,
    updateOrderStatus
};
```

#### `backend/routes/authRoutes.js`

```javascript
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
                message: 'El usuario y la contrasena son obligatorios'
            });
        }

        // Verify credentials
        const isValid = await verifyAdminCredentials(username, password);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Credenciales invalidas',
                message: 'Usuario o contrasena incorrectos'
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
            message: 'Inicio de sesion exitoso',
            token: token,
            username: username,
            expiresIn: '8h'
        });

    } catch (error) {
        console.error('Error in login route:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            message: 'Ocurrio un error durante el inicio de sesion'
        });
    }
});

/**
 * POST /api/auth/logout
 * Admin logout - client-side token invalidation
 */
router.post('/logout', authenticateToken, (req, res) => {
    console.log('Admin logged out:', req.user.username);

    res.status(200).json({
        success: true,
        message: 'Cierre de sesion exitoso'
    });
});

/**
 * GET /api/auth/verify
 * Verify if current token is valid
 */
router.get('/verify', authenticateToken, (req, res) => {
    res.status(200).json({
        success: true,
        message: 'El token es valido',
        user: {
            username: req.user.username,
            admin: req.user.admin
        }
    });
});

/**
 * GET /api/auth/status
 * Check authentication status without requiring a token
 */
router.get('/status', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(200).json({
            authenticated: false,
            message: 'No se proporciono un token'
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
            message: 'Token invalido o expirado'
        });
    }
});

// Export router
module.exports = router;
```

#### `backend/routes/orderRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const orderModel = require('../models/orderModel');
const validateOrderingTime = require('../middleware/validateTime');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/orders
 * Create a new order (PUBLIC - customers can create orders)
 */
router.post('/', validateOrderingTime, async (req, res) => {
    try {
        const { customer_name, customer_phone, customer_email, notes, items } = req.body;

        // Validate required fields
        if (!customer_name || !customer_phone || !customer_email) {
            return res.status(400).json({
                error: 'Campos obligatorios faltantes',
                message: 'nombre, telefono y correo electronico son obligatorios'
            });
        }

        // Validate items array
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                error: 'Articulos invalidos',
                message: 'Los articulos deben ser un arreglo no vacio'
            });
        }

        // Validate each item
        for (const item of items) {
            if (!Number.isInteger(item.product_id) || item.product_id <= 0) {
                return res.status(400).json({
                    error: 'product_id invalido',
                    message: 'Cada articulo debe tener un product_id entero positivo valido'
                });
            }

            if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
                return res.status(400).json({
                    error: 'Cantidad invalida',
                    message: 'Cada articulo debe tener una cantidad entera positiva valida'
                });
            }
        }

        // Create order
        const order = await orderModel.createOrder({
            customer_name,
            customer_phone,
            customer_email,
            notes,
            items
        });

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
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status } = req.query;

        // Validate status filter if provided
        if (status && !['pending', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({
                error: 'Estado invalido',
                message: 'El estado debe ser uno de: pending, completed, cancelled'
            });
        }

        const filters = status ? { status } : null;
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
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                error: 'ID de pedido invalido',
                message: 'El ID del pedido debe ser un entero positivo'
            });
        }

        const order = await orderModel.getOrderById(orderId);

        if (!order) {
            return res.status(404).json({
                error: 'Pedido no encontrado',
                message: `No se encontro un pedido con el ID ${orderId}`
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
router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const { status } = req.body;

        // Validate order ID
        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                error: 'ID de pedido invalido',
                message: 'El ID del pedido debe ser un entero positivo'
            });
        }

        // Validate status
        if (!status || !['pending', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({
                error: 'Estado invalido',
                message: 'El estado debe ser uno de: pending, completed, cancelled'
            });
        }

        const updatedOrder = await orderModel.updateOrderStatus(orderId, status);

        if (!updatedOrder) {
            return res.status(404).json({
                error: 'Pedido no encontrado',
                message: `No se encontro un pedido con el ID ${orderId}`
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
```

#### `backend/routes/productRoutes.js`

```javascript
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
            message: 'Ocurrio un error interno del servidor'
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
                error: 'ID de producto invalido',
                message: 'El ID del producto debe ser un numero'
            });
        }

        const product = await productModel.getProductById(productId);

        // Check if product exists
        if (!product) {
            return res.status(404).json({
                error: 'Producto no encontrado',
                message: `No se encontro un producto con el ID ${productId}`
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
            message: 'Ocurrio un error interno del servidor'
        });
    }
});

// Export router
module.exports = router;
```

---

### Frontend - Customer

#### `frontend/customer/index.html`

```html
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panaderia - Pedidos en Linea</title>
    <link rel="stylesheet" href="styles.css">
</head>

<body>
    <!-- Header -->
    <header class="header">
        <div class="container">
            <div class="nav">
                <h1 class="logo">EMMER Panaderia</h1>
                <div class="nav-links">
                    <span class="nav-link">Horario: 6:00 AM - 6:00 PM</span>
                </div>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="container section">
        <div class="grid" style="grid-template-columns: 2fr 1fr; gap: 2rem;">

            <!-- Products Section -->
            <div>
                <h2 class="mb-3">Nuestros Productos</h2>

                <!-- Loading Spinner -->
                <div id="loading" class="spinner"></div>

                <!-- Products Grid -->
                <div id="products-grid" class="grid grid-3 hidden">
                    <!-- Products will be inserted here by JavaScript -->
                </div>

                <!-- Error Message -->
                <div id="error-message" class="empty-state hidden">
                    <div class="empty-state-icon">warning</div>
                    <p>No se pudieron cargar los productos. Asegurate de que el servidor este en funcionamiento.</p>
                </div>
            </div>

            <!-- Shopping Cart Section -->
            <div>
                <div class="card" style="position: sticky; top: 100px;">
                    <div class="card-body">
                        <h3 class="mb-3">Carrito de Compras</h3>

                        <!-- Empty Cart Message -->
                        <div id="empty-cart" class="empty-state">
                            <p class="text-muted">Tu carrito esta vacio</p>
                        </div>

                        <!-- Cart Items -->
                        <div id="cart-items" class="hidden">
                            <!-- Cart items will be inserted here -->
                        </div>

                        <!-- Cart Total -->
                        <div id="cart-total" class="hidden"
                            style="border-top: 2px solid #ddd; margin-top: 1rem; padding-top: 1rem;">
                            <div class="flex-between" style="font-size: 1.25rem; font-weight: bold;">
                                <span>Total:</span>
                                <span id="total-amount" class="text-primary">$0.00</span>
                            </div>
                            <button class="btn btn-primary btn-block mt-3" id="checkout-btn">
                                Continuar al Pago
                            </button>
                        </div>

                        <!-- Checkout Form (Initially Hidden) -->
                        <div id="checkout-form" class="hidden">
                            <div style="border-top: 2px solid #ddd; margin-top: 1rem; padding-top: 1rem;">
                                <h4 class="mb-3">Informacion de Contacto</h4>

                                <form id="order-form">
                                    <div class="form-group">
                                        <label class="form-label">Nombre *</label>
                                        <input type="text" id="customer-name" class="form-control"
                                            placeholder="Tu nombre completo" required>
                                        <span class="form-error">Por favor ingresa tu nombre</span>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">Telefono *</label>
                                        <input type="tel" id="customer-phone" class="form-control"
                                            placeholder="555-1234" required>
                                        <span class="form-error">Por favor ingresa tu numero de telefono</span>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">Correo Electronico *</label>
                                        <input type="email" id="customer-email" class="form-control"
                                            placeholder="tu@ejemplo.com" required>
                                        <span class="form-error">Por favor ingresa un correo electronico valido</span>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">Instrucciones Especiales (Opcional)</label>
                                        <textarea id="order-notes" class="form-control"
                                            placeholder="Alguna solicitud especial?" rows="3"></textarea>
                                    </div>

                                    <div class="flex-between mb-2" style="font-size: 1.25rem; font-weight: bold;">
                                        <span>Total:</span>
                                        <span id="checkout-total-amount" class="text-primary">$0.00</span>
                                    </div>

                                    <button type="submit" class="btn btn-primary btn-block" id="place-order-btn">
                                        Realizar Pedido
                                    </button>

                                    <button type="button" class="btn btn-outline btn-block mt-2" id="back-to-cart-btn">
                                        Volver al Carrito
                                    </button>
                                </form>
                            </div>
                        </div>

                        <!-- Order Success Message (Initially Hidden) -->
                        <div id="order-success" class="hidden">
                            <div style="text-align: center; padding: 2rem 0;">
                                <div style="font-size: 4rem; margin-bottom: 1rem;">check</div>
                                <h3 class="mb-2">Pedido Realizado con Exito!</h3>
                                <p class="text-muted mb-2">Pedido #<span id="order-number"></span></p>
                                <p class="text-muted mb-3">Total: $<span id="order-total"></span></p>
                                <button class="btn btn-primary" id="new-order-btn">
                                    Realizar Otro Pedido
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="footer">
        <div class="container">
            <div class="footer-bottom">
                <p>2026 EMMER Panaderia. Todos los derechos reservados.</p>
            </div>
        </div>
    </footer>

    <script src="script.js"></script>
</body>

</html>
```

#### `frontend/customer/script.js`

See [[#Complete Source Code]] - the full file is stored at the top of this document in the session log reads. Key features:
- Product grid with quantity stepper (increment/decrement)
- Shopping cart with add/remove/update
- Checkout form with validation
- Order submission to `POST /api/orders`
- All user-facing strings in Spanish

#### `frontend/customer/styles.css`

CSS comment header: `/* Emmer - MAIN STYLESHEET */`

~836 lines of CSS with:
- CSS custom properties for bakery color palette (warm golds, browns, cream)
- Full reset and base styles
- Responsive grid system (1-4 columns with breakpoints)
- Button variants (primary, secondary, outline, sizes)
- Card components
- Sticky header with navigation
- Footer styling
- Form controls with error states
- Toast notifications (slide-in from right)
- Loading spinner animation
- Quantity stepper component
- Badge component
- Utility classes (spacing, text, visibility)

---

### Frontend - Admin

#### `frontend/admin/login.html`

```html
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inicio de Sesion - Panaderia</title>
    <link rel="stylesheet" href="styles.css">
    <style>
        .login-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
        }
        .login-card {
            background: var(--white);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            padding: var(--spacing-2xl);
            width: 100%;
            max-width: 400px;
        }
        .login-header { text-align: center; margin-bottom: var(--spacing-xl); }
        .login-header h1 { color: var(--primary-color); margin-bottom: var(--spacing-xs); }
        .login-header p { color: var(--gray); margin: 0; }
        .error-message {
            background-color: #ffebee;
            border: 1px solid var(--error);
            color: var(--error);
            padding: var(--spacing-sm);
            border-radius: var(--radius-md);
            margin-bottom: var(--spacing-md);
            display: none;
        }
        .error-message.show { display: block; }
        .login-footer {
            text-align: center;
            margin-top: var(--spacing-lg);
            color: var(--gray);
            font-size: 0.875rem;
        }
    </style>
</head>

<body>
    <div class="login-container">
        <div class="login-card">
            <div class="login-header">
                <h1>Inicio de Sesion</h1>
                <p>EMMER Panaderia</p>
            </div>

            <div id="error-message" class="error-message">
                Credenciales invalidas
            </div>

            <form id="login-form">
                <div class="form-group">
                    <label class="form-label" for="username">Usuario</label>
                    <input type="text" id="username" class="form-control" placeholder="Ingresa tu usuario" required
                        autocomplete="username">
                </div>

                <div class="form-group">
                    <label class="form-label" for="password">Contrasena</label>
                    <input type="password" id="password" class="form-control" placeholder="Ingresa tu contrasena"
                        required autocomplete="current-password">
                </div>

                <button type="submit" class="btn btn-primary btn-block" id="login-btn">
                    Iniciar Sesion
                </button>
            </form>

            <div class="login-footer">
                <p>2026 EMMER Panaderia</p>
            </div>
        </div>
    </div>

    <script src="auth.js"></script>
</body>

</html>
```

#### `frontend/admin/index.html`

Full admin dashboard with:
- Header: logo, current time, username, logout button
- Stats cards: Total Orders, Pending Orders, Completed Today
- Filter buttons: All Orders, Pending, Completed, Cancelled
- Orders container (populated by JS)
- Empty state and error state
- Footer: "2026 EMMER Panaderia - Panel de Administracion"
- Loads `auth.js` then `script.js`

#### `frontend/admin/auth.js`

Authentication utilities:
- `API_URL` constant declaration (the ONE true source)
- `setAuthToken()` / `getAuthToken()` / `clearAuthToken()` - localStorage management
- `isAuthenticated()` - checks token existence
- `handleLogin(event)` - form submission handler
- `handleLogout()` - calls logout endpoint + clears token + redirects
- `verifyToken()` - calls `/api/auth/verify`
- `requireAuth()` - redirects to login if not authenticated
- Auto-redirect on login.html if already logged in

#### `frontend/admin/script.js`

Dashboard logic:
- Line 5: `//const API_URL` **commented out** (fix for redeclaration bug)
- `checkAuth()` IIFE - verifies auth on page load
- `STATUS_LABELS` / `STATUS_LABELS_LOWER` / `translateStatus()` - Spanish status translation
- `fetchOrders(filter)` - fetches orders from API, calls `displayOrders()` and `updateStats()`
- `displayOrders()` / `createOrderCard(order)` - renders order cards with `escapeHtml()`
- `viewOrderDetails(orderId)` - toggleable detail view with items
- `updateOrderStatus(orderId, newStatus)` - PATCH status with confirmation dialog
- `filterOrders(filter)` - button click handler, toggles `active` class
- `updateStats()` - fetches ALL orders separately (redundant call), updates stat counters
- `formatDate()` / `updateCurrentTime()` - locale `es-MX`
- `escapeHtml()` / `showToast()` - utilities
- Auto-refresh: orders every 30s, time every 1s

#### `frontend/admin/styles.css`

~794 lines. Nearly identical to `customer/styles.css` (DRY violation noted in audit). Still says `SWEET DELIGHTS BAKERY - MAIN STYLESHEET` in the comment header (unlike customer which was updated to "Emmer").

---

### Infrastructure

#### `Dockerfile`

```dockerfile
# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy backend code
COPY backend/ ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "server.js"]
```

#### `docker-compose.yml` (root - production)

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: bakery_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - bakery_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Node.js Backend API
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: bakery_backend
    restart: unless-stopped
    env_file:
      - backend/.env.production
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - bakery_network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Nginx Web Server
  nginx:
    image: nginx:alpine
    container_name: bakery_nginx
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./frontend:/usr/share/nginx/html:ro
    depends_on:
      - backend
    networks:
      - bakery_network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  bakery_network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
```

#### `nginx/nginx.conf`

```nginx
# Main nginx configuration for bakery system

# Upstream backend API
upstream backend_api {
    server backend:3000;
}

server {
    listen 80;
    server_name bakery.jrobbl.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Root directory for static files
    root /usr/share/nginx/html;
    index index.html;

    # Customer frontend (main page)
    location / {
        alias /usr/share/nginx/html/customer/;
        try_files $uri $uri/ /customer/index.html;
    }

    # Admin frontend
    location /admin {
        alias /usr/share/nginx/html/admin/;
        try_files $uri $uri/ /admin/index.html;
    }

    # API endpoints - proxy to backend
    location /api/ {
        proxy_pass http://backend_api/api/;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files caching
    location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

---

## Reproduction Guide

### Step-by-step: From zero to running system

#### 1. Prerequisites

```
- Node.js 18+
- npm
- Docker & Docker Compose
- Git
```

#### 2. Clone/create the project structure

```bash
mkdir -p oos/{database,backend/{config,middleware,models,routes,utils},frontend/{customer,admin},nginx,aux}
```

#### 3. Create all files

Copy every file from the [[#Complete Source Code]] section above into the corresponding paths.

#### 4. Start the database

```bash
cd oos/database
docker compose up -d
```

Verify:
```bash
docker ps | grep oos_postgres
```

#### 5. Apply the schema

```bash
docker exec -i oos_postgres psql -U oos_admin -d oos_db < database/init.sql
```

Verify tables:
```bash
docker exec -it oos_postgres psql -U oos_admin -d oos_db -c "\dt"
```

#### 6. Seed sample products

```bash
cd backend && npm install
cd ..
node aux/add-sample-products.js
```

#### 7. Set up admin credentials

```bash
cd backend
node setup-admin.js
```

Follow the prompts, then paste the output into `backend/.env`.

#### 8. Start the backend

```bash
cd backend
npm run dev
```

Verify: `curl http://localhost:3000/api/health`

#### 9. Open the frontends

- **Customer:** Open `frontend/customer/index.html` in a browser (or serve via a local HTTP server)
- **Admin:** Open `frontend/admin/login.html` in a browser

> [!tip] For proper CORS behavior, serve the frontend files via a local HTTP server instead of opening them as `file://` URLs. Example:
> ```bash
> npx serve frontend -l 5500
> ```
> Then update `API_URL` in `auth.js` and `customer/script.js` if needed.

#### 10. Production deployment (Docker Compose)

```bash
# Create .env.production with your production credentials
# Then from the project root:
docker compose up -d --build
```

This starts PostgreSQL, the Node.js backend, and Nginx on port 8080.

---

## API Endpoints Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | No | Health check |
| `POST` | `/api/auth/login` | No | Admin login, returns JWT |
| `POST` | `/api/auth/logout` | Yes | Cosmetic logout (token not invalidated) |
| `GET` | `/api/auth/verify` | Yes | Verify token validity |
| `GET` | `/api/auth/status` | No | Check auth status |
| `GET` | `/api/products` | No | List all products |
| `GET` | `/api/products/:id` | No | Get single product |
| `POST` | `/api/orders` | No | Create order (validates ordering hours) |
| `GET` | `/api/orders` | Yes | List all orders (filterable by `?status=`) |
| `GET` | `/api/orders/:id` | Yes | Get order with items |
| `PATCH` | `/api/orders/:id/status` | Yes | Update order status |

---

## Documents Generated During Session

| File | Purpose |
|---|---|
| `aux/audit-report.md` | Full project audit (security, code quality, structure, usability) |
| `aux/test-plan.md` | 60+ tests across 8 test suites with known bugs table |
| `aux/admin-dashboard-audit.md` | Dashboard counter/filter diagnosis + UI removal guide |
| `aux/project-log.md` | This file - complete session log and reproduction guide |

---

> [!quote] AI Assistant
> All work in this session was performed by **Claude Opus 4.6** via the Claude Code CLI. The assistant read, audited, translated, and documented the project without running the application - all analysis was done through static code review.
