---
title: Pre-Deployment Check
tags: [deployment, vps, production, hostinger, docker, checklist]
created: 2026-03-16
status: active
---

# Pre-Deployment Check

> [!abstract] Context
> Version 1 accepted by client. Goal: deploy fully containerised on Hostinger VPS under `jrobbl.com` (domain pending), connected to a GitHub repo so changes can be pushed from laptop and pulled on VPS to apply.

---

## Architecture Decision: Multi-App VPS

Since the VPS needs to host multiple applications, the app's nginx container **must not** own ports 80/443 directly. A top-level **Traefik** reverse proxy sits in front of all apps, routes by domain, and handles SSL automatically via Let's Encrypt.

```
Internet
    │  443 / 80
    ▼
┌─────────────────────────────────────────────┐
│  Traefik  (top-level, runs once on VPS)     │
│  Routes by Host header, terminates TLS      │
└──────────┬──────────────────────────────────┘
           │ internal Docker network
           ▼
┌─────────────────────────────┐   ┌─────────────────┐
│  OOS App stack              │   │  Future app 2   │
│  nginx → backend → postgres │   │  ...            │
└─────────────────────────────┘   └─────────────────┘
```

> [!info] Why Traefik over nginx proxy manager?
> Traefik integrates directly with Docker labels — no manual config files per app. Each app declares its own routing via `docker-compose.yml` labels. Let's Encrypt certs renew automatically.

---

## Git Repository Plan

**Repo URL:** `github.com/jrobbl/online-ordering-printing-system`

**Git root:** `oos_printer/` (the entire workspace)

```
online-ordering-printing-system/   ← repo root
├── oos/                           ← runs on VPS
│   ├── backend/
│   ├── frontend/
│   ├── nginx/
│   ├── database/
│   ├── docker-compose.yml
│   └── Dockerfile
├── hello-printer/                 ← runs on Pi
│   └── files/
│       ├── poll_and_print.py
│       ├── ticket.py
│       └── .env.example           ← template only, no secrets
└── auxiliares/                    ← documentation
```

**Workflow:**
```
Laptop: edit → git push → GitHub
VPS:    git pull → docker-compose up -d --build  ← changes live
Pi:     git pull → restart poll_and_print.py     ← script updates
```

---

## Issues Found — Prioritised

### 🔴 Critical (blocks deployment)

#### 1. No `.gitignore` — secrets will be committed

- `oos/.gitignore` → **MISSING**
- `oos/backend/.gitignore` → **MISSING**
- `hello-printer/.gitignore` → exists ✓ (already excludes `.env`)

Files at risk of being pushed to GitHub:
- `oos/backend/.env` — DB password, JWT secret, admin hash
- `hello-printer/files/.env` — plaintext admin password

**Fix:** create `.gitignore` files before first `git init`.

---

#### 2. `backend/.env.production` is missing

`oos/docker-compose.yml` line 31 references:
```yaml
env_file:
  - backend/.env.production
```
This file does **not exist**. Docker Compose will error on `docker-compose up`.

**Fix:** create `backend/.env.production` on the VPS (never in the repo).

---

#### 3. Frontend `API_URL` hardcoded to `localhost:3000`

| File | Line | Current value | Production impact |
|------|------|---------------|-------------------|
| `frontend/admin/auth.js` | 6 | `http://localhost:3000/api` | All admin API calls fail |
| `frontend/customer/script.js` | 5 | `http://localhost:3000/api` | Customer can't load products or place orders |

Both files already have the fix commented out on the next line:
```js
//const API_URL = '/api';   ← this is the correct production value
```

In production, nginx proxies `/api/` → backend. Switching to `/api` makes the frontend work regardless of domain.

**Fix:** swap the two lines in both files.

---

#### 4. `DB_HOST=localhost` — wrong for Docker

`oos/backend/.env` line 1:
```
DB_HOST=localhost
```

Inside Docker, the backend container cannot reach the database via `localhost`. It must use the service name:
```
DB_HOST=postgres
```

**Fix:** set `DB_HOST=postgres` in `backend/.env.production`.

---

#### 5. `ALLOWED_ORIGIN` not set — CORS will block everything in production

`oos/backend/server.js` lines 26–31:
```js
origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN   // ← undefined if not set
    : '*'
```

If `NODE_ENV=production` and `ALLOWED_ORIGIN` is not defined, `origin` evaluates to `undefined`, which in Express CORS means **block all origins**.

**Fix:** set in `backend/.env.production`:
```
ALLOWED_ORIGIN=https://bakery.jrobbl.com
```
Once the client's domain is bought, update this value.

---

#### 6. Weak / default secrets

| Variable | Current value | Required action |
|----------|---------------|-----------------|
| `DB_PASSWORD` | `oos_secret_2024` | Generate strong password |
| `JWT_SECRET` | 64-char string (already good) | Rotate for production |
| `ADMIN_PASSWORD_HASH` | Hash of `emmer2026` | Client to define production password |

**Fix:** generate new values; store only in `.env.production` on VPS.

---

### 🟠 High (should fix before deploying)

#### 7. `NODE_ENV=development` in `.env`

Affects CORS, error verbosity, and any future env-based branching.

**Fix:** set `NODE_ENV=production` in `backend/.env.production`.

---

#### 8. `database/docker-compose.yml` has hardcoded credentials

```yaml
POSTGRES_PASSWORD: oos_secret_2024
```

This file is only used for local dev — the production `oos/docker-compose.yml` uses `${DB_PASSWORD}` correctly. But if this file reaches the repo, credentials are exposed.

**Fix:** move to `${DB_PASSWORD}` and add it to `.gitignore`, or clearly document it as dev-only.

---

#### 9. Pi `.env` has plaintext password and `localhost` API_URL

`hello-printer/files/.env`:
```
API_URL=http://localhost:3000     ← must be VPS domain
ADMIN_PASSWORD=emmer2026          ← plaintext, file must stay off repo
```

The Pi already has a `.gitignore` that excludes `.env` ✓

**Fix (on Pi after VPS is live):**
```
API_URL=https://bakery.jrobbl.com
ADMIN_PASSWORD=<production password>
PRINTER_DEVICE=/dev/usb/lp0
```

---

#### 10. `oos/docker-compose.yml` exposes port 8080 directly

```yaml
nginx:
  ports:
    - "8080:80"
```

With Traefik managing external traffic, this port mapping must be removed. Traefik reaches the nginx container over the internal Docker network via labels, not exposed ports.

**Fix:** remove the `ports` block from the nginx service; add Traefik labels instead.

---

### 🟡 Medium (clean up for good practice)

#### 11. `nginx.conf` has domain hardcoded

```nginx
server_name bakery.jrobbl.com localhost;
```

Fine for now since it's a single-tenant config. When the client's domain is confirmed, update this line.

#### 12. Auth fallback silently grants access on server failure

`frontend/admin/auth.js` line 147:
```js
return true; // Allow access if verification fails
```

This means if the backend is unreachable, anyone with a token (even expired) stays logged in. Acceptable trade-off for demo; revisit for production hardening.

#### 13. `ORDER_HOUR_START`, `ORDER_HOUR_END`, `RECENT_ORDER_MINUTES` not in `.env`

These have safe defaults (6, 23, 30) but should be explicit in production config for clarity.

---

## What Doesn't Need Changing

| Item | Status |
|------|--------|
| `poll_and_print.py` — API_URL loads from env | ✓ |
| `ticket.py` — no hardcoded URLs or IPs | ✓ |
| nginx proxy pass to `backend:3000` | ✓ service name correct |
| Docker healthchecks (use localhost inside container) | ✓ correct for internal use |
| `database/init.sql` — schema is clean | ✓ |
| Backend auth middleware | ✓ |
| All print job logic | ✓ |
| JWT expiry at 8h | ✓ acceptable |

---

## Files That Must Never Enter the Repo

```
oos/backend/.env
oos/backend/.env.production
hello-printer/files/.env
```

Only `.env.example` templates go in the repo. The actual secret files live only on the machines that need them (VPS server, Raspberry Pi).

---

## Pre-Deployment Fixes Checklist

> [!tip] Order matters
> Do these in sequence — Git setup before any secrets are created, secrets never touch the repo.

### Phase 1 — Git hygiene (on laptop, before first push)

- [x] Create `oos_printer/.gitignore` (root)
- [x] Create `oos/.gitignore`
- [x] Create `oos/backend/.gitignore`
- [x] Verify `hello-printer/.gitignore` covers `.env` and `venv/` ✓
- [x] Switch `frontend/admin/auth.js` line 6: `const API_URL = '/api';`
- [x] Switch `frontend/customer/script.js` line 5: `const API_URL = '/api';`
- [x] Create `oos/backend/.env.example` (template with no real values)[^1]
- [x] Create `hello-printer/files/.env.example` (already exists ✓, verify it)
- [x] `git init` at `oos_printer/`
- [x] `git remote add origin git@github.com:jrobbl/online-ordering-printing-system.git`
- [ ] First commit and push — confirm no secrets in diff

### Phase 2 — VPS infrastructure

- [ ] SSH into VPS, confirm Docker and Docker Compose installed
- [ ] Install and configure Traefik (top-level, persistent)
- [ ] Create shared Docker network for Traefik: `docker network create traefik_proxy`
- [ ] `git clone` repo into `/opt/oos/` (or similar)
- [ ] Create `/opt/oos/oos/backend/.env.production` with production values
- [ ] Generate strong DB password: `openssl rand -base64 32`
- [ ] Generate strong JWT secret: `openssl rand -base64 64`
- [ ] Run `setup-admin.js` to generate production admin hash
- [ ] Update `oos/docker-compose.yml`: remove nginx port mapping, add Traefik labels
- [ ] Update `oos/nginx/nginx.conf`: set correct production domain
- [ ] `docker-compose up -d` → verify all containers healthy
- [ ] Confirm HTTPS cert issued by Let's Encrypt
- [ ] Test login from browser over HTTPS

### Phase 3 — Raspberry Pi reconnection

- [ ] Update Pi `hello-printer/files/.env`: set `API_URL=https://bakery.jrobbl.com`
- [ ] Set `ADMIN_PASSWORD` to match production credentials
- [ ] Set `PRINTER_DEVICE=/dev/usb/lp0`
- [ ] `python3 poll_and_print.py` → confirm `✅ Logged in successfully`
- [ ] Place a test order → confirm Pi receives and prints job

### Phase 4 — End-to-end validation

- [ ] Customer page loads over HTTPS, products visible
- [ ] Order placed → appears in admin dashboard
- [ ] Admin login works with production credentials
- [ ] Print button → 2 jobs created → Pi picks up and prints
- [ ] `Impreso ✓` badge appears after Pi marks jobs done
- [ ] `Imprimir Recientes (30 min)` button works

---

## Production `.env.production` Template

> [!warning] This file lives only on the VPS — never in the repo

```dotenv
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=oos_db
DB_USER=oos_admin
DB_PASSWORD=<generate: openssl rand -base64 32>

# Server
PORT=3000
NODE_ENV=production
ALLOWED_ORIGIN=https://bakery.jrobbl.com

# Authentication
ADMIN_USERNAME=emmer_admin
ADMIN_PASSWORD_HASH=<generate: node setup-admin.js>
JWT_SECRET=<generate: openssl rand -base64 64>

# Business logic
ORDER_HOUR_START=4
ORDER_HOUR_END=23
RECENT_ORDER_MINUTES=30
```

---

## Files Examined in This Diagnosis

| File                                     | Finding                                                              |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `oos/docker-compose.yml`                 | Missing `.env.production`, nginx port 8080 needs removal for Traefik |
| `oos/database/docker-compose.yml`        | Hardcoded credentials (dev-only, keep out of repo)                   |
| `oos/Dockerfile`                         | Clean ✓                                                              |
| `oos/nginx/nginx.conf`                   | Hardcoded domain — update before deploy                              |
| `oos/backend/.env`                       | Contains all secrets — must be gitignored                            |
| `oos/backend/server.js`                  | CORS `ALLOWED_ORIGIN` must be set in production                      |
| `oos/backend/config/database.js`         | Reads from env correctly ✓                                           |
| `oos/backend/middleware/auth.js`         | Clean ✓                                                              |
| `oos/backend/middleware/validateTime.js` | Reads from env correctly ✓                                           |
| `oos/backend/routes/authRoutes.js`       | Clean ✓                                                              |
| `oos/backend/routes/orderRoutes.js`      | `validateTime` correctly applied to POST only ✓                      |
| `oos/backend/routes/printJobRoutes.js`   | All routes auth-protected ✓                                          |
| `oos/backend/models/adminModel.js`       | Reads credentials from env ✓                                         |
| `oos/backend/models/orderModel.js`       | Clean ✓                                                              |
| `oos/backend/models/printJobModel.js`    | Clean ✓                                                              |
| `oos/backend/models/productModel.js`     | Clean ✓                                                              |
| `oos/backend/utils/password.js`          | Clean ✓                                                              |
| `oos/backend/package.json`               | All deps pinned, `npm start` / `npm run dev` defined ✓               |
| `oos/database/init.sql`                  | Schema clean, idempotent (`IF NOT EXISTS`) ✓                         |
| `oos/frontend/admin/auth.js`             | **`API_URL` hardcoded to localhost — must fix**                      |
| `oos/frontend/admin/script.js`           | No hardcoded URLs beyond what auth.js provides ✓                     |
| `oos/frontend/customer/script.js`        | **`API_URL` hardcoded to localhost — must fix**                      |
| `hello-printer/files/.env`               | Plaintext password + localhost URL — stays off repo                  |
| `hello-printer/files/.env.example`       | Template exists ✓                                                    |
| `hello-printer/files/poll_and_print.py`  | All config via env vars ✓                                            |
| `hello-printer/files/ticket.py`          | No external dependencies ✓                                           |
| `hello-printer/.gitignore`               | Excludes `.env` and `node_modules` ✓                                 |
| `oos/.gitignore`                         | **MISSING — critical**                                               |
| `oos/backend/.gitignore`                 | **MISSING — critical**                                               |

[^1]: Created with all 13 variables, dummy values, and inline instructions for the two that need generation (DB_PASSWORD, JWT_SECRET, ADMIN_PASSWORD_HASH)
