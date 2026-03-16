---
aliases:
  - OOS Project Log Session 2
  - EMMER Dev Log Part 2
tags:
  - project
  - dev-log
  - bakery
  - oos
  - emmer
created: 2026-02-16
status: in-progress
prev: "[[project-log]]"
---

# EMMER Panaderia OOS — Session 2 Log

> Continuation of [[project-log]] (Session 1, 2026-02-14). This log covers all work from 2026-02-16: nginx debugging, Docker fixes, frontend API_URL fixes, admin UI changes, deployment to Hostinger VPS, and mobile responsive work.

---

## Table of Contents

- [[#Session Timeline]]
- [[#1 — User Pre-Session Changes]]
- [[#2 — Nginx Diagnosis Round 1]]
- [[#3 — Docker Environment Variable Fix]]
- [[#4 — Nginx Diagnosis Round 2 — CSS Still Broken]]
- [[#5 — Products Not Displayed — Nginx Location Order]]
- [[#6 — Admin Redirect Using Wrong Host]]
- [[#7 — Products STILL Not Displayed — API_URL]]
- [[#8 — Admin Page Broken — const Redeclaration]]
- [[#9 — Deployment Readiness Assessment]]
- [[#10 — Deployment Guide Created]]
- [[#11 — Admin UI Cleanup — Stats Cards and All Button Removed]]
- [[#12 — Admin Page Error on First Load — Race Condition]]
- [[#13 — Hostinger VPS Deployment]]
- [[#14 — Port 80 Conflict on VPS]]
- [[#15 — Mobile Responsive — Customer Page]]
- [[#16 — Mobile Responsive — Admin Page]]
- [[#17 — Admin Mobile Fix Round 2 — Logout Button Missing]]
- [[#Files Modified This Session]]
- [[#Aux Files Created This Session]]

---

## Session Timeline

| # | Topic | Outcome |
|---|-------|---------|
| 1 | User pre-session changes | Multiple files modified by user before conversation started |
| 2 | Nginx Round 1 | Replaced `alias`+`try_files` with `rewrite`+`break` |
| 3 | Docker env fix | Escaped `$` as `$$` in bcrypt hash for Docker Compose |
| 4 | Nginx Round 2 | Nested regex caching inside parent prefix locations |
| 5 | Products missing (nginx) | Moved `location /api/` before `location /` |
| 6 | Admin redirect wrong host | Changed to `$scheme://$http_host/admin/` |
| 7 | Products missing (API_URL) | Changed all frontend JS to `const API_URL = '/api'` |
| 8 | Admin broken (const) | Removed duplicate `const API_URL` from `script.js` |
| 9 | Deployment assessment | Identified SSL, port, CORS, DNS requirements |
| 10 | Deployment guide | Created `aux/deployment-guide.md` — 10-phase guide |
| 11 | Admin UI cleanup | Commented out stats cards and "All" filter button |
| 12 | Admin race condition | Moved `fetchOrders()` inside `checkAuth()` IIFE |
| 13 | VPS deployment | User followed guide, app running on Hostinger |
| 14 | Port 80 conflict | Diagnosed ghost Docker process holding port |
| 15 | Mobile — customer | Created `aux/mobile-responsive-guide.md`, applied CSS changes |
| 16 | Mobile — admin | Created `aux/mobile-responsive-admin-guide.md`, applied CSS changes |
| 17 | Admin mobile fix v2 | Fixed `.nav-links` hamburger hide, oversized icons |

---

## 1 — User Pre-Session Changes

Between Session 1 and this session, the user made several changes independently:

- **`frontend/admin/script.js`**, **`frontend/admin/auth.js`**, **`frontend/customer/script.js`**: Changed `API_URL` to use `window.location.hostname` conditional check (localhost → `http://localhost:3000/api`, else → production URL)
- **`backend/server.js`**: Added CORS configuration with `process.env.ALLOWED_ORIGIN` for production, wildcard `*` for development
- **`backend/middleware/validateTime.js`**: Changed opening hour check from `< 6` to `< 4`
- **`database/init.sql`**: Completely rewritten — added `IF NOT EXISTS` on all tables, new product names/prices (Croissant natural, Croissant almendrado, Chocolatín natural, Chocolatín almendrado, Flor de limón), `ON CONFLICT DO NOTHING`
- **`backend/.env`**: Added third credential set (`emmer_admin`)
- **`.gitignore`**, **`nginx/nginx.conf`**: Minor adjustments

---

## 2 — Nginx Diagnosis Round 1

**User report:** After `docker compose --env-file .env.production up -d`, visiting `http://localhost:8080` showed unstyled page (CSS not loading), and `/admin/` returned 404.

**Root cause:** Two issues:
1. `alias` directive + `try_files` don't work together in nginx — `try_files` generates internal URIs that `alias` can't resolve
2. A top-level `location ~* \.(css|js|...)$` regex had higher priority than the prefix `location /` and `location /admin`, intercepting static file requests before the rewrite could map them to the correct subdirectory

**Fix:** Replaced `alias` + `try_files` with `rewrite` + `break`:
```nginx
location / {
    rewrite ^/$ /customer/index.html break;
    rewrite ^/(.+)$ /customer/$1 break;
}

location /admin/ {
    rewrite ^/admin/$ /admin/index.html break;
    rewrite ^/admin/(.+)$ /admin/$1 break;
}
```

**Documentation:** Created `aux/nginx-fix.md`

---

## 3 — Docker Environment Variable Fix

**User report:** `docker compose --env-file .env.production up -d` showed warnings:
```
WARN[0000] The "DB_USER" variable is not set.
WARN[0000] The "hkkmXw5D" variable is not set.
```

**Root cause:** The bcrypt hash in `backend/.env.production` contained `$` characters:
```
ADMIN_PASSWORD_HASH=$2b$10$hkkmXw5D.XI8MH.4nzRshuVn4N.q.nkUONzAqi5Hg9v7d6sagS6Bi
```
Docker Compose's `env_file` directive interprets `$` as variable substitution, so `$2b` became empty, `$10` became empty, `$hkkmXw5D` was treated as an undefined variable.

**Fix:** Doubled every `$` in the hash:
```
ADMIN_PASSWORD_HASH=$$2b$$10$$hkkmXw5D.XI8MH.4nzRshuVn4N.q.nkUONzAqi5Hg9v7d6sagS6Bi
```

**Documentation:** Created `aux/docker-env-fix.md`

---

## 4 — Nginx Diagnosis Round 2 — CSS Still Broken

**User report:** After Round 1 fix, CSS still not loading.

**Root cause:** The top-level regex `location ~* \.(css|js|...)$` still existed and still had higher priority than prefix locations. In nginx, regex locations beat normal prefix locations regardless of order.

**Fix:** Removed the top-level regex entirely. Nested caching regex blocks inside each parent prefix location:
```nginx
location /admin/ {
    rewrite ^/admin/$ /admin/index.html break;
    rewrite ^/admin/(.+)$ /admin/$1 break;

    location ~* \.(css|js|...)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

location / {
    rewrite ^/$ /customer/index.html break;
    rewrite ^/(.+)$ /customer/$1 break;

    location ~* \.(css|js|...)$ {
        rewrite ^/(.+)$ /customer/$1 break;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**User confirmed:** "It works!"

---

## 5 — Products Not Displayed — Nginx Location Order

**User report:** Page loads with styles, but product list is empty despite products being in `init.sql`.

**Root cause:** `location /` was a catch-all that matched `/api/*` requests before `location /api/` could handle them. The rewrite inside `location /` turned `/api/products` into `/customer/api/products` → 404.

**Fix:** Moved `location /api/` before `location /` in `nginx.conf`. Nginx evaluates prefix locations by specificity — `/api/` is more specific than `/` — but having it first also makes the intent clear:
```nginx
# API endpoints — MUST be before location /
location /api/ { ... }

location /health { ... }

location = /admin { ... }
location /admin/ { ... }

# Customer frontend — catch-all, MUST BE LAST
location / { ... }
```

---

## 6 — Admin Redirect Using Wrong Host

**Diagnosed alongside #5:** The `location = /admin` redirect was:
```nginx
return 301 /admin/;
```
When nginx builds an absolute redirect from a relative path, it uses the `server_name` value. Since `server_name` was only `bakery.jrobbl.com`, accessing `http://localhost:8080/admin` redirected to `http://bakery.jrobbl.com/admin/` — unreachable locally.

**Fix:**
1. Changed redirect to use `$http_host` (preserves whatever host the client used):
   ```nginx
   return 301 $scheme://$http_host/admin/;
   ```
2. Added `localhost` to `server_name`:
   ```nginx
   server_name bakery.jrobbl.com localhost;
   ```

---

## 7 — Products STILL Not Displayed — API_URL

**User report:** Nginx config looked correct after fixes, but products still not showing.

**Root cause:** The frontend JavaScript used `API_URL = 'http://localhost:3000/api'` when hostname was `localhost`. But inside Docker Compose, port 3000 is only exposed on the internal `bakery_network` — it's not mapped to the host. The browser can't reach `localhost:3000`.

**Fix:** Changed all three frontend files to use relative API path:

| File | Before | After |
|------|--------|-------|
| `frontend/customer/script.js` | `hostname === 'localhost' ? 'http://localhost:3000/api' : ...` | `const API_URL = '/api'` |
| `frontend/admin/auth.js` | Same conditional | `const API_URL = '/api'` |
| `frontend/admin/script.js` | Same conditional | Removed declaration (see #8) |

Relative `/api` goes through the same nginx that serves the page → proxied to backend. Works everywhere (localhost, production, any port).

**User confirmed:** "It worked."

---

## 8 — Admin Page Broken — const Redeclaration

**User report:** After the API_URL fix, admin page at `/admin` not accessible.

**Root cause:** Both `auth.js` and `script.js` now declared `const API_URL = '/api'` in global scope. Two `<script>` tags sharing a global `const` declaration causes `SyntaxError: Identifier 'API_URL' has already been declared`, which kills the second script entirely. This bug had been identified and fixed in Session 1 but was reintroduced when changing to relative URLs.

**Fix:** Removed `const API_URL` from `script.js`, replaced with a comment:
```javascript
// API_URL is declared in auth.js (loaded first via index.html)
```

---

## 9 — Deployment Readiness Assessment

**User asked:** "I assume with this we are ready to go for a deployment at a Hostinger VPS, right?"

**Assessment:** Application code is deployment-ready. Infrastructure changes needed:
1. **Port mapping**: Change `"8080:80"` to `"80:80"` in `docker-compose.yml`
2. **SSL/HTTPS**: nginx only listens on port 80, needs Let's Encrypt + certbot
3. **DNS**: Point `bakery.jrobbl.com` A record to VPS IP
4. **Firewall**: Open ports 80 and 443
5. **CORS**: `ALLOWED_ORIGIN=https://bakery.jrobbl.com` requires HTTPS to be configured first

---

## 10 — Deployment Guide Created

Created `aux/deployment-guide.md` — a comprehensive 10-phase guide:

1. VPS initial setup (Docker, deploy user)
2. DNS configuration
3. Project upload (git clone, rsync, or manual)
4. Production environment files (both `.env.production` files, credential generation)
5. Docker Compose changes for production
6. Firewall configuration
7. Build and launch (with troubleshooting)
8. SSL/HTTPS with Let's Encrypt (full nginx SSL config, certbot, auto-renewal hooks)
9. Verification checklist (14-point table)
10. Maintenance operations (logs, backups, restarts, DB access)

Includes architecture diagram, troubleshooting section, and key paths/URLs reference tables.

---

## 11 — Admin UI Cleanup — Stats Cards and All Button Removed

**User request:** Remove the stats squares (total/pending/completed) from the top of the admin page, remove the "Todos los Pedidos" filter button, default to showing pending orders. Keep backend logic intact.

**Changes:**

**`frontend/admin/index.html`:**
- Stats cards `<div class="grid grid-3 mb-4">` wrapped in HTML comment (`<!-- ... -->`)
- "Todos los Pedidos" button wrapped in HTML comment
- "Pendientes" button given `active` class (was on "Todos")

**`frontend/admin/script.js`:**
- `currentFilter` changed from `'all'` to `'pending'`
- Stats element updates guarded with null checks (`if (totalOrdersElement)`)
- Initial `fetchOrders()` call changed to `fetchOrders('pending')`

---

## 12 — Admin Page Error on First Load — Race Condition

**User report:** First load of admin page shows "No se pudieron cargar los pedidos" error, but clicking any filter button works fine.

**Root cause:** Race condition between two independent async operations:
1. `checkAuth()` IIFE runs at script parse time — calls `await requireAuth()` which makes an HTTP request to verify the token
2. `DOMContentLoaded` handler fires and calls `fetchOrders('pending')` — this runs before auth verification completes, the request fails (token not yet validated), error message flashes

**Fix:** Moved `fetchOrders('pending')` inside the `checkAuth()` IIFE, right after auth succeeds. Removed it from `DOMContentLoaded`. Now orders only fetch once authentication is confirmed.

```javascript
(async function checkAuth() {
    const authenticated = await requireAuth();
    if (!authenticated) return;

    // ... display username ...

    // Fetch orders only after auth is confirmed
    fetchOrders('pending');
})();
```

---

## 13 — Hostinger VPS Deployment

User followed `deployment-guide.md` and successfully deployed the application. Steps completed:
- Docker installed on VPS
- Project uploaded
- Environment files configured
- `docker compose --env-file .env.production up -d --build`
- Backend and postgres containers running healthy

Hit port 80 conflict (see #14) and mobile layout issues (see #15, #16, #17).

---

## 14 — Port 80 Conflict on VPS

**User report:** `Error response from daemon: Bind for 0.0.0.0:80 failed: port is already allocated`

**Diagnosis:** `sudo lsof -i :80` showed `docker-pr` (Docker proxy) holding the port — a ghost from a previous container run.

**Fix:** `docker stop bakery_nginx && docker rm bakery_nginx`, then restart. If that fails: `sudo systemctl restart docker` to release all Docker-held ports. User temporarily used port 81 as workaround.

---

## 15 — Mobile Responsive — Customer Page

**User report:** After successful VPS deployment (Step 7.4 of deployment guide), site looked terrible on mobile — products tiny, cart oversized, had to scroll horizontally.

**Root cause:** `frontend/customer/index.html` line 26 had inline style:
```html
<div class="grid" style="grid-template-columns: 2fr 1fr; gap: 2rem;">
```
This two-column layout never collapses. The existing CSS breakpoints only cover `.grid-2`, `.grid-3`, `.grid-4` classes — not inline grids.

**Fix (2 files):**

**`frontend/customer/index.html`:**
- Replaced inline style with `.main-layout` class

**`frontend/customer/styles.css`:**
- Added `.main-layout` desktop rule (preserves `2fr 1fr`)
- Added `@media (max-width: 768px)`: single column, cart un-stickied, logo shrunk, toast centered
- Added `@media (max-width: 480px)`: single-column product grid, tighter padding, larger tap targets

**Documentation:** Created `aux/mobile-responsive-guide.md` with step-by-step guide including VPS deploy commands.

---

## 16 — Mobile Responsive — Admin Page

**User report:** Admin page also not mobile-friendly — icons unbounded, list doesn't display naturally.

**Root cause:** Same pattern — inline styles that can't be overridden by media queries, plus missing mobile breakpoints for order cards, action buttons, and order details.

**Fix (3 files):**

**`frontend/admin/script.js`:**
- `grid grid-2` + inline gap on order details → `.order-details-grid` class

**`frontend/admin/index.html`:**
- Filter buttons inline `gap` → `.filter-bar` class

**`frontend/admin/styles.css`:**
- Added `.order-details-grid` and `.filter-bar` base rules
- Added `@media (max-width: 768px)`: header stacks, card sections flow vertically, buttons wrap with 44px tap targets, card hover disabled
- Added `@media (max-width: 480px)`: time hidden, filter buttons stack, compact padding

**Documentation:** Created `aux/mobile-responsive-admin-guide.md`

---

## 17 — Admin Mobile Fix Round 2 — Logout Button Missing

**User report:** After applying admin mobile guide on VPS, logout button still missing and icons too big.

**Root cause (logout):** The base `styles.css` (shared with customer page) has a `@media (max-width: 768px)` rule on `.nav-links` that sets `position: absolute; opacity: 0; pointer-events: none` — this is the hamburger-menu pattern for the customer page. The admin HTML used that same `.nav-links` class but has no hamburger toggle, so the entire nav row (time, username, logout) was hidden on mobile with no way to show it.

**Root cause (icons):** `.empty-state-icon` set to `font-size: 4rem` globally with no mobile override.

**Fix:**

**`frontend/admin/index.html`:**
- Changed `class="nav-links" style="display: flex; gap: 1rem; align-items: center;"` to `class="admin-nav-links"` — a new class that doesn't inherit the hamburger-menu hide behavior

**`frontend/admin/styles.css`:**
- Added `.admin-nav-links` base rule (`display: flex; gap: 1rem; align-items: center`)
- Added `.admin-nav-links` mobile rule (compact, full width, `justify-content: space-between`)
- Added `.empty-state-icon { font-size: 2.5rem }` inside 768px breakpoint

**Updated:** `aux/mobile-responsive-admin-guide.md` with new Step 2a, updated CSS blocks, updated deploy commands, updated summary table.

---

## Files Modified This Session

### Application Code

| File | Changes |
|------|---------|
| `backend/server.js` | Added CORS config with `ALLOWED_ORIGIN` for production |
| `frontend/admin/auth.js` | `API_URL` changed to `'/api'` (relative) |
| `frontend/admin/index.html` | Stats cards commented out, "All" button commented out, "Pendientes" set as default active, `.nav-links` → `.admin-nav-links`, inline gap → `.filter-bar` class |
| `frontend/admin/script.js` | `const API_URL` removed (declared in auth.js), `currentFilter` default `'pending'`, `fetchOrders('pending')` moved inside `checkAuth()`, stats updates null-guarded, order details grid class changed, `fetchOrders` removed from DOMContentLoaded |
| `frontend/admin/styles.css` | +159 lines: `.order-details-grid`, `.filter-bar`, `.admin-nav-links` base rules + full `@media 768px` and `@media 480px` responsive blocks |
| `frontend/customer/index.html` | Inline grid → `.main-layout` class |
| `frontend/customer/script.js` | `API_URL` changed to `'/api'` (relative) |
| `frontend/customer/styles.css` | +69 lines: `.main-layout` base rule + full `@media 768px` and `@media 480px` responsive blocks |
| `nginx/nginx.conf` | Complete rewrite: `alias`→`rewrite`, nested regex caching, location reordering (`/api/` first, `/` last), `$http_host` redirect, `localhost` in `server_name` |

### Environment/Config (not tracked in git)

| File | Changes |
|------|---------|
| `backend/.env.production` | `$` doubled to `$$` in bcrypt hash |
| `.env.production` (root) | Created for Docker Compose DB variables |

---

## Aux Files Created This Session

| File | Content |
|------|---------|
| `aux/deployment-guide.md` | 10-phase Hostinger VPS deployment guide with SSL, maintenance ops, troubleshooting |
| `aux/docker-env-fix.md` | `$` escaping issue in Docker Compose env_file with bcrypt hashes |
| `aux/nginx-fix.md` | 4 nginx bugs diagnosed across 2 rounds, with root cause analysis and fix for each |
| `aux/mobile-responsive-guide.md` | Customer page mobile responsive fix — step-by-step with VPS deploy commands |
| `aux/mobile-responsive-admin-guide.md` | Admin page mobile responsive fix — step-by-step with VPS deploy commands |
| `aux/project-log-second.md` | This file |

---

## Key Lessons Learned

1. **Nginx location priority**: regex beats normal prefix. Nest regex inside prefix locations to scope them.
2. **Nginx `alias` + `try_files`**: don't work together. Use `rewrite` + `break` instead.
3. **Docker Compose `$` in env_file**: every `$` in values must be `$$` for literal interpretation.
4. **Relative API URLs (`/api`)**: always work through any reverse proxy. Never hardcode `localhost:PORT` in frontend JS.
5. **`const` redeclaration across `<script>` tags**: kills the second script silently. Only declare shared globals in one file.
6. **Async race conditions**: don't fetch data from DOMContentLoaded if auth verification is still in flight. Chain them.
7. **CSS class reuse across pages**: `.nav-links` hamburger-menu pattern in shared base CSS hid the admin nav on mobile. Use a separate class when behavior differs.
8. **Inline styles block responsive design**: `@media` queries can't override inline `style=""` without `!important`. Always use classes.

---

## Related Notes

- [[project-log]] — Session 1: project audit, test plan, Spanish translation, admin dashboard audit
- [[deployment-guide]] — Full VPS deployment instructions
- [[nginx-fix]] — Detailed nginx bug analysis
- [[docker-env-fix]] — Docker Compose `$` escaping
- [[mobile-responsive-guide]] — Customer page mobile CSS
- [[mobile-responsive-admin-guide]] — Admin page mobile CSS
