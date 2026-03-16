# Sweet Delights Bakery - Comprehensive Test Plan

## Known Bug: Admin Dashboard Broken

### Symptoms
- After logging in via `login.html`, the admin dashboard (`index.html`) shows **no orders** and the **logout button does not work**.

### Root Cause
`const API_URL = 'http://localhost:3000/api'` is declared in **both** `auth.js:6` and `script.js:5`. The admin `index.html` loads both scripts in order:

```html
<script src="auth.js"></script>    <!-- line 110 -->
<script src="script.js"></script>  <!-- line 111 -->
```

Both scripts run in the **same global scope**. When the browser encounters the second `const API_URL` declaration in `script.js`, it throws:

```
Uncaught SyntaxError: Identifier 'API_URL' has already been declared
```

This **kills the entire `script.js` file** -- none of its code executes. As a result:

| Feature | Why it breaks |
|---------|---------------|
| No orders listed | `fetchOrders()` is defined in `script.js` and called in its `DOMContentLoaded` handler (line 433). Never runs. |
| Logout not working | The `click` event listener for `#logout-btn` is attached in `script.js:436-439`. Never runs. `handleLogout()` exists in `auth.js` but nothing wires it to the button. |
| No stats displayed | `updateStats()` is in `script.js`. Never runs. |
| No time displayed | `updateCurrentTime()` is in `script.js`. Never runs. |
| No auto-refresh | The `setInterval` calls are in `script.js`. Never run. |
| Filter buttons broken | `filterOrders()` is in `script.js`. Never runs. |

### Why Login Works
`login.html` only loads a single script:
```html
<script src="auth.js"></script>    <!-- line 106 -->
```
No conflict. `handleLogin()`, `setAuthToken()`, and the form listener all work fine.

### Suggested Fix
Remove `const API_URL` from `script.js` (since `auth.js` already declares it and is always loaded first), **or** move `API_URL` into a shared config file loaded before both.

---

## Pre-Test Setup

### Prerequisites
1. Docker is installed and running
2. Node.js (v18+) and npm are installed
3. PostgreSQL container is running via `docker-compose`

### Starting the Database
```bash
cd database/
docker compose up -d
```
Verify the container is running:
```bash
docker ps | grep oos_postgres
```
Expected: A running container named `oos_postgres` on port 5432.

### Applying the Schema
The `docker-compose.yml` does **not** auto-load `init.sql` (it's missing the volume mount to `/docker-entrypoint-initdb.d/`). You must apply it manually:
```bash
docker exec -i oos_postgres psql -U oos_admin -d oos_db < database/init.sql
```
Verify tables exist:
```bash
docker exec -it oos_postgres psql -U oos_admin -d oos_db -c "\dt"
```
Expected: Tables `products`, `orders`, `order_items`.

### Seeding Sample Data
Run the sample products script:
```bash
cd backend/
node ../aux/add-sample-products.js
```
Verify products were inserted:
```bash
docker exec -it oos_postgres psql -U oos_admin -d oos_db -c "SELECT * FROM products;"
```
Expected: A list of bakery products with names, prices, and IDs.

### Starting the Backend
```bash
cd backend/
npm install
npm run dev
```
Expected output:
```
🎂 ========================================
   BAKERY ORDERING SYSTEM API
   Status: ✅ Running
   Port: 3000
```

### Verifying the Backend
```bash
curl http://localhost:3000/api/health
```
Expected:
```json
{"status":"OK","message":"Bakery API is running","timestamp":"..."}
```

---

## Test Suite 1: Database & Schema

### TEST 1.1 - Products table structure
```bash
docker exec -it oos_postgres psql -U oos_admin -d oos_db -c "\d products"
```
**Verify:**
- `product_id` is `SERIAL PRIMARY KEY`
- `product_name` is `VARCHAR(100) NOT NULL UNIQUE`
- `price` is `DECIMAL(10,2) NOT NULL` with `CHECK (price > 0)`
- `created_at` is `TIMESTAMP` with default `CURRENT_TIMESTAMP`

### TEST 1.2 - Orders table structure
```bash
docker exec -it oos_postgres psql -U oos_admin -d oos_db -c "\d orders"
```
**Verify:**
- `order_id` is `SERIAL PRIMARY KEY`
- `status` defaults to `'pending'` and has CHECK constraint for `('pending','completed','cancelled')`
- `total_amount` has `CHECK (total_amount > 0)`
- `customer_name`, `customer_phone`, `customer_email` are all `NOT NULL`

### TEST 1.3 - Order items foreign keys
```bash
docker exec -it oos_postgres psql -U oos_admin -d oos_db -c "\d order_items"
```
**Verify:**
- `order_id` references `orders(order_id)` with `ON DELETE CASCADE`
- `product_id` references `products(product_id)` with `ON DELETE RESTRICT`

### TEST 1.4 - Cascade delete works
```sql
-- Insert a test order, then delete it and verify items are removed
INSERT INTO orders (customer_name, customer_phone, customer_email, total_amount)
VALUES ('Test User', '555-0000', 'test@test.com', 10.00);

-- Note the order_id returned, then:
INSERT INTO order_items (order_id, product_id, quantity, unit_price)
VALUES (<order_id>, 1, 1, 10.00);

DELETE FROM orders WHERE order_id = <order_id>;

-- Verify order_items row is also gone:
SELECT * FROM order_items WHERE order_id = <order_id>;
```
**Expected:** Empty result set.

### TEST 1.5 - Restrict delete on products
```sql
-- Try to delete a product that has order_items referencing it
DELETE FROM products WHERE product_id = 1;
```
**Expected:** Error if any order_items reference product_id 1. The `ON DELETE RESTRICT` should prevent it.

### TEST 1.6 - Schema idempotency
Run `init.sql` a second time:
```bash
docker exec -i oos_postgres psql -U oos_admin -d oos_db < database/init.sql
```
**Expected:** `products` table succeeds (has `IF NOT EXISTS`). `orders` and `order_items` will **fail** because they lack `IF NOT EXISTS`. This is a known issue.

---

## Test Suite 2: Products API

### TEST 2.1 - GET /api/products (list all)
```bash
curl -s http://localhost:3000/api/products | python3 -m json.tool
```
**Verify:**
- Returns a JSON array
- Each product has `product_id`, `product_name`, `price`, `created_at`
- `price` is a number (not a string)
- Products are sorted alphabetically by `product_name`

### TEST 2.2 - GET /api/products/:id (single product)
```bash
curl -s http://localhost:3000/api/products/1 | python3 -m json.tool
```
**Verify:**
- Returns a single product object
- `price` is a number

### TEST 2.3 - GET /api/products/:id (not found)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:3000/api/products/99999
```
**Expected:** HTTP 404 with `{"error":"Product not found",...}`

### TEST 2.4 - GET /api/products/:id (invalid ID)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:3000/api/products/abc
```
**Expected:** HTTP 400 with `{"error":"Invalid product ID",...}`

### TEST 2.5 - GET /api/products/:id (negative ID)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:3000/api/products/-1
```
**Expected:** HTTP 404 (or 400). Note: the route uses `parseInt` which will parse `-1` as a valid number, and the query will return no results. Check whether this returns 404 gracefully.

### TEST 2.6 - Products with no data
If the products table is empty:
```bash
docker exec -it oos_postgres psql -U oos_admin -d oos_db -c "DELETE FROM products;"
curl -s http://localhost:3000/api/products
```
**Expected:** Returns `[]` (empty array), not an error.
**Cleanup:** Re-seed products after this test.

---

## Test Suite 3: Authentication API

### TEST 3.1 - POST /api/auth/login (valid credentials)
```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rob","password":"<actual_password>"}' | python3 -m json.tool
```
**Note:** The `.env` has duplicate entries. `dotenv` uses the **last** value, so `ADMIN_USERNAME=rob` (line 14) is active. You need to know the plaintext password that corresponds to the hash on line 15.

**Verify:**
- HTTP 200
- Response has `success: true`, `token`, `username`, `expiresIn: "8h"`
- Token is a valid JWT (three dot-separated base64 segments)

### TEST 3.2 - POST /api/auth/login (wrong password)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rob","password":"wrongpassword"}'
```
**Expected:** HTTP 401 with `{"success":false,"error":"Invalid credentials",...}`

### TEST 3.3 - POST /api/auth/login (wrong username)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"notadmin","password":"anything"}'
```
**Expected:** HTTP 401. Verify the error message does NOT reveal whether the username or password was wrong (it should say "Username or password is incorrect", which is good).

### TEST 3.4 - POST /api/auth/login (missing fields)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rob"}'
```
**Expected:** HTTP 400 with `"Username and password are required"`

```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{}'
```
**Expected:** HTTP 400.

### TEST 3.5 - POST /api/auth/login (empty body)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d ''
```
**Expected:** Should not crash the server. Should return 400.

### TEST 3.6 - GET /api/auth/verify (valid token)
```bash
TOKEN="<token_from_test_3.1>"
curl -s http://localhost:3000/api/auth/verify \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```
**Expected:** HTTP 200 with `{"success":true,"user":{"username":"rob","admin":true}}`

### TEST 3.7 - GET /api/auth/verify (no token)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:3000/api/auth/verify
```
**Expected:** HTTP 401 with `"Authentication token required"`

### TEST 3.8 - GET /api/auth/verify (invalid token)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:3000/api/auth/verify \
  -H "Authorization: Bearer invalidtoken123"
```
**Expected:** HTTP 403 with `"Authentication token is invalid"`

### TEST 3.9 - GET /api/auth/verify (expired token)
To test this, you would need to generate a token with a very short expiry, or manipulate the system clock. Alternatively, modify the `expiresIn` temporarily to `'1s'`, login, wait 2 seconds, then verify.

**Expected:** HTTP 401 with `"Your session has expired. Please login again."`

### TEST 3.10 - GET /api/auth/status (no token)
```bash
curl -s http://localhost:3000/api/auth/status | python3 -m json.tool
```
**Expected:** HTTP 200 with `{"authenticated":false,"message":"No token provided"}`

### TEST 3.11 - GET /api/auth/status (valid token)
```bash
curl -s http://localhost:3000/api/auth/status \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```
**Expected:** HTTP 200 with `{"authenticated":true,"username":"rob"}`

### TEST 3.12 - POST /api/auth/logout (valid token)
```bash
curl -s -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```
**Expected:** HTTP 200 with `{"success":true,"message":"Logout successful"}`

**Important note:** This endpoint does NOT actually invalidate the token. After calling logout, the same token is still valid for API calls. This is a known limitation of stateless JWT auth without a blacklist.

### TEST 3.13 - Brute force susceptibility
```bash
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"rob","password":"wrong'$i'"}'
done
```
**Expected (current behavior):** All 20 requests return 401 with no rate limiting or lockout. This is a **security vulnerability** -- there is no protection against brute-force attacks.

### TEST 3.14 - Duplicate .env credentials confusion
Check which credentials are actually active:
```bash
# In the backend directory, run:
node -e "require('dotenv').config(); console.log('Active username:', process.env.ADMIN_USERNAME); console.log('Active JWT_SECRET first 10 chars:', process.env.JWT_SECRET.substring(0,10));"
```
**Expected:** Should show `rob` (second entry, line 14) and the JWT_SECRET from line 16 (starting with `%2B60!`). The first set of credentials (admin / line 10-12) is silently overridden.

---

## Test Suite 4: Orders API

### TEST 4.1 - POST /api/orders (valid order)
```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John Doe",
    "customer_phone": "555-1234",
    "customer_email": "john@example.com",
    "notes": "Extra frosting please",
    "items": [
      {"product_id": 1, "quantity": 2},
      {"product_id": 2, "quantity": 1}
    ]
  }' | python3 -m json.tool
```
**Verify:**
- HTTP 201
- Response includes `order_id`, `total_amount` (calculated from DB prices, not client-supplied), `status: "pending"`
- `items` array includes `product_name` and `unit_price` from the database
- **Important:** `total_amount` should equal the sum of (unit_price * quantity) for each item

### TEST 4.2 - POST /api/orders (missing required fields)
```bash
# Missing customer_email
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John",
    "customer_phone": "555-1234",
    "items": [{"product_id": 1, "quantity": 1}]
  }'
```
**Expected:** HTTP 400 with `"customer_name, customer_phone, and customer_email are required"`

### TEST 4.3 - POST /api/orders (empty items array)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John",
    "customer_phone": "555-1234",
    "customer_email": "john@example.com",
    "items": []
  }'
```
**Expected:** HTTP 400 with `"items must be a non-empty array"`

### TEST 4.4 - POST /api/orders (invalid product_id)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John",
    "customer_phone": "555-1234",
    "customer_email": "john@example.com",
    "items": [{"product_id": 99999, "quantity": 1}]
  }'
```
**Expected:** HTTP 404 with `"Products not found: 99999"`

### TEST 4.5 - POST /api/orders (invalid quantity)
```bash
# Zero quantity
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John",
    "customer_phone": "555-1234",
    "customer_email": "john@example.com",
    "items": [{"product_id": 1, "quantity": 0}]
  }'
```
**Expected:** HTTP 400 with `"Each item must have a valid positive integer quantity"`

```bash
# Negative quantity
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John",
    "customer_phone": "555-1234",
    "customer_email": "john@example.com",
    "items": [{"product_id": 1, "quantity": -5}]
  }'
```
**Expected:** HTTP 400.

### TEST 4.6 - POST /api/orders (non-integer quantity)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John",
    "customer_phone": "555-1234",
    "customer_email": "john@example.com",
    "items": [{"product_id": 1, "quantity": 1.5}]
  }'
```
**Expected:** HTTP 400. `Number.isInteger(1.5)` is `false`, so the validation should catch this.

### TEST 4.7 - POST /api/orders (string product_id)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John",
    "customer_phone": "555-1234",
    "customer_email": "john@example.com",
    "items": [{"product_id": "abc", "quantity": 1}]
  }'
```
**Expected:** HTTP 400 with `"Each item must have a valid positive integer product_id"`

### TEST 4.8 - POST /api/orders (ordering hours validation)
This test depends on the **current time**. The code at `validateTime.js:11` checks:
```javascript
if (currentHour < 6 || currentHour >= 23)
```

But the error message says "6:00 AM - 6:00 PM". This is a **known bug** -- the code allows orders until 11 PM but the message claims 6 PM.

**To test the restriction:** Change your system clock to 3:00 AM (or test between 11 PM and 6 AM), then attempt to place an order.

```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John",
    "customer_phone": "555-1234",
    "customer_email": "john@example.com",
    "items": [{"product_id": 1, "quantity": 1}]
  }'
```
**Expected (outside hours):** HTTP 400 with `"Orders can only be placed between 6:00 AM and 6:00 PM"` and `ordering_hours: "6:00 AM - 6:00 PM"`.

**Bug to verify:** Try ordering at 7 PM (19:00). The code will **allow** it (19 < 23) but the message says it shouldn't be allowed after 6 PM.

### TEST 4.9 - POST /api/orders (no notes)
```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Jane",
    "customer_phone": "555-5678",
    "customer_email": "jane@example.com",
    "items": [{"product_id": 1, "quantity": 1}]
  }' | python3 -m json.tool
```
**Verify:** Order is created successfully with `notes: null` (not `notes: undefined` or missing).

### TEST 4.10 - POST /api/orders (duplicate products in items)
```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test",
    "customer_phone": "555-0000",
    "customer_email": "test@test.com",
    "items": [
      {"product_id": 1, "quantity": 2},
      {"product_id": 1, "quantity": 3}
    ]
  }' | python3 -m json.tool
```
**Verify:** Does the order create with two separate line items for the same product? Or does it combine them? Current code does NOT merge duplicates -- it will create two `order_items` rows for the same product. Check that `total_amount` is correct (5 * unit_price_of_product_1).

### TEST 4.11 - POST /api/orders (XSS in customer_name)
```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "<script>alert(\"xss\")</script>",
    "customer_phone": "555-0000",
    "customer_email": "test@test.com",
    "items": [{"product_id": 1, "quantity": 1}]
  }' | python3 -m json.tool
```
**Verify:** The order is created (backend does not sanitize). The risk is that this script tag will be rendered **unescaped** in the admin dashboard's `createOrderCard()` function (`admin/script.js:143`), causing XSS.

### TEST 4.12 - POST /api/orders (very long customer_name)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_name\": \"$(python3 -c "print('A' * 200)")\",
    \"customer_phone\": \"555-0000\",
    \"customer_email\": \"test@test.com\",
    \"items\": [{\"product_id\": 1, \"quantity\": 1}]
  }"
```
**Expected:** Should fail because `customer_name` is `VARCHAR(100)` in the DB. Check whether the error is handled gracefully (500) or if it crashes.

### TEST 4.13 - POST /api/orders (invalid email format)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John",
    "customer_phone": "555-1234",
    "customer_email": "not-an-email",
    "items": [{"product_id": 1, "quantity": 1}]
  }'
```
**Expected (current behavior):** HTTP 201 -- the order is created successfully because **the backend does not validate email format**. Only the frontend validates it. This is a known gap.

### TEST 4.14 - POST /api/orders (SQL injection attempt)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Robert'); DROP TABLE orders;--",
    "customer_phone": "555-1234",
    "customer_email": "test@test.com",
    "items": [{"product_id": 1, "quantity": 1}]
  }'
```
**Expected:** Order is created safely. The customer_name is stored as the literal string `Robert'); DROP TABLE orders;--`. Parameterized queries ($1, $2) protect against SQL injection. Verify the orders table still exists after this.

### TEST 4.15 - GET /api/orders (requires auth)
```bash
# Without token
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:3000/api/orders
```
**Expected:** HTTP 401 with `"Authentication token required"`

```bash
# With valid token
curl -s http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```
**Expected:** HTTP 200 with array of orders, sorted by `order_date DESC`.

### TEST 4.16 - GET /api/orders?status=pending (filter)
```bash
curl -s "http://localhost:3000/api/orders?status=pending" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```
**Verify:** All returned orders have `status: "pending"`.

### TEST 4.17 - GET /api/orders?status=invalid (bad filter)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" "http://localhost:3000/api/orders?status=shipped" \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** HTTP 400 with `"status must be one of: pending, completed, cancelled"`

### TEST 4.18 - GET /api/orders/:id (single order with items)
```bash
curl -s http://localhost:3000/api/orders/1 \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```
**Verify:**
- Returns order details with `customer_name`, `customer_phone`, `customer_email`, `order_date`, `total_amount`, `status`, `notes`
- Includes `items` array with `item_id`, `product_id`, `product_name`, `quantity`, `unit_price`, `subtotal`
- `subtotal` equals `quantity * unit_price` for each item
- `total_amount` is a number, not a string

### TEST 4.19 - GET /api/orders/:id (not found)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:3000/api/orders/99999 \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** HTTP 404.

### TEST 4.20 - PATCH /api/orders/:id/status (mark completed)
```bash
curl -s -X PATCH http://localhost:3000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"completed"}' | python3 -m json.tool
```
**Expected:** HTTP 200 with `{"success":true,"message":"Order status updated to completed","order":{"order_id":1,"status":"completed"}}`

### TEST 4.21 - PATCH /api/orders/:id/status (mark cancelled)
```bash
curl -s -X PATCH http://localhost:3000/api/orders/2/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"cancelled"}' | python3 -m json.tool
```
**Expected:** HTTP 200.

### TEST 4.22 - PATCH /api/orders/:id/status (invalid status)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X PATCH http://localhost:3000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"shipped"}'
```
**Expected:** HTTP 400 with `"status must be one of: pending, completed, cancelled"`

### TEST 4.23 - PATCH /api/orders/:id/status (no auth)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X PATCH http://localhost:3000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}'
```
**Expected:** HTTP 401.

### TEST 4.24 - PATCH /api/orders/:id/status (missing status in body)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X PATCH http://localhost:3000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}'
```
**Expected:** HTTP 400.

### TEST 4.25 - Order state transitions
Test whether you can go from `completed` back to `pending`:
```bash
# First mark as completed
curl -s -X PATCH http://localhost:3000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"completed"}'

# Then try to revert to pending
curl -s -w "\nHTTP Status: %{http_code}\n" -X PATCH http://localhost:3000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"pending"}'
```
**Expected (current behavior):** HTTP 200 -- the code allows **any** valid status transition, including backwards ones. There is no state machine enforcement. Consider whether this is desired.

### TEST 4.26 - Transaction rollback
Test that a partially failing order doesn't leave orphan records:
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test",
    "customer_phone": "555-0000",
    "customer_email": "test@test.com",
    "items": [
      {"product_id": 1, "quantity": 1},
      {"product_id": 99999, "quantity": 1}
    ]
  }'
```
**Expected:** HTTP 404 (product not found). Then verify no partial order was created:
```bash
docker exec -it oos_postgres psql -U oos_admin -d oos_db -c \
  "SELECT * FROM orders WHERE customer_name = 'Test' ORDER BY order_id DESC LIMIT 1;"
```
**Expected:** No new order for "Test" from this request (transaction was rolled back).

---

## Test Suite 5: Miscellaneous API

### TEST 5.1 - GET /api/health
```bash
curl -s http://localhost:3000/api/health | python3 -m json.tool
```
**Verify:** Returns `{"status":"OK","message":"Bakery API is running","timestamp":"..."}` with HTTP 200.

### TEST 5.2 - 404 handler
```bash
curl -s http://localhost:3000/api/nonexistent | python3 -m json.tool
```
**Verify:** Returns HTTP 404 with `available_routes` listing all endpoints.

### TEST 5.3 - Request logging
After making any request, check the server console output.
**Verify:** Logs show `<timestamp> - <METHOD> <path>` for every request (server.js:30-33).

### TEST 5.4 - CORS headers
```bash
curl -s -I -X OPTIONS http://localhost:3000/api/products \
  -H "Origin: http://evil-site.com" \
  -H "Access-Control-Request-Method: GET"
```
**Expected (current behavior):** Response includes `Access-Control-Allow-Origin: *`. This is a **security concern** -- any origin can make requests.

### TEST 5.5 - Large JSON body
```bash
python3 -c "import json; print(json.dumps({'customer_name':'A','customer_phone':'B','customer_email':'c@d.com','items':[{'product_id':1,'quantity':1}]*10000}))" | \
  curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:3000/api/orders \
    -H "Content-Type: application/json" \
    -d @-
```
**Expected:** Should either succeed (creating 10,000 order items) or be rejected by Express body-parser's default 100KB limit. Check whether the server handles this gracefully without crashing.

---

## Test Suite 6: Customer Frontend

### TEST 6.1 - Page load
Open `frontend/customer/index.html` in a browser (you need to serve it or open directly).
**Verify:**
- Header shows "Sweet Delights Bakery" with opening hours
- Loading spinner appears briefly
- Products grid loads with product cards (name + price)
- Shopping cart shows "Your cart is empty"
- Footer is visible at the bottom

### TEST 6.2 - Products display
**Verify:**
- Each product card shows the product name and price formatted as `$X.XX`
- Each card has an "+ Add to Cart" button
- Products are displayed in a 3-column grid (on desktop)

### TEST 6.3 - Add to cart
Click "+ Add to Cart" on any product.
**Verify:**
- Button transforms into a quantity stepper (- 1 +)
- Cart section updates to show the item
- Total is displayed correctly
- "Continue to Checkout" button appears
- Toast notification says "X added to cart!"

### TEST 6.4 - Increment/decrement quantity
Use the +/- stepper buttons.
**Verify:**
- Quantity increases/decreases correctly
- Cart total recalculates
- When quantity reaches 0, item is removed from cart and stepper reverts to "Add to Cart" button

### TEST 6.5 - Remove from cart
Click "Remove" link next to a cart item.
**Verify:**
- Item is removed from the cart
- Product card stepper reverts to "Add to Cart" button
- If cart is now empty, "Your cart is empty" message appears and checkout button disappears

### TEST 6.6 - Checkout flow
Add items to cart, then click "Continue to Checkout".
**Verify:**
- Cart items are hidden
- Checkout form appears with fields: Name, Phone, Email, Special Instructions
- Total amount is displayed
- "Place Order" and "Back to Cart" buttons are visible

### TEST 6.7 - Back to cart
From checkout view, click "Back to Cart".
**Verify:**
- Cart items reappear
- Checkout form is hidden
- Cart items are preserved

### TEST 6.8 - Form validation
Try submitting with empty fields.
**Verify:**
- Empty name: field gets red border, error message appears
- Empty phone: field gets red border, error message appears
- Invalid email (e.g., "abc"): field gets red border, error message appears
- Toast shows "Please fill in all required fields"

### TEST 6.9 - Place order (success)
Fill in all fields correctly and submit.
**Verify:**
- Button text changes to "Placing Order..."
- Button is disabled during submission
- On success: success view appears with order number and total
- Toast says "Order placed successfully!"
- "Place Another Order" button is visible

### TEST 6.10 - Place another order
After a successful order, click "Place Another Order".
**Verify:**
- Cart view returns (empty)
- Products are still displayed
- Can add new items and repeat the flow

### TEST 6.11 - Place order (server down)
Stop the backend server, then try to place an order.
**Verify:**
- Error toast appears with a meaningful message
- Button re-enables and text reverts to "Place Order"
- App doesn't crash or become unresponsive

### TEST 6.12 - Products fail to load
Stop the backend server, then refresh the page.
**Verify:**
- Loading spinner appears, then disappears
- Error message appears: "Could not load products. Please make sure the server is running."
- Product grid remains hidden

### TEST 6.13 - Cart persistence (expected to fail)
Add items to cart, then refresh the page.
**Expected (current behavior):** Cart is lost. There is no localStorage/sessionStorage persistence. All items are gone and products grid reloads with all "Add to Cart" buttons.

### TEST 6.14 - XSS protection in product names
If a product name contains HTML (e.g., `<b>Bold Product</b>`), verify it's displayed as plain text, not rendered as HTML.
**Verify:** The `escapeHtml()` function in `customer/script.js:390-394` should prevent this.

### TEST 6.15 - Responsive design
Resize the browser to mobile widths (< 480px).
**Verify:**
- Products grid collapses to 1 column
- Cart section stacks below the products
- All text is readable, no horizontal scrolling

### TEST 6.16 - Ordering outside business hours
If testing between 11 PM and 6 AM (the actual restriction window, not the displayed one):
**Verify:**
- Order submission fails
- Error message is displayed
- Note the mismatch: error says "6 AM - 6 PM" but the actual window is "6 AM - 11 PM"

---

## Test Suite 7: Admin Frontend

> **IMPORTANT:** Tests 7.1-7.14 assume the `const API_URL` bug (described at the top of this document) has been fixed. Without the fix, all dashboard functionality is broken.

### TEST 7.1 - Login page load
Open `frontend/admin/login.html`.
**Verify:**
- Centered login card with gradient background
- Username and password fields
- Login button
- "Sweet Delights Bakery" text

### TEST 7.2 - Login (valid credentials)
Enter valid admin credentials and submit.
**Verify:**
- Button changes to "Logging in..."
- On success: redirected to `index.html` (admin dashboard)
- Token is stored in `localStorage` (check browser DevTools > Application > Local Storage)

### TEST 7.3 - Login (invalid credentials)
Enter wrong username or password.
**Verify:**
- Error message appears: "Username or password is incorrect"
- Button re-enables
- No token is stored

### TEST 7.4 - Login (server down)
Stop the backend, then try to login.
**Verify:**
- Error message appears: "Unable to connect to server. Please try again."
- Button re-enables

### TEST 7.5 - Already logged in redirect
While logged in (token in localStorage), navigate to `login.html`.
**Verify:**
- Should be redirected to `index.html` automatically (if token is still valid)

### TEST 7.6 - Dashboard load (authenticated)
Navigate to `index.html` while logged in.
**Verify:**
- Header shows "Admin Dashboard" with username, current time, and logout button
- Stats cards show Total Orders, Pending Orders, Completed Today
- Filter buttons: All Orders, Pending, Completed, Cancelled
- Orders list loads with order cards

### TEST 7.7 - Dashboard load (unauthenticated)
Clear localStorage and navigate to `index.html`.
**Verify:**
- Redirected to `login.html`
- **Note:** The HTML content may briefly flash before the JS redirect fires. This is a known UX issue.

### TEST 7.8 - Dashboard load (expired token)
Set an expired/invalid token in localStorage, then navigate to `index.html`.
**Verify:**
- `requireAuth()` calls `verifyToken()` which fails
- Token is cleared from localStorage
- Redirected to `login.html`

### TEST 7.9 - Orders display
**Verify:**
- Each order card shows: order ID, customer name, phone, status badge (color-coded), date, total amount
- Pending orders have "Mark Completed" and "Cancel" buttons
- Completed/cancelled orders do NOT show these action buttons

### TEST 7.10 - View order details
Click "View Details" on an order card.
**Verify:**
- Details section expands below the card
- Shows customer info (name, phone, email, notes if any)
- Shows order items with product name, quantity, unit price, subtotal
- Shows total
- Clicking "View Details" again collapses the section

### TEST 7.11 - Mark order as completed
Click "Mark Completed" on a pending order.
**Verify:**
- Confirmation dialog appears
- On confirm: order status updates, badge changes to green "COMPLETED"
- Action buttons disappear
- Stats update
- Toast shows success message

### TEST 7.12 - Cancel order
Click "Cancel" on a pending order.
**Verify:**
- Confirmation dialog appears
- On confirm: order status updates, badge changes to red "CANCELLED"
- Action buttons disappear
- Stats update

### TEST 7.13 - Filter orders
Click each filter button.
**Verify:**
- "All Orders" shows all orders
- "Pending" shows only pending orders
- "Completed" shows only completed orders
- "Cancelled" shows only cancelled orders
- Active filter button is visually highlighted
- Empty state message appears if no orders match the filter

### TEST 7.14 - Stats accuracy
**Verify:**
- "Total Orders" matches the count of all orders
- "Pending Orders" matches the count of pending orders
- "Completed Today" -- **Known bug:** this actually counts ALL completed orders, not just today's. The label is misleading. Check `admin/script.js:350` -- it filters by `status === 'completed'` with no date check.

### TEST 7.15 - Auto-refresh
Wait 30 seconds on the dashboard.
**Verify:**
- Orders refresh automatically (check network tab in DevTools)
- New orders appear without manual refresh
- Stats update

### TEST 7.16 - Current time display
**Verify:**
- Time is displayed in the header
- Updates every second

### TEST 7.17 - Logout
Click the "Logout" button.
**Verify:**
- Redirected to `login.html`
- Token is removed from localStorage
- Cannot access `index.html` without logging in again

### TEST 7.18 - Session expiry during use
While on the dashboard, manually delete the token from localStorage (simulating expiry), then click "Refresh" or wait for auto-refresh.
**Verify:**
- API call returns 401
- Redirected to `login.html`

### TEST 7.19 - XSS in order details
Create an order with a malicious customer name (see TEST 4.11), then view it in the admin dashboard.
**Verify (current behavior):**
- In `createOrderCard()` (`admin/script.js:143`), `order.customer_name` is inserted via template literal **without** `escapeHtml()`. The `<script>` tag in the customer name **will execute** -- this is a confirmed XSS vulnerability.
- In `viewOrderDetails()` (`admin/script.js:228`), `order.customer_name` is also unescaped.
- Only `order.notes` uses `escapeHtml()` (line 230).

### TEST 7.20 - Multiple simultaneous actions
Rapidly click "Mark Completed" on multiple orders.
**Verify:**
- Each action triggers a separate API call
- No race conditions or UI glitches
- All orders update correctly
- Stats reflect all changes

---

## Test Suite 8: End-to-End Workflows

### TEST 8.1 - Full customer order flow
1. Open customer frontend
2. Browse products
3. Add 3 different products to cart with varying quantities
4. Proceed to checkout
5. Fill in customer details
6. Place order
7. Note the order ID

**Verify:** Order is created with correct items and total.

### TEST 8.2 - Admin processes the order
1. Open admin frontend, log in
2. Find the order from TEST 8.1
3. View details -- verify items match
4. Mark as completed

**Verify:** Order shows as completed in both the list and details view.

### TEST 8.3 - Multiple customers, simultaneous orders
Open two browser tabs with the customer frontend. Place orders in rapid succession.

**Verify:**
- Both orders are created with unique order IDs
- No data corruption or mixing of order items
- Both appear in the admin dashboard

### TEST 8.4 - Order with all products
Add every available product to the cart (one of each), then place an order.

**Verify:**
- Order is created successfully
- Total is the sum of all product prices
- All items appear in admin order details

### TEST 8.5 - Admin filters after status changes
1. Create 3 orders
2. Mark one as completed, one as cancelled, leave one pending
3. Use filter buttons

**Verify:**
- "Pending" filter shows 1 order
- "Completed" filter shows 1 order
- "Cancelled" filter shows 1 order
- "All" filter shows 3 orders

---

## Summary of Known Bugs Found

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| 1 | **CRITICAL** | `auth.js:6` + `script.js:5` | `const API_URL` redeclaration crashes admin dashboard |
| 2 | **HIGH** | `admin/script.js:143,228` | XSS via unescaped customer name/phone in admin UI |
| 3 | **MEDIUM** | `validateTime.js:11` | Code allows orders until 11 PM, message says 6 PM |
| 4 | **MEDIUM** | `admin/script.js:350` | "Completed Today" counts all completed orders, not today's |
| 5 | **LOW** | `backend/.env:10-16` | Duplicate env vars; first set silently ignored |
| 6 | **LOW** | `orderRoutes.js` | No backend email validation |
| 7 | **LOW** | Customer frontend | Cart not persisted across page refresh |
| 8 | **INFO** | `admin/index.html` | HTML flashes briefly before auth redirect |
