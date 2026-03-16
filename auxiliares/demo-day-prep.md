---
aliases:
  - Demo Day Prep
  - Demo Cheat Sheet
tags:
  - demo
  - checklist
  - hotspot
created: 2026-02-24
---

# Demo Day — Prep & Cheat Sheet

> [!tip] The one-line pitch
> "Customer orders from their phone → admin sees it live → clicks Print → thermal printer spits out two tickets. All local, all real."

---

## The Story You're Telling

```
1. Customer opens the page on their phone (same hotspot)
2. Picks products, fills name + sucursal, submits
3. Admin dashboard (your laptop) shows the order instantly
4. You click 🖨️ — two print jobs are created
5. Pi picks them up in ~3 seconds and prints:
   - COPIA TIENDA  → stays at the counter
   - COPIA CLIENTE → given to the customer
6. Admin marks order as Completado
```

That's the whole loop. Everything else is detail.

---

## What Runs Where

| What | Where | How to start |
|---|---|---|
| PostgreSQL | Laptop (Docker) | `docker-compose up -d` |
| Express API | Laptop (Node) | `npm run dev` |
| Customer page | Any browser on hotspot | Open `customer/index.html` |
| Admin dashboard | Laptop browser | Open `admin/index.html` |
| Pi poller | Raspberry Pi | `python3 poll_and_print.py` |
| Thermal printer | USB → Pi | Plug in, verify `/dev/usb/lp0` |

---

## Startup Sequence (do in this order)

```bash
# 1. Database
cd oos/database
docker-compose up -d

# 2. Backend (leave this terminal open — shows live logs)
cd oos/backend
npm run dev
# Wait for: "✅ Database connected successfully"

# 3. Open admin dashboard in browser
# oos/frontend/admin/index.html → log in → leave open

# 4. On the Pi — update .env if IP changed (see below)
# Then:
source venv/bin/activate
python3 poll_and_print.py
# Wait for: "✅ Logged in successfully"

# 5. Open customer page in a second browser / phone
# oos/frontend/customer/index.html
```

---

## The IP Problem (most likely thing to go wrong)

The laptop's IP on the hotspot **changes every time**. You must check it before starting.

```bash
# On the laptop:
hostname -I
# → e.g. 192.168.43.105

# On the Pi — update .env:
nano hello-printer/.env
# API_URL=http://192.168.43.105:3000   ← use the IP you just found
```

> [!warning] Do this before starting the poller
> If the IP is wrong the Pi logs `❌ Could not reach server` on every poll. Fix the `.env` and restart `poll_and_print.py`.

---

## Pi .env — What It Should Look Like on Demo Day

```
API_URL=http://<LAPTOP_IP_ON_HOTSPOT>:3000
ADMIN_USERNAME=emmer_admin
ADMIN_PASSWORD=<your password>
PRINTER_DEVICE=/dev/usb/lp0
```

> [!important] PRINTER_DEVICE must be `/dev/usb/lp0`
> During testing you used `/tmp/ticket_test.bin`. Change it back or nothing prints.

---

## Pi File Sync Warning

The Pi has an **older copy** of `poll_and_print.py` (no `files/` subfolder). Before the demo, copy the updated file from the USB:

```bash
# On the Pi, from hello-printer/ directory:
cp /path/to/usb/hello-printer/files/poll_and_print.py .
cp /path/to/usb/hello-printer/files/ticket.py .
```

Then verify the key line is there:
```bash
grep PRINTER_DEVICE poll_and_print.py
# Must return: DEVICE = os.getenv('PRINTER_DEVICE') or DEVICE
```

---

## Printer Not Found

```bash
# On the Pi:
ls /dev/usb/
# Should show: lp0

# If nothing shows:
# 1. Unplug the USB cable from the printer
# 2. Wait 3 seconds
# 3. Plug back in
# 4. ls /dev/usb/lp0

# If still missing, check USB connection to Pi (not printer end — Pi end)
```

---

## Credentials Cheat Sheet

| What | Value |
|---|---|
| Admin username | `emmer_admin` |
| Admin password | *(you know this)* |
| DB user | `oos_admin` |
| DB password | `oos_secret_2024` |
| Pi SSH | *(you know this)* |

---

## What the Two Tickets Look Like

**COPIA CLIENTE** (given to customer):
- Bold `COPIA CLIENTE` header
- Store name + address
- Order date, order number, items with prices
- Subtotal / IVA / Gran Total
- Amount in words
- `DATOS DEL CLIENTE` — name + sucursal
- `FIRMA DEL CLIENTE` + signature line

**COPIA TIENDA** (stays at counter):
- Bold `COPIA TIENDA` header
- Store name + address
- Order date, order number, items with prices
- Article count
- `DATOS DEL CLIENTE` — name + sucursal
- Cuts immediately — no totals, no footer

---

## Live Log Reading (backend terminal)

What healthy logs look like during a demo cycle:

```
✅ Authenticated request from: emmer_admin   ← admin loaded dashboard
2026-02-24T... - GET /api/orders             ← orders fetched
2026-02-24T... - POST /api/print-job/order/3 ← admin clicked print
✅ Authenticated request from: emmer_admin
2026-02-24T... - GET /api/print-job/pending  ← Pi polling (every 3s)
2026-02-24T... - PATCH /api/print-job/3/done ← Pi marked job done
```

If you see `Error in getAllOrders` — the DB is probably not reset after the schema change. Run:
```bash
cd oos/database && docker-compose down -v && docker-compose up -d
```

---

## Quick Fixes Under Pressure

| Symptom | Fix |
|---|---|
| Admin shows blank / no orders | DB not running — `docker-compose up -d` |
| `Cannot read properties of null` | DB not reset — `down -v && up -d` |
| Pi: `Could not reach server` | Wrong IP in Pi `.env` — update `API_URL` |
| Pi: `No such file or directory: /dev/usb/lp0` | `PRINTER_DEVICE` still set to `/tmp/...` |
| Pi: `Errno 13 Permission denied` | `sudo python3 poll_and_print.py` |
| Pi keeps finding same job | Old `poll_and_print.py` — copy updated file |
| Admin login fails | Check `ADMIN_USERNAME`/`ADMIN_PASSWORD` in Pi `.env` match backend |
| Products don't load | Backend not running or wrong `API_URL` in `customer/script.js` |
| Order fails to submit | DB schema mismatch — reset DB |

---

## Things to Know If Asked

**"Why two tickets?"**
One stays at the counter (store reference), one goes to the customer. Standard for pickup orders.

**"Is this real-time?"**
The Pi polls every 3 seconds. There's a ~3 second delay between clicking Print and the ticket coming out.

**"Can customers order from their phone?"**
Yes — the customer page works in any browser on the same network. During the demo, open it on your phone connected to the hotspot.

**"What's the database?"**
PostgreSQL running in Docker on the same laptop. In production it would be on a VPS.

**"Where does the Pi connect?"**
To the laptop's Express API over the local hotspot. In production the Pi would point to `https://bakery.jrobbl.com`.

---

## The One Thing That Makes It Look Great

After placing an order from your phone, **switch immediately to the laptop** to show the admin dashboard. The order is already there. Click Print — the Pi starts printing before you finish your sentence. That 3-second moment is the demo.
