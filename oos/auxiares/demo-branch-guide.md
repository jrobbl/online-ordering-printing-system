---
aliases:
  - Demo Branch Guide
  - Git Branch VPS Guide
  - Pitch Demo Setup
tags:
  - deployment
  - git
  - demo
  - vps
created: 2026-02-17
---

# Demo Branch Guide — Git Version Control on VPS

How to use git branches to switch between "demo mode" (no time restriction) and "production mode" (time-restricted orders) on the Hostinger VPS. This lets you demo the full ordering flow during your 20:00 pitch, then switch back.

> [!info] The time restriction
> Orders are blocked outside 4:00–23:00 by `backend/middleware/validateTime.js` (line 11). The check is applied to `POST /api/orders` in `backend/routes/orderRoutes.js`. To demo at 20:00 this is actually inside the window (`currentHour < 4 || currentHour >= 23`), so ordering **will work** at 20:00. However, if you want to also demonstrate the restriction being toggled on/off live, this guide covers that.

---

## Part 1 — Set Up Git on the VPS

### 1.1 Initialize the repo (if not already a git repo on VPS)

```bash
ssh deploy@YOUR_VPS_IP
cd /home/deploy/oos
```

Check if it's already a git repo:

```bash
git status
```

If you get `fatal: not a git repository`, initialize it:

```bash
git init
git add -A
git commit -m "Initial production state"
```

If it's already a repo, make sure the current state is committed:

```bash
git add -A
git commit -m "Current production state before demo"
```

### 1.2 Check you're on main

```bash
git branch
```

Should show `* main` (or `* master`). If there's no branch at all (fresh init), you're on `main` by default after the first commit.

---

## Part 2 — Create a Demo Branch

### 2.1 Create and switch to the demo branch

```bash
git checkout -b demo-no-time-restriction
```

### 2.2 Edit the time validation middleware

```bash
nano backend/middleware/validateTime.js
```

Change line 11 from:

```javascript
    if (currentHour < 4 || currentHour >= 23) {
```

To:

```javascript
    if (false) {  // DEMO: time restriction disabled
```

Save and exit (`Ctrl+X`, then `Y`, then `Enter`).

### 2.3 Commit the demo change

```bash
git add backend/middleware/validateTime.js
git commit -m "Demo: disable time restriction for pitch"
```

---

## Part 3 — Rebuild and Run with Demo Branch

After changing backend code, Docker needs to rebuild the backend image:

```bash
cd /home/deploy/oos
docker compose --env-file .env.production up -d --build
```

> [!warning] The `--build` flag is critical
> Without `--build`, Docker reuses the cached image with the old code. Always use `--build` after backend code changes.

Verify it's running:

```bash
docker compose --env-file .env.production ps
```

Test that orders work regardless of time:

```bash
curl -X POST https://bakery.jrobbl.com/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"Test","customer_phone":"555","customer_email":"test@test.com","items":[{"product_id":1,"quantity":1}]}'
```

Should return a success response with the order details, regardless of what time it is.

---

## Part 4 — Switch Back to Production

After the pitch, restore the time restriction:

```bash
cd /home/deploy/oos
git checkout main
docker compose --env-file .env.production up -d --build
```

Verify:

```bash
git branch
```

Should show `* main`.

The time restriction is now active again.

---

## Part 5 — Live Demo Script (During the Pitch)

If you want to demonstrate the toggle live during the pitch:

### Show restriction is ON (main branch)

```bash
# Check current branch
git branch

# Try to place an order (will fail if outside hours on main)
# Or just show the frontend — it will display the error toast
```

### Switch to demo mode

```bash
git checkout demo-no-time-restriction
docker compose --env-file .env.production up -d --build
```

> [!tip] This takes ~10-20 seconds
> The backend image rebuild + container restart is fast but not instant. You might want to switch before the demo starts and just explain that you can toggle it.

### Show it works now

Place an order through the frontend. It will succeed.

### Switch back (optional, to show the control)

```bash
git checkout main
docker compose --env-file .env.production up -d --build
```

---

## Quick Reference — Commands Cheat Sheet

| Action | Command |
|--------|---------|
| See current branch | `git branch` |
| Switch to demo (no restriction) | `git checkout demo-no-time-restriction` |
| Switch to production | `git checkout main` |
| Rebuild after switch | `docker compose --env-file .env.production up -d --build` |
| Check containers | `docker compose --env-file .env.production ps` |
| See all branches | `git branch -a` |
| Delete demo branch (cleanup) | `git branch -d demo-no-time-restriction` |

---

## Important Notes

- **Always rebuild** (`--build`) after switching branches that change backend code. Frontend-only changes (CSS, HTML, JS) don't need `--build` since they're mounted as a volume — just `nginx -s reload`.
- **The database is not affected** by branch switches. Orders, products, and admin credentials persist in the Docker volume regardless of which branch is active.
- **Current time window**: The code currently allows orders from 4:00 to 23:00 (`currentHour < 4 || currentHour >= 23`). Your pitch at 20:00 is **inside** this window, so orders will actually work on the main branch too. The demo branch is only needed if you want to demo outside this window or show the toggle capability.

---

## After the Pitch — Cleanup

Once you no longer need the demo branch:

```bash
# Make sure you're on main
git checkout main

# Delete the demo branch
git branch -d demo-no-time-restriction
```

---

## Related Notes

- [[deployment-guide]] — Full VPS deployment setup
- [[project-log-second]] — Session log documenting all changes
