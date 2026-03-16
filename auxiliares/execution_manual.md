---
title: Execution Manual
tags: [oos, execution, demo, testing, thermal-printer]
created: 2026-03-16
---

# Execution Manual

> [!abstract] What this covers
> Complete walkthrough from a cold start to a printed ticket — including programmatic validation without a physical printer. Use this to verify the full stack works before a demo.

---

## Architecture at a Glance

```
Browser (customer)  ──POST /api/orders──►  Express :3000  ──►  PostgreSQL (Docker)
Browser (admin)     ──POST /api/print-job/order/:id──►  Express :3000
                                                               │
Raspberry Pi  ◄──GET /api/print-job/pending (every 3s)────────┘
      │
      └──► Thermal printer  /dev/usb/lp0
           (or /tmp/ticket_test.bin for testing)
```

**What runs where during demo:**

| Component | Where | How started |
|-----------|-------|-------------|
| PostgreSQL | Docker (laptop) | `docker-compose up -d` in `oos/database/` |
| Express API | Node on laptop | `npm run dev` in `oos/backend/` |
| Admin frontend | Laptop browser | Open `oos/frontend/admin/login.html` |
| Customer frontend | Any browser on hotspot | Open `oos/frontend/customer/index.html` |
| Pi poller | Raspberry Pi | `python3 poll_and_print.py` |

---

## Step 1 — Database

### Start

```bash
cd ~/oos_printer/oos/database
docker-compose up -d
```

Container name: `oos_postgres` · Port: `5432` · Volume: `database_postgres_data`

> [!warning] Volume reuse trap
> `docker-compose down -v` only removes volumes Docker created in **that session**. If `database_postgres_data` already exists from a prior run, `init.sql` will be skipped and tables won't exist.
>
> **Fix — load SQL directly into the running container:**
> ```bash
> docker exec -i oos_postgres psql -U oos_admin -d oos_db \
>   < ~/oos_printer/oos/database/init.sql
> ```

### Verify

```bash
docker exec oos_postgres psql -U oos_admin -d oos_db -c "\dt"
```

Expected output — exactly 4 tables:

```
          List of relations
 Schema |    Name     | Type  |   Owner
--------+-------------+-------+-----------
 public | order_items | table | oos_admin
 public | orders      | table | oos_admin
 public | print_jobs  | table | oos_admin
 public | products    | table | oos_admin
```

```bash
docker exec oos_postgres psql -U oos_admin -d oos_db \
  -c "SELECT COUNT(*) FROM products;"
# → 35
```

---

## Step 2 — Backend

### Start

```bash
cd ~/oos_printer/oos/backend
npm run dev
```

Wait for this line before proceeding:

```
✅ Database connected successfully
```

### Verify

```bash
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

Expected:

```json
{
    "status": "OK",
    "message": "La API de la panadería está funcionando"
}
```

> [!note] Ordering hours
> Orders are blocked outside configured hours (`ORDER_HOUR_START`/`ORDER_HOUR_END` in `.env`, defaults 6–23). If you get a `400 No se aceptan pedidos`, check `backend/.env`.

---

## Step 3 — Get Auth Token

All admin API calls require a Bearer token.

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"emmer_admin","password":"<your_password>"}' \
  | python3 -m json.tool
```

Expected:

```json
{
    "success": true,
    "token": "eyJhbGci..."
}
```

Save the token for the rest of the steps:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"emmer_admin","password":"<your_password>"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

echo $TOKEN   # confirm it's set
```

[[16-03-2026]] → eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbiI6dHJ1ZSwidXNlcm5hbWUiOiJlbW1lcl9hZG1pbiIsImlhdCI6MTc3MzY2ODI2NSwiZXhwIjoxNzczNjk3MDY1fQ.wyLQJ130XRukXEC0yD-JjiCsFsLGSQPZnLPWzTXbKms

---

## Step 4 — Create a Test Order

```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test Demo",
    "customer_branch": "Sucursal Roma",
    "customer_phone": "5512345678",
    "customer_email": "demo@test.com",
    "items": [
      {"product_id": 1, "quantity": 2},
      {"product_id": 5, "quantity": 1}
    ]
  }' | python3 -m json.tool
```

Expected — note the `order_id` returned (you'll need it):

```json
{
    "success": true,
    "order": {
        "order_id": 1,
        "customer_name": "Test Demo",
        "customer_branch": "Sucursal Roma",
        "total_amount": 45.0,
        "status": "pending",
        ...
    }
}
```

Save it:

```bash
ORDER_ID=1   # replace with actual order_id from response
```

### Verify in DB

```bash
docker exec oos_postgres psql -U oos_admin -d oos_db \
  -c "SELECT order_id, customer_name, total_amount, status FROM orders;"
```

---

## Step 5 — Trigger Print Jobs

```bash
curl -s -X POST http://localhost:3000/api/print-job/order/$ORDER_ID \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```

Expected (first time — not yet printed):

```json
{
    "jobs": [
        {"id": 1, "order_id": 1, "copy_type": "customer", "status": "pending"},
        {"id": 2, "order_id": 1, "copy_type": "store",    "status": "pending"}
    ],
    "alreadyPrinted": false
}
```

> [!info] Idempotent
> If you hit this endpoint again for the same order, `alreadyPrinted` will be `true` and no new jobs are created.

### Verify print_jobs in DB

```bash
docker exec oos_postgres psql -U oos_admin -d oos_db \
  -c "SELECT id, order_id, copy_type, status FROM print_jobs;"
```

Expected: 2 rows, both `status = pending`.

---

## Step 6 — Simulate the Pi Poller (no printer)

This runs the full Pi logic on the laptop, writing output to a temp file instead of `/dev/usb/lp0`.

### Setup (one-time)

```bash
cd ~/oos_printer/hello-printer/files

# Create a local venv so we don't pollute system Python
python3 -m venv venv
source venv/bin/activate
pip install requests python-dotenv
```

### Create a local .env for the poller

```bash
cat > ~/oos_printer/hello-printer/files/.env << 'EOF'
API_URL=http://localhost:3000
ADMIN_USERNAME=emmer_admin
ADMIN_PASSWORD=<your_password>
PRINTER_DEVICE=/tmp/ticket_test.bin
EOF
```

> [!important]
> `PRINTER_DEVICE=/tmp/ticket_test.bin` — this is what makes it work without a real printer. The Pi uses `/dev/usb/lp0`.

### Run the poller (single poll, then Ctrl+C)

```bash
cd ~/oos_printer/hello-printer/files
source venv/bin/activate
python3 poll_and_print.py
```

Expected output:

```
🖨️  Hello Printer — Poll Script
   Server: http://localhost:3000
   Polling every 3 seconds

✅ Logged in successfully
🖨️  Job #1 found — printing...
✅ Job #1 printed
✅ Job #1 marked as done
⏳ No jobs pending...    ← (3 seconds later, picks up job #2)
🖨️  Job #2 found — printing...
✅ Job #2 printed
✅ Job #2 marked as done
⏳ No jobs pending...
```

Press `Ctrl+C` after both jobs are done.

### Verify the output file exists

```bash
ls -lh /tmp/ticket_test.bin
# Should be several KB — raw ESC/POS binary
```

### Inspect the ticket content (readable portion)

```bash
strings /tmp/ticket_test.bin | head -40
```

You should see: `COPIA CLIENTE` or `COPIA TIENDA`, `EMMER PANADERIA`, `ZACATECAS 24 COL. ROMA NORTE`, item names, `DATOS DEL CLIENTE`, customer name.

> [!note]
> Only the last job's output will be in `/tmp/ticket_test.bin` since the file is opened with `'wb'` (overwrite) per job. Both jobs print sequentially — the file will contain the last one printed. To capture both, you can temporarily rename between polls.

---

## Step 7 — Verify Jobs Marked as Done

```bash
docker exec oos_postgres psql -U oos_admin -d oos_db \
  -c "SELECT id, copy_type, status, printed_at FROM print_jobs;"
```

Expected: both rows now show `status = done` and a `printed_at` timestamp.

---

## Step 8 — Verify has_print_jobs Flag

This is what makes the `Impreso ✓` badge appear in the admin UI.

```bash
curl -s http://localhost:3000/api/orders?status=pending \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool | grep has_print_jobs
```

Expected: `"has_print_jobs": true`

---

## Step 9 — Test "Print Recent" Button

Creates jobs for all unprinted orders from the last 30 min. Useful to verify the bulk path.

First, create a second order:

```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Second Demo",
    "customer_branch": "Sucursal Condesa",
    "items": [{"product_id": 3, "quantity": 3}]
  }' | python3 -c "import sys,json; o=json.load(sys.stdin)['order']; print('order_id:', o['order_id'])"
```

Then trigger print-recent:

```bash
curl -s -X POST http://localhost:3000/api/print-job/recent \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```

Expected: `{"queued": 1}` — only the new unprinted order is picked up.

---

## Step 10 — Mark Order Completed

```bash
curl -s -X PATCH http://localhost:3000/api/orders/$ORDER_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "completed"}' \
  | python3 -m json.tool
```

Expected: `{"order_id": 1, "status": "completed"}`

---

## Full Validation Checklist

```
[ ] docker ps shows oos_postgres running
[ ] \dt returns 4 tables (including print_jobs)
[ ] products COUNT = 35
[ ] GET /api/health → 200 OK
[ ] POST /api/auth/login → token received
[ ] POST /api/orders → order_id returned, status = pending
[ ] POST /api/print-job/order/:id → 2 jobs, alreadyPrinted = false
[ ] print_jobs table: 2 rows, status = pending
[ ] poll_and_print.py picks up job #1, marks done, then job #2
[ ] /tmp/ticket_test.bin exists, strings shows ticket content
[ ] print_jobs table: both rows status = done, printed_at set
[ ] GET /api/orders returns has_print_jobs = true
[ ] POST /api/print-job/recent → queued = 0 (already printed)
[ ] PATCH /api/orders/:id/status → status = completed
```

---

## Common Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `relation "products" does not exist` | Volume reused, init.sql skipped | `docker exec -i oos_postgres psql -U oos_admin -d oos_db < oos/database/init.sql` |
| `401 Unauthorized` on print endpoints | Missing or expired token | Re-run the login step, update `$TOKEN` |
| `400 No se aceptan pedidos` | Outside ordering hours | Check `ORDER_HOUR_START`/`ORDER_HOUR_END` in `backend/.env` |
| Poller: `❌ Could not reach server` | Wrong `API_URL` in `.env` | On Pi: update `API_URL` to current laptop hotspot IP |
| Poller: `No such file /dev/usb/lp0` | `PRINTER_DEVICE` not overridden | Set `PRINTER_DEVICE=/tmp/ticket_test.bin` in poller `.env` |
| Poller: `Permission denied /dev/usb/lp0` | USB device permissions | `sudo python3 poll_and_print.py` on Pi |
| Poller keeps re-printing same job | Old version of `poll_and_print.py` on Pi | Copy updated file from `hello-printer/files/` |
| `alreadyPrinted: true` on reprint attempt | Jobs already exist for this order | Expected — idempotent by design |
| Admin shows blank / no orders | Backend not running or DB down | Check terminal 2, restart `npm run dev` |

---

## Pi-Specific Notes

### Before every demo — check the IP

The laptop's hotspot IP changes on each boot.

```bash
# On laptop:
hostname -I
# → e.g. 192.168.43.105

# On Pi:
nano ~/hello-printer/.env
# Set: API_URL=http://192.168.43.105:3000
```

### Sync updated scripts to Pi

The Pi may have an older copy without the `files/` subfolder.

```bash
# On Pi, from hello-printer/ directory:
cp /path/to/usb/hello-printer/files/poll_and_print.py .
cp /path/to/usb/hello-printer/files/ticket.py .

# Confirm the PRINTER_DEVICE override is present:
grep PRINTER_DEVICE poll_and_print.py
# Must return: DEVICE = os.getenv('PRINTER_DEVICE') or DEVICE
```

### Pi startup

```bash
cd ~/hello-printer
source venv/bin/activate
python3 poll_and_print.py
# Wait for: ✅ Logged in successfully
```

---

## Ticket Format Reference

Both copies share the same structure up to the article count, then diverge:

**COPIA CLIENTE** — given to the customer:
- `COPIA CLIENTE` (double-size bold)
- `Preticket orden para llevar`
- Store: `EMMER PANADERIA`, `ZACATECAS 24 COL. ROMA NORTE`, `5598333950`
- Fecha / Orden # / Cajero: `Sistema` / Hora Entrada
- Items table: `Cant. | Descripcion | Importe`
- `Articulos: N`
- Subtotal / IVA (16%) / **Gran Total**
- Total in Spanish words (`CIENTO CUARENTA Y CINCO PESOS 00/100 M.N.`)
- Terminal: `1 -- SERVER1` / Fecha impresion
- `DATOS DEL CLIENTE` — Nombre + Sucursal
- `FIRMA DEL CLIENTE` + signature line
- `Powered by jrobbl`

**COPIA TIENDA** — stays at the counter (shorter):
- `COPIA TIENDA` (double-size bold)
- Same header and items as above
- `Articulos: N`
- `DATOS DEL CLIENTE` — Nombre + Sucursal
- Cuts immediately — **no totals, no signature line**
