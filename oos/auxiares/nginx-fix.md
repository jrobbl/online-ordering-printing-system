---
aliases:
  - Nginx Fix
tags:
  - fix
  - nginx
  - deployment
created: 2026-02-16
updated: 2026-02-16
---

# Nginx Configuration Fix: Broken CSS, API Proxy, and Admin Route

## Symptoms (Round 1)

After running `docker compose --env-file .env.production up -d` and visiting `http://localhost:8080`:

1. **Customer page (`/`)** loads but with **no styling** — the HTML renders unstyled as if `styles.css` doesn't exist
2. **Admin page (`/admin/`)** does **not work at all** — returns 404 or serves wrong content

## Symptoms (Round 2 — after nesting regex)

CSS loads correctly, but:

1. **Products not displayed** — the product grid stays empty / shows an error
2. **`/admin` not reachable** — browser hangs or lands on wrong host

---

## Root Cause: Round 1 — CSS not loading

### The original config (alias + try_files)

```nginx
location / {
    alias /usr/share/nginx/html/customer/;
    try_files $uri $uri/ /customer/index.html;
}

location /admin {
    alias /usr/share/nginx/html/admin/;
    try_files $uri $uri/ /admin/index.html;
}

location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

Problems with `alias`:
- `alias` + `try_files` don't work together — `try_files` resolves against `root`, not `alias`
- `location /admin` (no trailing slash) + `alias .../admin/` (trailing slash) causes double-slash path mapping

### The first attempted fix (rewrite + break, but regex still top-level)

```nginx
location / {
    rewrite ^/$ /customer/index.html break;
    rewrite ^/(.+)$ /customer/$1 break;
}

# This was still at the TOP LEVEL — same problem!
location ~* \.(css|js|...)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

**Why this still failed:** In nginx, a **top-level regex location** (`~*`) takes priority over a **prefix location** (`/`) when both match. So:

1. Browser requests `/styles.css`
2. Nginx sees two matches: `location /` (prefix) and `location ~* \.css$` (regex)
3. **Regex wins** — request goes to the caching block
4. Caching block has no rewrite — resolves against `root`: `/usr/share/nginx/html/styles.css`
5. File not found (it's at `/usr/share/nginx/html/customer/styles.css`)
6. 404 — page renders unstyled

The rewrite in `location /` **never executes** for `.css`/`.js` files because the regex intercepts them first.

> [!important] Nginx location priority order
> 1. `location = /exact` (exact match — highest)
> 2. `location ^~ /prefix` (prefix with `^~` modifier)
> 3. `location ~* \.regex$` (regex — **beats normal prefix**)
> 4. `location /prefix` (normal prefix — lowest)

### Fix for Round 1

Nest the regex caching blocks **inside** their parent prefix locations. A nested regex location only matches requests that already matched the parent, so it inherits the parent's context and the rewrite applies first.

This fixed CSS loading. But two more issues remained.

---

## Root Cause: Round 2 — Products not displaying + /admin unreachable

### Bug 3: API proxy never reached (products empty)

The `location /` catch-all block rewrites **every** request under `/` to `/customer/...`:

```nginx
location / {
    rewrite ^/(.+)$ /customer/$1 break;
    ...
}

location /api/ {
    proxy_pass http://backend_api/api/;
    ...
}
```

When the customer JS calls `fetch('/api/products')`:

1. Request to `/api/products` matches `location /` (prefix match)
2. But wait — it also matches `location /api/` (longer prefix match)

**However**, the `rewrite ... break` in `location /` uses the `break` flag, which stops all further processing and serves the rewritten URI as a static file. The problem is **ordering matters for how nginx evaluates prefix locations**. In this case, `location /api/` IS a longer prefix and should win over `location /`... but the `location /` block also contains a nested regex that can interfere.

The real fix: **move `location /api/` before `location /`** in the config file and ensure it's clearly the more specific match. While nginx technically evaluates prefix locations by longest match (not order), placing the API block first makes the intent clear and avoids any interaction with the catch-all rewrites.

> [!tip] Rule of thumb
> Always define specific prefix locations (`/api/`, `/admin/`, `/health`) **before** the catch-all `location /`. While nginx prefix matching is length-based, keeping specific routes first prevents rewrite/break interactions from short-circuiting the request before the right location is evaluated.

### Bug 4: `/admin` redirect goes to wrong host

```nginx
server_name bakery.jrobbl.com;

location = /admin {
    return 301 /admin/;
}
```

When nginx generates a `301` redirect with a **relative path** (`/admin/`), it constructs the full `Location` header using `server_name`. So visiting `http://localhost:8080/admin` returns:

```
HTTP/1.1 301 Moved Permanently
Location: http://bakery.jrobbl.com/admin/
```

The browser follows the redirect to `bakery.jrobbl.com` — which doesn't resolve locally. The admin page appears unreachable.

**Fix:** Use `$scheme://$http_host` instead of a relative path. `$http_host` preserves whatever the browser used to reach nginx (including port):

```nginx
location = /admin {
    return 301 $scheme://$http_host/admin/;
}
```

This produces `Location: http://localhost:8080/admin/` when accessed locally, and `https://bakery.jrobbl.com/admin/` when accessed in production.

Also add `localhost` to `server_name` so nginx responds to local requests:

```nginx
server_name bakery.jrobbl.com localhost;
```

---

## The Final Working Config

```nginx
# Main nginx configuration for bakery system

upstream backend_api {
    server backend:3000;
}

server {
    listen 80;
    server_name bakery.jrobbl.com localhost;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    root /usr/share/nginx/html;
    index index.html;

    # API endpoints — proxy to backend (BEFORE location / to avoid rewrite)
    location /api/ {
        proxy_pass http://backend_api/api/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Admin frontend — redirect /admin to /admin/
    location = /admin {
        return 301 $scheme://$http_host/admin/;
    }

    # Admin frontend — serve files
    location /admin/ {
        rewrite ^/admin/$ /admin/index.html break;
        rewrite ^/admin/(.+)$ /admin/$1 break;

        location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Customer frontend — catch-all, MUST BE LAST
    location / {
        rewrite ^/$ /customer/index.html break;
        rewrite ^/(.+)$ /customer/$1 break;

        location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
            rewrite ^/(.+)$ /customer/$1 break;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### Request flow summary

| Request | Matched location | Result |
|---|---|---|
| `GET /` | `location /` | Rewrite to `/customer/index.html` — served |
| `GET /styles.css` | `location /` > nested regex | Rewrite to `/customer/styles.css` — served with cache headers |
| `GET /script.js` | `location /` > nested regex | Rewrite to `/customer/script.js` — served with cache headers |
| `GET /api/products` | `location /api/` | Proxied to `backend:3000/api/products` |
| `GET /api/health` | `location /api/` | Proxied to `backend:3000/api/health` |
| `GET /health` | `location /health` | Returns `200 "healthy"` |
| `GET /admin` | `location = /admin` | 301 redirect to `$scheme://$http_host/admin/` |
| `GET /admin/` | `location /admin/` | Rewrite to `/admin/index.html` — served |
| `GET /admin/styles.css` | `location /admin/` > nested regex | Served from `/admin/styles.css` with cache headers |
| `GET /admin/auth.js` | `location /admin/` > nested regex | Served from `/admin/auth.js` with cache headers |

---

## After applying

```bash
docker compose --env-file .env.production restart nginx
```

Verify:

- `http://localhost:8080/` — customer page with styling AND products loaded
- `http://localhost:8080/admin` — redirects to `http://localhost:8080/admin/`
- `http://localhost:8080/admin/` — admin login page with full CSS
- `http://localhost:8080/api/health` — JSON from backend

---

## All Bugs Fixed (chronological)

| # | Bug | Cause | Fix |
|---|---|---|---|
| 1 | CSS not loading | `alias` + `try_files` don't work together | Replace with `rewrite` + `break` |
| 2 | CSS still not loading | Top-level regex location intercepted `.css`/`.js` before prefix `location /` | Nest regex inside parent prefix locations |
| 3 | Products not displayed | `location /` rewrite caught `/api/*` requests, preventing proxy | Move `location /api/` before `location /`; specific prefixes first |
| 4 | `/admin` unreachable | `return 301 /admin/` used `server_name` (bakery.jrobbl.com) for redirect host | Use `$scheme://$http_host/admin/`; add `localhost` to `server_name` |

## Lessons Learned

1. **Never use `alias` with `try_files`** — they resolve paths differently
2. **Never put a standalone regex location at the top level** if prefix locations need to rewrite paths for the same file types
3. **Nest regex locations inside their parent prefix locations** to keep them scoped correctly
4. **Place specific prefix locations (`/api/`, `/admin/`) before the catch-all `location /`** to prevent rewrite interactions
5. **Use `$scheme://$http_host` in redirects**, not relative paths, to preserve the host the client actually used
6. **Add `localhost` to `server_name`** if you need to access the service locally during development
