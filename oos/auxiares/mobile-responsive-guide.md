---
aliases:
  - Mobile Responsive Guide
  - Mobile Fix
tags:
  - frontend
  - css
  - responsive
  - mobile
created: 2026-02-16
updated: 2026-02-16
---

# Mobile Responsive Guide — Customer Storefront

This guide fixes the mobile layout for the customer-facing page at `https://bakery.jrobbl.com`. The admin panel is secondary (accessed on desktop), so this guide focuses on `frontend/customer/`.

> [!info] Context
> This issue was discovered during [[deployment-guide]] Step 7.4. The page renders well on desktop but on mobile the two-column layout (products + cart sidebar) does not collapse, making products tiny and the cart oversized.

---

## Root Cause

In `frontend/customer/index.html` line 26, the main layout is an inline style:

```html
<div class="grid" style="grid-template-columns: 2fr 1fr; gap: 2rem;">
```

This **never changes** regardless of screen width. There are no `@media` queries targeting this specific layout. The CSS grid breakpoints in `styles.css` only cover `.grid-2`, `.grid-3`, `.grid-4` — but this inline grid has no class, so those rules don't apply.

Additionally:
- The cart card has `position: sticky; top: 100px` which behaves poorly on mobile
- The product grid inside uses `.grid-3` which does collapse to 2 columns at 768px and 1 column at 480px — but it's squeezed into the `2fr` column, so even 2 columns are too narrow
- Toast notifications are positioned at `right: 2rem` which can overflow on small screens

---

## Step 1 — Fix the HTML layout (remove inline grid)

**File:** `frontend/customer/index.html`

**Find** (line 26):

```html
<div class="grid" style="grid-template-columns: 2fr 1fr; gap: 2rem;">
```

**Replace with:**

```html
<div class="grid main-layout">
```

This removes the inline style and adds a class we can control from CSS.

---

## Step 2 — Add responsive rules to customer CSS

**File:** `frontend/customer/styles.css`

Add the following block at the very end of the file:

```css
/* ============================================
   CUSTOMER PAGE — RESPONSIVE LAYOUT
   ============================================ */

/* Desktop: products left (2fr), cart right (1fr) */
.main-layout {
    grid-template-columns: 2fr 1fr;
    gap: 2rem;
}

/* Tablet (768px and below): stack vertically */
@media (max-width: 768px) {
    .main-layout {
        grid-template-columns: 1fr;
    }

    /* Cart: remove sticky, let it flow naturally below products */
    .main-layout .card {
        position: static !important;
    }

    /* Header: shrink logo, keep it readable */
    .logo {
        font-size: 1.25rem;
    }

    /* Nav schedule text: smaller */
    .nav-links .nav-link {
        font-size: 0.8rem;
    }

    /* Section padding: reduce on mobile */
    .section {
        padding: var(--spacing-lg) 0;
    }

    /* Toast: center it, don't overflow right edge */
    .toast {
        left: var(--spacing-sm);
        right: var(--spacing-sm);
        max-width: none;
        text-align: center;
    }
}

/* Small phones (480px and below) */
@media (max-width: 480px) {
    /* Product grid: always 1 column */
    .grid-3 {
        grid-template-columns: 1fr;
    }

    /* Buttons: full width for easier tapping */
    .card .btn {
        min-height: 44px;
    }

    /* Container: tighter padding */
    .container {
        padding: 0 var(--spacing-sm);
    }

    /* Checkout form: tighter spacing */
    .form-group {
        margin-bottom: var(--spacing-sm);
    }
}
```

---

## Step 3 — Deploy to VPS

Since the project is already running on the VPS, you only need to update the two static files. Nginx serves them directly from the mounted volume — no Docker rebuild needed.

### Option A: Edit directly on the VPS

SSH into the VPS and apply the two changes:

```bash
ssh deploy@YOUR_VPS_IP
cd /home/deploy/oos
```

**Edit the HTML** — replace the inline grid:

```bash
sed -i 's|<div class="grid" style="grid-template-columns: 2fr 1fr; gap: 2rem;">|<div class="grid main-layout">|' frontend/customer/index.html
```

**Edit the CSS** — append the responsive rules:

```bash
cat >> frontend/customer/styles.css << 'CSSEOF'

/* ============================================
   CUSTOMER PAGE — RESPONSIVE LAYOUT
   ============================================ */

/* Desktop: products left (2fr), cart right (1fr) */
.main-layout {
    grid-template-columns: 2fr 1fr;
    gap: 2rem;
}

/* Tablet (768px and below): stack vertically */
@media (max-width: 768px) {
    .main-layout {
        grid-template-columns: 1fr;
    }

    /* Cart: remove sticky, let it flow naturally below products */
    .main-layout .card {
        position: static !important;
    }

    /* Header: shrink logo, keep it readable */
    .logo {
        font-size: 1.25rem;
    }

    /* Nav schedule text: smaller */
    .nav-links .nav-link {
        font-size: 0.8rem;
    }

    /* Section padding: reduce on mobile */
    .section {
        padding: var(--spacing-lg) 0;
    }

    /* Toast: center it, don't overflow right edge */
    .toast {
        left: var(--spacing-sm);
        right: var(--spacing-sm);
        max-width: none;
        text-align: center;
    }
}

/* Small phones (480px and below) */
@media (max-width: 480px) {
    /* Product grid: always 1 column */
    .grid-3 {
        grid-template-columns: 1fr;
    }

    /* Buttons: full width for easier tapping */
    .card .btn {
        min-height: 44px;
    }

    /* Container: tighter padding */
    .container {
        padding: 0 var(--spacing-sm);
    }

    /* Checkout form: tighter spacing */
    .form-group {
        margin-bottom: var(--spacing-sm);
    }
}
CSSEOF
```

### Option B: Edit locally, then sync

Apply Step 1 and Step 2 to your local files, then push to the VPS:

```bash
rsync -avz frontend/customer/ deploy@YOUR_VPS_IP:/home/deploy/oos/frontend/customer/
```

### Clear nginx cache

After either option, force nginx to reload the updated files:

```bash
docker compose exec nginx nginx -s reload
```

> [!warning] Browser cache
> Your phone browser may cache the old CSS aggressively. To verify the fix, either:
> - Open the URL in a **private/incognito tab** on your phone
> - Or add a cache-busting query string: `https://bakery.jrobbl.com/?v=2`
>
> If using Chrome on Android: Settings > Privacy > Clear browsing data > Cached images and files

---

## Step 4 — Verify on mobile

Test these on your phone:

| # | Check | Expected Result |
|---|-------|-----------------|
| 1 | Open `https://bakery.jrobbl.com` on phone | Products stack vertically, full width |
| 2 | Scroll down | Cart appears below products, full width |
| 3 | Tap "Agregar al Carrito" | Button is easy to tap (44px+ height), toast appears centered |
| 4 | Tap "Continuar al Pago" | Checkout form is full width, inputs easy to tap |
| 5 | Rotate to landscape | Products may show 2 columns, cart still below |
| 6 | Open on desktop | Same as before — products 2fr, cart 1fr sidebar |

---

## What changed and why

| Change | File | Reason |
|--------|------|--------|
| Removed `style="grid-template-columns: 2fr 1fr"` | `index.html:26` | Inline styles can't be overridden by `@media` queries without `!important` hacks |
| Added `.main-layout` class | `index.html:26` | Gives CSS control over the two-column layout |
| Added `.main-layout` desktop rule | `styles.css` | Preserves the original 2fr/1fr layout on desktop |
| Added `@media (max-width: 768px)` | `styles.css` | Collapses to single column on tablets and phones |
| Removed `position: sticky` on mobile | `styles.css` | Sticky cart in a single-column layout causes overlap |
| Shrunk logo on mobile | `styles.css` | Header was too wide, caused horizontal scroll |
| Centered toast on mobile | `styles.css` | Fixed right-positioned toast overflowing off-screen |
| Added `@media (max-width: 480px)` | `styles.css` | Single-column product grid and tighter spacing for small phones |

---

## Related Notes

- [[deployment-guide]] — Step 7.4 is where this issue was discovered
- [[nginx-fix]] — Nginx caching config may need `Cache-Control` adjustments if CSS changes don't appear
