# Sweet Delights Bakery - Online Ordering System Audit Report

## Overall Summary

This is a clean, well-structured bakery ordering system with an Express/PostgreSQL backend and a vanilla HTML/CSS/JS frontend (customer + admin). For a learning/small-scale project, it's solid work. There are, however, several issues ranging from **critical security flaws** to minor code quality items.

---

## 1. SECURITY

### Critical Issues

- **`.env` is committed to git.** The `.gitignore` lists `.env`, but `git status` shows the file is tracked (`backend/.env`). This file contains the **database password**, **bcrypt hashes**, and **JWT secret** in plaintext. Once pushed, these secrets are in git history forever. The `.gitignore` at line 80 has `.env`, but the file was likely added before the `.gitignore` was created.

- **Duplicate/conflicting `.env` entries.** The `.env` file has `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, and `JWT_SECRET` defined **twice** (lines 10-12 and 14-16). `dotenv` will use the **last** value, so the first set is silently ignored. This is confusing and error-prone.

- **Hardcoded DB credentials in `docker-compose.yml`** (lines 8-10). The password `oos_secret_2024` is in plain text and committed. Should use environment variable substitution or a `.env` file reference.

- **`JWT_SECRET` generated with `Math.random()`** (`setup-admin.js:83-88`). `Math.random()` is not cryptographically secure. Use `crypto.randomBytes(64).toString('hex')` instead.

- **No rate limiting on login.** The `/api/auth/login` endpoint has no brute-force protection. An attacker can try unlimited password guesses.

- **No HTTPS enforcement.** Everything runs over `http://localhost:3000`. In production, there's no redirect to HTTPS or secure cookie/header configuration.

- **CORS is wide open.** `app.use(cors())` at `server.js:24` allows any origin. Should be restricted to the actual frontend domain(s).

- **Admin credentials stored in env vars (single admin only).** This is workable for a small app, but doesn't scale. There's no way to have multiple admins, change passwords via UI, or lock accounts.

### Moderate Issues

- **XSS in admin order details.** In `admin/script.js:228-229`, `order.customer_name` and `order.customer_phone` are inserted via template literal **without escaping** (only `order.notes` uses `escapeHtml`). A malicious customer name like `<script>alert('xss')</script>` would execute in the admin dashboard.

- **No token blacklist / revocation.** The logout endpoint (`authRoutes.js:74`) is purely cosmetic -- it just logs and returns success. If a token is stolen, there's no way to invalidate it before expiry (8 hours).

- **Token decoded on the client with `atob`** (`admin/script.js:23`). While not a vulnerability per se, it parses the JWT payload without verifying the signature, which could be misleading if the token is tampered with.

- **`validateTime` inconsistency.** The error message says "6:00 AM - 6:00 PM" but the code (`validateTime.js:11`) actually allows orders until 11 PM (`currentHour >= 23`). This mismatch is a bug.

### Minor Issues

- **No input sanitization for `customer_email`** on the backend. Email format is only validated on the frontend.
- **No `helmet` middleware** for security headers.
- **No CSRF protection** (less critical for a JWT API, but worth noting).

---

## 2. CODE CLARITY & QUALITY

### Strengths

- Well-organized comments with clear section headers throughout (e.g., `// ============================================`).
- Good JSDoc documentation on model functions (e.g., `orderModel.js`, `productModel.js`).
- Consistent naming conventions (camelCase for JS, snake_case for DB columns).
- Each file has a clear, single responsibility.

### Issues

- **`← NEW` comments scattered everywhere** (`server.js:11, 49, 64-67, 102-105`, `orderRoutes.js:5, 84, 114, 149`). These are leftover markers from development phases and should be cleaned up.
- **`← Add this line` comments** in `admin/script.js:97-102` -- leftover dev notes.
- **`setup-main.js` is empty** (1 line, no content). Dead file.
- **Duplicate CSS.** `admin/styles.css` and `customer/styles.css` are **nearly identical** (~800 lines each). This is a significant DRY violation -- should be a shared stylesheet.
- **Duplicate utility functions.** `escapeHtml()` and `showToast()` are duplicated between `customer/script.js` and `admin/script.js`.
- **`API_URL` is hardcoded** in three separate files (`auth.js:6`, `admin/script.js:5`, `customer/script.js:5`). Should be centralized or use a config.
- **`.gitignore` has markdown content appended** after the rules (lines 200+). The file mixes gitignore rules with documentation, and includes a stray triple-backtick at line 200.
- **`aux/` folder** contains test scripts and notes that are tracked in git but aren't part of the app. The `.gitignore` mentions `aux/*` at line 241, but it's inside a markdown block and likely not being parsed as a valid gitignore rule.

---

## 3. STRUCTURE & ARCHITECTURE

### Strengths

- **Clean MVC-like separation**: `models/`, `routes/`, `middleware/`, `config/`, `utils/` -- textbook Express structure.
- **Database transactions** in `createOrder()` with proper `BEGIN`/`COMMIT`/`ROLLBACK` and `client.release()` in `finally`.
- **Parameterized queries** everywhere -- no SQL injection risk. Good use of `$1`, `$2`, `ANY($1)`.
- **Frontend/backend separation** is clear.
- **Docker Compose** for the database is a nice touch for dev setup.

### Issues

- **No shared frontend build system.** The frontend is raw HTML/CSS/JS with no bundler, no module system, and no way to share code between admin and customer frontends. This leads to duplication.
- **No tests.** `package.json` has `"test": "echo \"Error: no test specified\" && exit 1"`. The `aux/` folder has ad-hoc test scripts, but no test framework (jest, mocha, etc.).
- **No `init.sql` auto-loading.** The `docker-compose.yml` doesn't mount `init.sql` into the Postgres container's `/docker-entrypoint-initdb.d/`, so the schema isn't applied automatically.
- **Database schema lacks indexes.** `orders` table has no index on `status` or `order_date`, which will hurt performance as order volume grows.
- **`orders` table has no `CHECK` on `customer_email`** format -- only validates on frontend.
- **Missing `IF NOT EXISTS`** on `orders` and `order_items` tables (`init.sql:9, 21`) while `products` table has it.
- **No migration system.** Schema changes would need to be done manually.

---

## 4. USABILITY

### Strengths

- **Clean, warm visual design.** CSS variables create a cohesive bakery theme. The color palette is consistent and appealing.
- **Good UX flow.** Product grid with stepper, cart sidebar, checkout form, and success message -- smooth customer journey.
- **Responsive design.** Media queries handle mobile layouts for grids and navigation.
- **Admin dashboard** has order filtering, stats cards, auto-refresh (30s), and inline order details.
- **Toast notifications** provide good user feedback.
- **Loading states and error states** are handled throughout.
- **`escapeHtml`** is used in the customer frontend to prevent XSS from product names.

### Issues

- **Ordering hours shown as "6 AM - 6 PM"** in the UI but code allows until 11 PM. Customers will be confused.
- **No order lookup for customers.** After placing an order, a customer has no way to check its status.
- **No product images.** The product cards only show name and price.
- **No product descriptions.**
- **Cart is not persisted.** Refreshing the page loses the cart (no localStorage/sessionStorage).
- **"Completed Today" stat** in the admin dashboard (`admin/script.js:350`) actually counts **all** completed orders, not just today's. Misleading label.
- **No pagination** on orders list. Will become unusable with many orders.
- **Admin page is accessible by URL** (`/admin/index.html`). While the JS redirects to login, the HTML content briefly flashes before the redirect happens.

---

## Priority Recommendations

1. **Remove `.env` from git history** and ensure it's properly gitignored
2. **Fix the XSS vulnerability** in admin order details (escape all user-provided data)
3. **Fix the ordering hours mismatch** (code says 23, message says 18)
4. **Add rate limiting** to the login endpoint
5. **Use `crypto.randomBytes`** instead of `Math.random` for secret generation
6. **Restrict CORS** to specific origins
7. **Clean up** leftover `← NEW` comments and the broken `.gitignore`
8. **Deduplicate** the CSS into a shared stylesheet

---

The foundation is well-built. The project demonstrates good understanding of Express patterns, PostgreSQL transactions, and JWT auth flow. The main gaps are security hardening and production-readiness.
