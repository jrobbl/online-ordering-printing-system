---
aliases:
  - OOS Printer Manual
  - Merge Manual
  - Session Log
tags:
  - oos
  - hello-printer
  - raspberry-pi
  - deployment
  - manual
created: 2026-02-23
---

# OOS + Hello-Printer — Integration Manual

> [!info] What this document covers
> Everything implemented in the merge session of 2026-02-23: wiring the OOS bakery ordering system to the hello-printer thermal ticket queue. Covers architecture, all code changes, local testing, Pi setup, VPS deployment checklist, and pending work for the next session.

---

## 1. Architecture

```
[Customer browser]
  └─ opens oos/frontend/customer/index.html
  └─ POST /api/orders → Express :3000 → PostgreSQL oos_db

[Admin browser]
  └─ opens oos/frontend/admin/index.html
  └─ GET  /api/orders           → sees all orders
  └─ POST /api/print-job/order/:id → creates 2 rows in print_jobs table

[Raspberry Pi]
  └─ runs poll_and_print.py (polls every 3s)
  └─ GET  /api/print-job/pending → fetches oldest pending job + full order data
  └─ builds ticket → writes to /dev/usb/lp0
  └─ PATCH /api/print-job/:id/done → marks job as done
```

Two print jobs are created per order: one `customer` copy and one `store` copy. Each is picked up separately by the poller.

---

## 2. Repository Structure

```
oos_printer/
├── aux/                          ← session docs (this file)
├── oos/                          ← bakery ordering system (own git repo)
│   ├── backend/
│   │   ├── config/database.js
│   │   ├── middleware/auth.js
│   │   ├── middleware/validateTime.js
│   │   ├── models/
│   │   │   ├── adminModel.js
│   │   │   ├── orderModel.js
│   │   │   └── printJobModel.js    ← NEW
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── orderRoutes.js
│   │   │   ├── printJobRoutes.js   ← NEW
│   │   │   └── productRoutes.js
│   │   ├── utils/password.js
│   │   ├── setup-admin.js          ← run to generate bcrypt hash
│   │   ├── .env                    ← local dev credentials
│   │   └── .env.production         ← VPS credentials
│   ├── database/
│   │   ├── docker-compose.yml      ← spins up oos_postgres
│   │   └── init.sql                ← full schema + 35 products
│   └── frontend/
│       ├── admin/
│       │   ├── auth.js             ← API_URL declared here
│       │   ├── index.html
│       │   ├── login.html
│       │   ├── script.js
│       │   └── styles.css
│       └── customer/
│           ├── index.html
│           ├── script.js
│           └── styles.css
└── hello-printer/
    ├── backend/                    ← original hello-printer backend (unused after merge)
    └── files/                      ← Pi scripts
        ├── poll_and_print.py       ← main poller
        ├── ticket.py               ← ESC/POS ticket builder
        ├── smoke_test.py           ← hardware-only test (no API)
        └── .env.example
```

---

## 3. Database

### Schema additions (init.sql)

```sql
CREATE TABLE IF NOT EXISTS print_jobs (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    copy_type   VARCHAR(10) NOT NULL CHECK (copy_type IN ('customer', 'store')),
    status      VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    printed_at  TIMESTAMP DEFAULT NULL
);
```

### Product catalog

35 products, all at $15.00 (demo placeholder prices). Full list in `init.sql`.

### docker-compose.yml (oos/database/)

The `init.sql` is now auto-mounted so it runs on first boot of a fresh volume:

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
  - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
```

> [!warning] Auto-run only works on a fresh volume
> If the volume already exists, `init.sql` will NOT re-run. Use `docker-compose down -v` to wipe and recreate.

### Clean start

```bash
cd oos/database
docker-compose down -v
docker-compose up -d

# Verify
docker exec oos_postgres psql -U oos_admin -d oos_db -c "SELECT COUNT(*) FROM products;"
# → 35
docker exec oos_postgres psql -U oos_admin -d oos_db -c "\dt"
# → products, orders, order_items, print_jobs
```

---

## 4. Backend Changes

### New: `printJobModel.js`

Four functions:

| Function                             | What it does                                                             |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `createJobsForOrder(orderId)`        | Inserts 2 rows (customer + store). Idempotent — checks before inserting. |
| `createJobsForRecentOrders(minutes)` | Finds unprinted orders from last N minutes, queues each.                 |
| `getPendingJob()`                    | Returns oldest pending job with full order data via JOIN.                |
| `markJobDone(id)`                    | Sets status=done, printed_at=NOW().                                      |

### New: `printJobRoutes.js`

All four endpoints protected by `authenticateToken`:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/print-job/order/:id` | Queue 2 jobs for one order |
| POST | `/api/print-job/recent` | Queue jobs for all recent unprinted orders |
| GET | `/api/print-job/pending` | Get oldest pending job (for Pi) |
| PATCH | `/api/print-job/:id/done` | Mark job done (for Pi) |

### Modified: `server.js`

```js
const printJobRoutes = require('./routes/printJobRoutes');
app.use('/api/print-job', printJobRoutes);
```

### Modified: `orderModel.js` — `getAllOrders()`

Added `has_print_jobs` boolean via LEFT JOIN so the admin dashboard can show the "Impreso ✓" badge without a second request:

```sql
SELECT o.order_id, ...,
       CASE WHEN COUNT(pj.id) > 0 THEN true ELSE false END AS has_print_jobs
FROM orders o
LEFT JOIN print_jobs pj ON pj.order_id = o.order_id
...
GROUP BY o.order_id
ORDER BY o.order_date DESC
```

### Modified: `validateTime.js`

Hours are now configurable via env vars instead of hardcoded:

```js
const startHour = parseInt(process.env.ORDER_HOUR_START) || 6;
const endHour   = parseInt(process.env.ORDER_HOUR_END)   || 18;
```

### Modified: `.env`

Three new variables added:

```
ORDER_HOUR_START=4
ORDER_HOUR_END=23
RECENT_ORDER_MINUTES=30
```

---

## 5. Admin Frontend Changes

### `admin/index.html`

Added "Imprimir Recientes" button in the filter bar:

```html
<button class="btn btn-secondary" onclick="printRecentOrders()" style="margin-left: auto;">
    🖨️ Imprimir Recientes (30 min)
</button>
```

### `admin/script.js`

- Added `printedOrders` Set — populated from `has_print_jobs` when orders load.
- `createOrderCard()` — added 🖨️ Print button and "Impreso ✓" badge per card.
- Added `printOrder(orderId)` — POSTs to `/api/print-job/order/:id`, shows toast, updates badge.
- Added `printRecentOrders()` — POSTs to `/api/print-job/recent`, shows toast with count.

### `admin/auth.js`

`API_URL` changed from `/api` to `http://localhost:3000/api` for local dev (opening HTML directly from filesystem).

> [!warning] Revert before VPS deploy
> Change back to `const API_URL = '/api'` before pushing to production. Nginx on the VPS proxies `/api` to the backend — the relative URL works there.

---

## 6. Customer Frontend Changes

### `customer/script.js`

`API_URL` changed from `/api` to `http://localhost:3000/api` for the same reason as admin.

> [!warning] Revert before VPS deploy
> Same as above — revert to `const API_URL = '/api'` before production.

---

## 7. Pi — hello-printer/files/

### `poll_and_print.py` changes

1. `PRINTER_DEVICE` is now overridable via `.env`:
   ```python
   DEVICE = os.getenv('PRINTER_DEVICE') or DEVICE
   ```
2. `print_job()` now uses real order data from the API response:
   ```python
   order = {
       **STORE,
       'order_id'  : job['order_id'],
       'customer'  : job['customer_name'],
       'timestamp' : datetime.fromisoformat(job['order_date']),
       'copy_type' : job['copy_type'],
       'items'     : [{'name': i['name'], 'qty': i['qty'], 'price': i['price']}
                      for i in job['items']],
   }
   ```

### `ticket.py` changes

Copy label added at the top of every ticket:

```python
label = 'COPIA CLIENTE' if order.get('copy_type') == 'customer' else 'COPIA TIENDA'
w(DOUBLE_SIZE_ON)
w(center(label))
w(DOUBLE_SIZE_OFF)
```

### Pi `.env` structure

```
API_URL=http://<LAPTOP_IP>:3000
ADMIN_USERNAME=emmer_admin
ADMIN_PASSWORD=<plain text password>
PRINTER_DEVICE=/tmp/ticket_test.bin   # testing
# PRINTER_DEVICE=/dev/usb/lp0         # demo day
```

> [!important] Pi file location
> On this Pi the scripts live in `hello-printer/` directly — there is no `files/` subdirectory. The `.env` is at `hello-printer/.env`. The `poll_and_print.py` on the Pi may be an older copy — always verify `grep PRINTER_DEVICE poll_and_print.py` returns a result before testing.

### Pi network management (NetworkManager / nmcli 1.52.1)

```bash
# Add test WiFi (keeps hotspot saved)
nmcli device wifi connect "SSID" password "PASSWORD"

# Switch between networks
nmcli connection up "TEST_WIFI_SSID"
nmcli connection up "HOTSPOT_SSID"

# Check current connection
iwgetid
```

---

## 8. All Passwords

| What            | Username      | Where stored                           | Notes                                                   |
| --------------- | ------------- | -------------------------------------- | ------------------------------------------------------- |
| Admin dashboard | `emmer_admin` | `oos/backend/.env` as bcrypt hash      | Last of 3 duplicate blocks — clean up before VPS deploy |
| Pi API auth     | `emmer_admin` | `hello-printer/.env` as **plain text** | Must match admin dashboard password                     |
| DB (local)      | `oos_admin`   | `oos/database/docker-compose.yml`      | `oos_secret_2024` — not needed day-to-day               |
| DB (production) | `oos_admin`   | `oos/backend/.env.production`          | `0c9VqZIiDx` — do not lose                              |
| Pi SSH          | —             | Pi only                                | User remembers                                          |

### How to reset the admin password

```bash
cd oos/backend
node setup-admin.js
# Enter: emmer_admin + new password
# Copy the 3 output lines into .env, replacing ALL previous duplicate blocks
```

> [!danger] .env has 3 duplicate credential blocks
> `admin`, `rob`, and `emmer_admin` all appear as `ADMIN_USERNAME` in `.env`. Only the last one wins. Clean this up — keep only the `emmer_admin` block.

---

## 9. Local Dev Workflow

```bash
# Terminal 1 — database
cd oos/database && docker-compose up -d

# Terminal 2 — backend
cd oos/backend && npm run dev

# Open in browser directly
oos/frontend/customer/index.html   ← place test orders
oos/frontend/admin/index.html      ← manage orders, print

# Terminal 3 — Pi poller (on Pi or local with temp device)
cd hello-printer && python3 poll_and_print.py
```

### Verify a full print cycle

1. Customer places order
2. Admin clicks 🖨️ → toast: "Pedido #X: 2 trabajos creados"
3. Pi log: `🖨️ Job #N found → ✅ marked as done` (×2)
4. Admin dashboard: "Impreso ✓" badge on that order
5. Inspect fake ticket: `strings /tmp/ticket_test.bin | head -40`

---

## 10. Demo Day Checklist

```
[ ] Pi: nmcli connection up "HOTSPOT_SSID"
[ ] Laptop: check IP on hotspot → ip addr show wlan0 (or hostname -I)
[ ] Pi .env: update API_URL=http://<LAPTOP_IP_ON_HOTSPOT>:3000
[ ] Pi .env: PRINTER_DEVICE=/dev/usb/lp0
[ ] Pi: ls /dev/usb/lp0   ← must exist, unplug/replug if not
[ ] Laptop: cd oos/database && docker-compose up -d
[ ] Laptop: cd oos/backend && npm run dev
[ ] Pi: source venv/bin/activate && python3 poll_and_print.py
[ ] Test: place one order, print from admin, verify 2 tickets print
```

> [!tip] Most likely failure
> The laptop's IP on the hotspot changes. Always check it fresh and update `API_URL` in the Pi's `.env` before starting the demo.

---

## 11. VPS Deployment Checklist

See also: `oos/aux/deployment-guide.md` for full step-by-step.

### Before pushing to VPS

```
[ ] Revert API_URL in oos/frontend/customer/script.js → const API_URL = '/api'
[ ] Revert API_URL in oos/frontend/admin/auth.js      → const API_URL = '/api'
[ ] Add to oos/backend/.env.production:
      ORDER_HOUR_START=4
      ORDER_HOUR_END=23
      RECENT_ORDER_MINUTES=30
[ ] Clean up .env duplicate credential blocks (keep only emmer_admin)
```

### On the VPS — database migration

The production postgres volume predates `print_jobs`. Choose one:

**Option A — Reset (loses all orders, gets fresh catalog):**
```bash
docker compose down
docker volume rm <volume_name>
docker compose --env-file .env.production up -d --build
```

**Option B — Patch without data loss:**
```bash
docker compose exec postgres psql -U oos_admin -d oos_db -c "
CREATE TABLE IF NOT EXISTS print_jobs (
    id         SERIAL PRIMARY KEY,
    order_id   INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    copy_type  VARCHAR(10) NOT NULL CHECK (copy_type IN ('customer','store')),
    status     VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','done')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    printed_at TIMESTAMP DEFAULT NULL
);"
```

### Root docker-compose.yml

Add `init.sql` mount to the postgres service (not yet done):
```yaml
- ./database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
```

### Pi for production

```
API_URL=https://bakery.jrobbl.com
PRINTER_DEVICE=/dev/usb/lp0
```

---

## 12. Pending Changes (Next Session)

The following batch of changes was planned but **not yet implemented**. Implement in this order:

### Group 1 — Database
- `init.sql`: add `customer_branch VARCHAR(255) NOT NULL` to `orders` table, make `customer_phone` nullable

### Group 2 — Backend (3 files)
- `orderRoutes.js`: require `customer_branch`, make email optional
- `orderModel.js`: use `customer_branch` in create/get/getAll
- `printJobModel.js`: add `o.customer_branch` to `getPendingJob` SQL

### Group 3 — Customer frontend (3 files)
- `index.html`:
  - Phone field → Sucursal (type text, new placeholder)
  - Remove `required` from email
  - "Continuar al Pago" → "Continuar la orden"
  - Remove `Pedido #X` from success view
- `script.js`:
  - `customerPhoneInput` → `customerBranchInput`
  - `orderData` payload: `customer_branch` instead of `customer_phone`
  - Validation: branch required, email optional
- `styles.css`:
  - Add `.btn-product-unselected` — near-white/barely tinted for qty=0 state
  - Stepper (qty≥1) keeps full primary color

### Group 4 — Admin frontend (1 file)
- `admin/script.js` in `createOrderCard()`:
  - Remove `Pedido #X` header
  - Show `customer_name` + `customer_branch` at slightly larger font

### Group 5 — Ticket (2 files)
- `ticket.py` — split bottom half by `copy_type`:
  - **Customer copy**: keep totals, terminal info, DATOS DEL CLIENTE; replace footer with `FIRMA DEL CLIENTE` + signature line
  - **Store copy**: keep items + article count + DATOS DEL CLIENTE; remove totals/IVA/gran total/amount in words/footer entirely
- `poll_and_print.py`: add `'branch': job['customer_branch']` to order dict

> [!note] DB reset required
> Adding `customer_branch` as NOT NULL requires a fresh DB. Run `docker-compose down -v && docker-compose up -d` after updating `init.sql`.

---

## 13. Key Commands Reference

```bash
# Start local dev
cd oos/database && docker-compose up -d
cd oos/backend && npm run dev

# Reset DB completely
cd oos/database && docker-compose down -v && docker-compose up -d

# Verify DB tables
docker exec oos_postgres psql -U oos_admin -d oos_db -c "\dt"

# Generate new admin password hash
cd oos/backend && node setup-admin.js

# Get laptop IP (for Pi .env)
hostname -I
# or
ip addr show wlan0

# Pi network switch
nmcli connection up "SSID"

# Pi poller
cd hello-printer
source venv/bin/activate
python3 poll_and_print.py

# Inspect fake ticket output
strings /tmp/ticket_test.bin | head -40

# VPS: patch DB without data loss
docker compose exec postgres psql -U oos_admin -d oos_db -f /dev/stdin < patch.sql
```
