# Admin Dashboard Audit: Counters, Filters & Removal Guide

## Part 1: Diagnosing the Problems

### Problem A: Stats counters always show 0

**Root cause: `const API_URL` redeclaration (the known bug)**

`auth.js:6` declares `const API_URL = 'http://localhost:3000/api'`, and `script.js:5` has the same declaration commented out (`//const API_URL = ...`). This was the original fatal bug — if the comment was ever removed or if the file is reverted, `script.js` would crash entirely due to `const` redeclaration in the same global scope.

However, assuming line 5 of `script.js` is currently commented out (as it is now), the counters problem has a **different cause**: the `updateStats()` function.

**Trace the flow:**

1. `index.html` loads `auth.js` (line 110), then `script.js` (line 111)
2. `script.js` immediately runs the `checkAuth()` IIFE (line 12) which calls `requireAuth()` — this is an **async** function that makes a network call to `/api/auth/verify`
3. Meanwhile, the browser continues and fires `DOMContentLoaded`, which calls `fetchOrders()` (line 454)
4. `fetchOrders()` calls `updateStats()` at line 126 after orders load

**The `updateStats()` function (lines 350-380) makes a SECOND fetch call to `GET /api/orders`** (separate from the one `fetchOrders()` already made). This is redundant — it fetches the exact same data again just to count statuses. But the real issue is:

**`updateStats()` always fetches ALL orders (no filter), counts them, and updates the DOM.** This part should work IF the dashboard loads at all. If the counters show 0, it means one of:

- The `script.js` file crashed before `updateStats` could run (the `const API_URL` bug — verify line 5 is commented out)
- The `/api/orders` endpoint returned an empty array (no orders in the DB)
- The auth token was invalid, triggering the redirect at line 362-365 before the counts could be set

**How to verify which cause it is:**

1. Open the browser DevTools (F12) → Console tab
2. Navigate to the admin dashboard after logging in
3. Look for:
   - `SyntaxError: Identifier 'API_URL' has already been declared` → the const bug is back
   - `Authentication failed, redirecting to login...` → token issue
   - `Error updating stats:` → network or server error
   - No errors at all → the orders array is likely empty (no orders in DB)

4. Also check the Network tab:
   - Look for a `GET /api/orders` request from `updateStats()`
   - Check its response status and body
   - If you see TWO `GET /api/orders` requests (one from `fetchOrders`, one from `updateStats`), the function is running — check if the response body is empty

### Problem B: "Todos los Pedidos" filter button not working

The "Todos los Pedidos" button at `index.html:66` calls `filterOrders('all')`.

**Trace `filterOrders('all')` (script.js:333-344):**

```javascript
function filterOrders(filter) {
    currentFilter = filter;

    // Update active button
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

    // Fetch filtered orders
    fetchOrders(filter === 'all' ? null : filter);
}
```

This calls `fetchOrders(null)` which builds the URL without a `?status=` query param, fetching all orders. This should work.

**If the button doesn't visually respond or doesn't fetch:**

1. Same root cause check — if `script.js` crashed, `filterOrders` is never defined. The `onclick="filterOrders('all')"` would throw `ReferenceError: filterOrders is not defined` in the console.

2. If `script.js` is loading fine but the button still seems broken, it could be that:
   - The `active` CSS class isn't providing visual feedback (check `styles.css` for a `.btn-outline.active` rule — **there is none**). The `active` class is added/removed but there's no CSS rule to style `.btn-outline.active` differently from `.btn-outline`. The button "works" (fetches orders) but gives no visual indication of which filter is selected.

**How to verify:**

1. Open DevTools → Console
2. Click "Todos los Pedidos"
3. If you see `ReferenceError: filterOrders is not defined` → `script.js` crashed
4. If you see a network request to `/api/orders` succeed → the button works, it just has no active styling
5. Check DevTools → Elements, find the button, verify the `active` class is toggled

### Problem C: The `updateStats` double-fetch inefficiency

Even when working, `updateStats()` makes a **redundant API call**. Every time `fetchOrders()` runs (on load, on filter change, every 30 seconds via auto-refresh), it calls `updateStats()` which makes its own separate `GET /api/orders` call. This means:

- Every refresh = 2 API calls instead of 1
- Every 30-second auto-refresh = 2 API calls
- Every filter button click = 2 API calls

The stats could be computed from the data already fetched by `fetchOrders()` instead of making a second request.

---

## Part 2: How to Fix These Issues (Manual Guide)

### Fix 1: Ensure `const API_URL` is not redeclared

**File:** `frontend/admin/script.js`
**Line:** 5

Verify that line 5 is commented out:
```javascript
//const API_URL = 'http://localhost:3000/api';
```

If it says `const API_URL = ...` without the `//`, comment it out or delete the line. `auth.js` already declares it, and since `auth.js` loads first, `script.js` inherits it from the global scope.

### Fix 2: Add `.btn-outline.active` CSS rule

**File:** `frontend/admin/styles.css`

The filter buttons use `btn-outline` class and toggle an `active` class, but there is no CSS rule to visually distinguish the active state. Add this rule after the existing `.btn-outline:hover` block:

```css
.btn-outline.active {
    background-color: var(--primary-color);
    color: var(--white);
}
```

Find the `.btn-outline:hover` rule (around line 315-318) and add the new rule right after it.

### Fix 3: Eliminate redundant API call in `updateStats()`

**File:** `frontend/admin/script.js`

Currently `updateStats()` (lines 350-380) makes its own `GET /api/orders` fetch. Instead, it should compute stats from the `orders` array that `fetchOrders()` already populated.

**Replace the entire `updateStats()` function with:**

```javascript
async function updateStats() {
    try {
        // When a filter is active, fetchOrders only has filtered data.
        // We need all orders for accurate stats, so make a separate call
        // only if a filter is active. Otherwise reuse the existing data.
        let allOrders;

        if (currentFilter !== 'all') {
            const token = getAuthToken();
            const response = await fetch(`${API_URL}/orders`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                clearAuthToken();
                window.location.href = 'login.html';
                return;
            }
            allOrders = await response.json();
        } else {
            allOrders = orders;
        }

        const total = allOrders.length;
        const pending = allOrders.filter(o => o.status === 'pending').length;
        const completed = allOrders.filter(o => o.status === 'completed').length;

        totalOrdersElement.textContent = total;
        pendingOrdersElement.textContent = pending;
        completedOrdersElement.textContent = completed;

    } catch (error) {
        console.error('Error updating stats:', error);
    }
}
```

This avoids the redundant call when viewing "Todos los Pedidos" (the most common case).

### Fix 4: "Completados Hoy" label is misleading

**File:** `frontend/admin/index.html`, line 59

The label says "Completados Hoy" but `updateStats()` counts ALL completed orders regardless of date. Either:

**Option A — Fix the label to match the behavior:**
Change line 59 from:
```html
<p class="text-muted">Completados Hoy</p>
```
to:
```html
<p class="text-muted">Completados</p>
```

**Option B — Fix the code to match the label:**
In the `updateStats()` function, replace the completed count logic with:
```javascript
const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
const completed = allOrders.filter(o =>
    o.status === 'completed' &&
    new Date(o.order_date).toISOString().split('T')[0] === today
).length;
```

---

## Part 3: How to Remove Stats Cards and "Todos los Pedidos" Button from the UI

The goal is to **hide these elements from the layout** without removing the backend computation or JS logic, so they can be re-enabled later.

### Step 1: Remove stats cards from HTML

**File:** `frontend/admin/index.html`

Delete or comment out lines 42-62 (the entire stats cards grid):

```html
        <!-- Stats Cards (HIDDEN - kept in JS for future use)
        <div class="grid grid-3 mb-4">
            <div class="card">
                <div class="card-body text-center">
                    <h3 id="total-orders" class="text-primary" style="font-size: 2.5rem; margin: 0;">0</h3>
                    <p class="text-muted">Total de Pedidos</p>
                </div>
            </div>
            <div class="card">
                <div class="card-body text-center">
                    <h3 id="pending-orders" class="text-secondary" style="font-size: 2.5rem; margin: 0;">0</h3>
                    <p class="text-muted">Pedidos Pendientes</p>
                </div>
            </div>
            <div class="card">
                <div class="card-body text-center">
                    <h3 id="completed-orders" style="font-size: 2.5rem; margin: 0; color: #4caf50;">0</h3>
                    <p class="text-muted">Completados Hoy</p>
                </div>
            </div>
        </div>
        -->
```

### Step 2: Remove "Todos los Pedidos" button from filter bar

**File:** `frontend/admin/index.html`

In the filter buttons section (lines 64-78), remove only the "Todos los Pedidos" button (lines 66-68). The remaining three filter buttons (Pendientes, Completados, Cancelados) stay.

Change from:
```html
        <div class="flex mb-3" style="gap: 1rem;">
            <button class="btn btn-outline active" data-filter="all" onclick="filterOrders('all')">
                Todos los Pedidos
            </button>
            <button class="btn btn-outline" data-filter="pending" onclick="filterOrders('pending')">
                Pendientes
            </button>
            <button class="btn btn-outline" data-filter="completed" onclick="filterOrders('completed')">
                Completados
            </button>
            <button class="btn btn-outline" data-filter="cancelled" onclick="filterOrders('cancelled')">
                Cancelados
            </button>
        </div>
```

To:
```html
        <div class="flex mb-3" style="gap: 1rem;">
            <!-- "Todos los Pedidos" button removed from UI; use Actualizar button to see all -->
            <button class="btn btn-outline" data-filter="pending" onclick="filterOrders('pending')">
                Pendientes
            </button>
            <button class="btn btn-outline" data-filter="completed" onclick="filterOrders('completed')">
                Completados
            </button>
            <button class="btn btn-outline" data-filter="cancelled" onclick="filterOrders('cancelled')">
                Cancelados
            </button>
        </div>
```

Note: The "Actualizar" button in the dashboard header already calls `fetchOrders()` with no filter (fetches all), so users can still see all orders by clicking that.

### Step 3: Prevent JS errors from missing DOM elements

**File:** `frontend/admin/script.js`

Since the stats card HTML elements (`total-orders`, `pending-orders`, `completed-orders`) are now commented out, `document.getElementById()` will return `null` for them. The `updateStats()` function will crash at line 373 when trying to set `.textContent` on `null`.

**Option A (recommended):** Add null checks to `updateStats()`. Replace lines 373-375:

```javascript
        totalOrdersElement.textContent = total;
        pendingOrdersElement.textContent = pending;
        completedOrdersElement.textContent = completed;
```

With:
```javascript
        if (totalOrdersElement) totalOrdersElement.textContent = total;
        if (pendingOrdersElement) pendingOrdersElement.textContent = pending;
        if (completedOrdersElement) completedOrdersElement.textContent = completed;
```

This keeps the computation running (the counts are still calculated) but silently skips updating the DOM when the elements don't exist. When you re-enable the stats cards later, just uncomment the HTML and everything will work again.

**Option B (minimal):** Comment out the `updateStats()` call in `fetchOrders()`. Change line 126:

```javascript
        // updateStats();
```

This stops the redundant API call entirely. When you want stats back, uncomment it. Downside: the computation is fully paused, not just hidden.

### Step 4: Handle the "all" filter default

Since the "Todos los Pedidos" button is removed but `currentFilter` still defaults to `'all'` and `fetchOrders()` is called with no filter on page load (line 454), the dashboard will still show all orders initially. This is correct — you just removed the button, not the behavior.

If you want the dashboard to default to showing only pending orders on load, change line 454:
```javascript
    fetchOrders('pending');
```
And set the initial state:
```javascript
let currentFilter = 'pending';
```
And add `active` class to the Pendientes button in the HTML:
```html
<button class="btn btn-outline active" data-filter="pending" onclick="filterOrders('pending')">
```

---

## Summary of Changes

| What to change | File | Lines | Action |
|---|---|---|---|
| Stats cards HTML | `admin/index.html` | 42-62 | Comment out the entire `<div class="grid grid-3 mb-4">` block |
| "Todos los Pedidos" button | `admin/index.html` | 66-68 | Delete or comment out the button element |
| Null-check stats DOM updates | `admin/script.js` | 373-375 | Add `if (element)` guards before `.textContent` assignments |
| (Optional) Active filter CSS | `admin/styles.css` | after ~318 | Add `.btn-outline.active` rule |
| (Optional) Default to pending | `admin/script.js` | 39, 454 | Change default filter to `'pending'` |

**What NOT to change:**
- Do not delete `updateStats()` function — keep it for future use
- Do not delete the stats DOM element constants (lines 72-74) — they'll just be `null` harmlessly
- Do not remove the `updateStats()` call from `fetchOrders()` if you want the data computed in the background
- Do not touch any backend code — the `/api/orders` endpoint stays as-is
