---
aliases:
  - Admin Mobile Responsive Guide
  - Admin Mobile Fix
tags:
  - frontend
  - css
  - responsive
  - mobile
  - admin
created: 2026-02-16
updated: 2026-02-16
---

# Mobile Responsive Guide — Admin Dashboard

This guide fixes the mobile layout for the admin panel at `https://bakery.jrobbl.com/admin`. The problems: header items overflow, order cards have action buttons that spill off-screen, and the order details two-column grid never collapses.

> [!info] Context
> This is the companion to [[mobile-responsive-guide]] (customer page). Same root causes — inline styles and missing `@media` breakpoints — but different elements.

---

## Problems on Mobile

| Element | Issue |
|---------|-------|
| **Header / logout button** | The `.nav-links` class inherits a hamburger-menu pattern from the base CSS that sets `position: absolute; opacity: 0; pointer-events: none` at 768px — this **hides the entire nav row** (time, username, logout) on mobile. There's no hamburger toggle in admin HTML, so the logout button simply vanishes. |
| **Empty state icons** | `📦` and `⚠️` are set to `font-size: 4rem` in the base CSS — far too large on mobile |
| **Header** | Logo "📋 Panel de Administración" + time + username + logout all on one row — overflows on mobile |
| **Dashboard header** | "Gestión de Pedidos" title + Actualizar button side by side, wraps badly |
| **Filter buttons** | Three buttons in a row with `gap: 1rem` — may overflow on small phones |
| **Order card top row** | `.flex-between`: order # + customer name left, badge + date right — cramped |
| **Order card bottom row** | Price left, 3 action buttons right (`Ver Detalles`, `Marcar Completado`, `Cancelar`) — buttons overflow off-screen |
| **Order details panel** | `.grid-2` with inline `gap: 2rem` — never collapses to single column |
| **Card hover effect** | `transform: translateY(-4px)` causes jumpy behavior on touch devices |

---

## Step 1 — Fix inline styles in `script.js`

The order details grid is built in JavaScript (`script.js` line 247). The inline `grid-2` with fixed gap needs a responsive class.

**File:** `frontend/admin/script.js`

**Find** (line 247):

```javascript
            <div class="grid grid-2" style="gap: 2rem;">
```

**Replace with:**

```javascript
            <div class="grid order-details-grid">
```

That's the only JS change.

---

## Step 2 — Fix inline styles in `index.html`

Two changes in this file.

**File:** `frontend/admin/index.html`

### 2a — Nav links: replace class to avoid hamburger-menu hide

The base CSS has a `@media (max-width: 768px)` rule on `.nav-links` that hides it (for the customer page hamburger menu). The admin page doesn't have a hamburger toggle, so the logout button, username, and time all vanish on mobile. Fix: use a different class name.

**Find** (line 17):

```html
                <div class="nav-links" style="display: flex; gap: 1rem; align-items: center;">
```

**Replace with:**

```html
                <div class="admin-nav-links">
```

### 2b — Filter buttons: remove inline gap

**Find** (line 66):

```html
        <div class="flex mb-3" style="gap: 1rem;">
```

**Replace with:**

```html
        <div class="flex filter-bar mb-3">
```

---

## Step 3 — Add responsive rules to admin CSS

**File:** `frontend/admin/styles.css`

Add the following block at the very end of the file:

```css
/* ============================================
   ADMIN DASHBOARD — RESPONSIVE LAYOUT
   ============================================ */

/* Order details: two columns on desktop */
.order-details-grid {
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
}

/* Filter bar: default gap */
.filter-bar {
    gap: 1rem;
}

/* Admin nav links: always visible (overrides base .nav-links hamburger-menu behavior) */
.admin-nav-links {
    display: flex;
    gap: 1rem;
    align-items: center;
}

/* ---- Tablet and below (768px) ---- */
@media (max-width: 768px) {

    /* Header: stack logo above nav items */
    .header .nav {
        flex-direction: column;
        gap: 0.75rem;
        padding: var(--spacing-sm) 0;
    }

    .header .logo {
        font-size: 1.25rem;
    }

    /* Admin nav links: compact on mobile */
    .admin-nav-links {
        width: 100%;
        justify-content: space-between;
        font-size: 0.8rem;
        gap: 0.5rem;
    }

    /* Dashboard header: stack title and refresh button */
    .flex-between.mb-4 {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
    }

    /* Filter bar: wrap if needed, smaller buttons */
    .filter-bar {
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .filter-bar .btn {
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
        flex: 1 1 auto;
        text-align: center;
    }

    /* Order cards: no hover lift on touch devices */
    .card:hover {
        transform: none;
    }

    /* Order card header: stack vertically */
    .card-body > .flex-between.mb-2 {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }

    /* Move badge + date to left-aligned under the name */
    .card-body > .flex-between.mb-2 > div[style*="text-align: right"] {
        text-align: left !important;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    /* Order card footer: stack price above buttons */
    .card-body > .flex-between[style*="border-top"] {
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
    }

    /* Action buttons: wrap into rows */
    .card-body > .flex-between[style*="border-top"] > div[style*="display: flex"] {
        flex-wrap: wrap;
        gap: 0.5rem !important;
    }

    .card-body > .flex-between[style*="border-top"] > div[style*="display: flex"] .btn {
        flex: 1 1 auto;
        text-align: center;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* Order details: single column */
    .order-details-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    /* Empty state icons: smaller on mobile */
    .empty-state-icon {
        font-size: 2.5rem;
    }

    /* Section padding: tighter */
    .section {
        padding: var(--spacing-lg) 0;
    }

    /* Toast: centered, not clipped on right edge */
    .toast {
        left: var(--spacing-sm);
        right: var(--spacing-sm);
        max-width: none;
        text-align: center;
    }
}

/* ---- Small phones (480px) ---- */
@media (max-width: 480px) {

    /* Tighter container padding */
    .container {
        padding: 0 var(--spacing-sm);
    }

    /* Hide the time display to save space */
    #current-time {
        display: none;
    }

    /* Filter buttons: full width, stacked */
    .filter-bar {
        flex-direction: column;
    }

    .filter-bar .btn {
        width: 100%;
    }

    /* Smaller card padding */
    .card-body {
        padding: var(--spacing-sm);
    }
}
```

---

## Step 4 — Deploy to VPS

Same approach as the customer page — these are static files served by nginx, no Docker rebuild needed.

### Option A: Edit directly on the VPS

```bash
ssh deploy@YOUR_VPS_IP
cd /home/deploy/oos
```

**Edit script.js** — fix the order details grid:

```bash
sed -i 's|<div class="grid grid-2" style="gap: 2rem;">|<div class="grid order-details-grid">|' frontend/admin/script.js
```

**Edit index.html** — fix nav-links class and filter bar:

```bash
sed -i 's|<div class="nav-links" style="display: flex; gap: 1rem; align-items: center;">|<div class="admin-nav-links">|' frontend/admin/index.html
sed -i 's|<div class="flex mb-3" style="gap: 1rem;">|<div class="flex filter-bar mb-3">|' frontend/admin/index.html
```

**Edit styles.css** — append the responsive rules:

```bash
cat >> frontend/admin/styles.css << 'CSSEOF'

/* ============================================
   ADMIN DASHBOARD — RESPONSIVE LAYOUT
   ============================================ */

/* Order details: two columns on desktop */
.order-details-grid {
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
}

/* Filter bar: default gap */
.filter-bar {
    gap: 1rem;
}

/* Admin nav links: always visible (overrides base .nav-links hamburger-menu behavior) */
.admin-nav-links {
    display: flex;
    gap: 1rem;
    align-items: center;
}

/* ---- Tablet and below (768px) ---- */
@media (max-width: 768px) {

    /* Header: stack logo above nav items */
    .header .nav {
        flex-direction: column;
        gap: 0.75rem;
        padding: var(--spacing-sm) 0;
    }

    .header .logo {
        font-size: 1.25rem;
    }

    /* Admin nav links: compact on mobile */
    .admin-nav-links {
        width: 100%;
        justify-content: space-between;
        font-size: 0.8rem;
        gap: 0.5rem;
    }

    /* Dashboard header: stack title and refresh button */
    .flex-between.mb-4 {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
    }

    /* Filter bar: wrap if needed, smaller buttons */
    .filter-bar {
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .filter-bar .btn {
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
        flex: 1 1 auto;
        text-align: center;
    }

    /* Order cards: no hover lift on touch devices */
    .card:hover {
        transform: none;
    }

    /* Order card header: stack vertically */
    .card-body > .flex-between.mb-2 {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }

    /* Move badge + date to left-aligned under the name */
    .card-body > .flex-between.mb-2 > div[style*="text-align: right"] {
        text-align: left !important;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    /* Order card footer: stack price above buttons */
    .card-body > .flex-between[style*="border-top"] {
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
    }

    /* Action buttons: wrap into rows */
    .card-body > .flex-between[style*="border-top"] > div[style*="display: flex"] {
        flex-wrap: wrap;
        gap: 0.5rem !important;
    }

    .card-body > .flex-between[style*="border-top"] > div[style*="display: flex"] .btn {
        flex: 1 1 auto;
        text-align: center;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* Order details: single column */
    .order-details-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    /* Empty state icons: smaller on mobile */
    .empty-state-icon {
        font-size: 2.5rem;
    }

    /* Section padding: tighter */
    .section {
        padding: var(--spacing-lg) 0;
    }

    /* Toast: centered, not clipped on right edge */
    .toast {
        left: var(--spacing-sm);
        right: var(--spacing-sm);
        max-width: none;
        text-align: center;
    }
}

/* ---- Small phones (480px) ---- */
@media (max-width: 480px) {

    /* Tighter container padding */
    .container {
        padding: 0 var(--spacing-sm);
    }

    /* Hide the time display to save space */
    #current-time {
        display: none;
    }

    /* Filter buttons: full width, stacked */
    .filter-bar {
        flex-direction: column;
    }

    .filter-bar .btn {
        width: 100%;
    }

    /* Smaller card padding */
    .card-body {
        padding: var(--spacing-sm);
    }
}
CSSEOF
```

**Reload nginx:**

```bash
docker compose exec nginx nginx -s reload
```

### Option B: Edit locally, then sync

Apply Steps 1–3 to your local files, then push:

```bash
rsync -avz frontend/admin/ deploy@YOUR_VPS_IP:/home/deploy/oos/frontend/admin/
```

Then reload nginx on the VPS:

```bash
ssh deploy@YOUR_VPS_IP "cd /home/deploy/oos && docker compose exec nginx nginx -s reload"
```

> [!warning] Browser cache
> Same as the customer page — test in a **private/incognito tab** on your phone, or clear cached files. You can also use `https://bakery.jrobbl.com/admin/?v=2` to bust the cache.

---

## Step 5 — Verify on mobile

| # | Check | Expected Result |
|---|-------|-----------------|
| 1 | Open `/admin` on phone | Logo stacked above time + username + logout, all fits |
| 2 | Filter buttons | All three visible, equally sized, easy to tap |
| 3 | Order card | Order # and customer name on top, badge + date below, no horizontal overflow |
| 4 | Action buttons | Price on its own row, buttons below wrap across full width, 44px+ tap targets |
| 5 | Tap "Ver Detalles" | Details expand in single column (customer info, then items below) |
| 6 | Tap "Marcar Completado" | Confirm dialog appears, order updates, card removed from pending view |
| 7 | On very small phone (< 480px) | Time hidden from header, filter buttons stack vertically, compact padding |
| 8 | On desktop | Exactly same as before — no visual changes |

---

## What changed and why

| Change | File | Reason |
|--------|------|--------|
| `.nav-links` → `.admin-nav-links` | `index.html:17` | Base CSS hides `.nav-links` on mobile (hamburger pattern) — admin has no hamburger, so logout button vanished |
| `style="gap: 1rem"` → `.filter-bar` class | `index.html:66` | Need CSS control over the gap |
| `grid grid-2` + inline gap → `.order-details-grid` | `script.js:247` | Inline styles can't be overridden by `@media` queries |
| `.admin-nav-links` base + mobile rules | `styles.css` | Always-visible flex row that compacts on mobile instead of hiding |
| `.order-details-grid` desktop rule | `styles.css` | Preserves 2-column layout on desktop |
| `@media 768px`: `.empty-state-icon` smaller | `styles.css` | 4rem icons were too large on phone screens |
| `@media 768px`: nav stacks vertically | `styles.css` | Logo + nav items overflow on one row |
| `@media 768px`: card sections stack | `styles.css` | Order info + badge, price + buttons all need vertical flow |
| `@media 768px`: buttons `flex-wrap` + 44px height | `styles.css` | Prevents overflow, meets touch target guidelines |
| `@media 768px`: disable card hover lift | `styles.css` | `translateY(-4px)` causes jank on touch scroll |
| `@media 480px`: hide `#current-time` | `styles.css` | Header too crowded on very small screens |
| `@media 480px`: filter buttons stack vertically | `styles.css` | Three buttons don't fit in a row under 480px |

---

## Related Notes

- [[mobile-responsive-guide]] — Customer page mobile fixes (do this first)
- [[deployment-guide]] — Full deployment guide
- [[nginx-fix]] — If CSS changes don't appear, check nginx caching headers
