---
aliases:
  - Deployment Guide
  - Hostinger VPS Deploy
  - Production Setup
tags:
  - deployment
  - hostinger
  - vps
  - docker
  - ssl
  - production
created: 2026-02-16
updated: 2026-02-16
---

# Deployment Guide — EMMER Panaderia OOS on Hostinger VPS

This guide covers every step to go from a fresh Hostinger VPS to a fully running production instance of the Online Ordering System at `https://bakery.jrobbl.com`.

> [!info] Prerequisites
> - A Hostinger VPS plan (KVM or higher recommended — minimum 1 GB RAM)
> - SSH access to the VPS (root or sudo user)
> - Domain `bakery.jrobbl.com` ready to point to the VPS IP
> - The project repository cloned or uploaded to the VPS

---

## Phase 1 — VPS Initial Setup

### 1.1 SSH into the VPS

```bash
ssh root@YOUR_VPS_IP
```

If Hostinger provided a non-root user, use that and prefix commands with `sudo`.

### 1.2 Update the system

```bash
apt update && apt upgrade -y
```

### 1.3 Install Docker

```bash
# Install dependencies
apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Add the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine + Compose plugin
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 1.4 Verify Docker

```bash
docker --version
docker compose version
```

### 1.5 Install Git (if not present)

```bash
apt install -y git
```

### 1.6 Create a non-root deploy user (recommended)

```bash
adduser deploy
usermod -aG docker deploy
usermod -aG sudo deploy
```

Then log in as `deploy` for the rest of the guide:

```bash
su - deploy
```

---

## Phase 2 — DNS Configuration

### 2.1 Point the domain to the VPS

In your DNS provider (Hostinger panel, Cloudflare, or wherever `bakery.jrobbl.com` is managed):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `bakery` | `YOUR_VPS_IP` | 300 |

### 2.2 Verify DNS propagation

```bash
# From any machine
dig bakery.jrobbl.com +short
# Should return YOUR_VPS_IP

# Or
ping bakery.jrobbl.com
```

> [!warning] DNS propagation
> DNS changes can take 5 minutes to 48 hours to propagate worldwide. The TTL of 300 (5 min) helps speed this up. You can proceed with the rest of the setup while waiting — just use the VPS IP directly for testing.

---

## Phase 3 — Upload the Project

### Option A: Git clone

```bash
cd /home/deploy
git clone https://github.com/YOUR_USER/oos.git
cd oos
```

### Option B: SCP from local machine

From your **local machine**:

```bash
# Exclude node_modules, .git, and env files
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='backend/.env' \
  /home/jrobbl/Documents/dev/oos/ deploy@YOUR_VPS_IP:/home/deploy/oos/
```

### Option C: Manual upload via Hostinger File Manager

Upload the project as a `.tar.gz` archive, then extract:

```bash
cd /home/deploy
tar xzf oos.tar.gz
cd oos
```

---

## Phase 4 — Production Environment Files

### 4.1 Root `.env.production`

This file feeds the PostgreSQL container. Create it at the project root:

```bash
nano .env.production
```

```env
# Database Configuration
DB_USER=oos_admin
DB_PASSWORD=YOUR_SECURE_DB_PASSWORD
DB_NAME=oos_db
```

> [!important] Generate a strong DB password
> ```bash
> openssl rand -base64 24
> ```
> Use the output as `DB_PASSWORD`. Make sure it matches in both `.env.production` files.

### 4.2 Backend `backend/.env.production`

This file feeds the Node.js backend container:

```bash
nano backend/.env.production
```

```env
# Database Configuration (Docker internal networking)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=oos_db
DB_USER=oos_admin
DB_PASSWORD=YOUR_SECURE_DB_PASSWORD

# Server Configuration
PORT=3000
NODE_ENV=production

# Admin Authentication
ADMIN_USERNAME=emmer_admin
ADMIN_PASSWORD_HASH=$$2b$$10$$YOUR_BCRYPT_HASH_HERE
JWT_SECRET=YOUR_SECURE_JWT_SECRET

# CORS Configuration
ALLOWED_ORIGIN=https://bakery.jrobbl.com
```

> [!danger] Critical — Bcrypt hash escaping
> Every `$` in the bcrypt hash must be doubled to `$$` in this file because Docker Compose interprets `$` as variable substitution. See [[docker-env-fix]] for full details.
>
> Example: if bcrypt outputs `$2b$10$abc123`, write it as `$$2b$$10$$abc123`.

> [!tip] Generate credentials
> ```bash
> # Generate JWT secret
> openssl rand -base64 48
>
> # Generate admin password hash (run inside the project)
> # First install deps locally, or use Docker:
> docker run --rm -it node:18-alpine sh -c "
>   npm install bcrypt &&
>   node -e \"require('bcrypt').hash('YOUR_ADMIN_PASSWORD', 10).then(h => console.log(h))\"
> "
> ```
> Then double every `$` in the hash before pasting into the env file.

---

## Phase 5 — Docker Compose Configuration for Production

### 5.1 Change the port mapping

Edit `docker-compose.yml` — change nginx ports from `"8080:80"` to `"80:80"`:

```yaml
  nginx:
    image: nginx:alpine
    container_name: bakery_nginx
    restart: unless-stopped
    ports:
      - "80:80"
    # ... rest stays the same
```

> [!note] Why port 80?
> On the VPS, nginx is the only web server and should listen on the standard HTTP port. Locally we used 8080 to avoid conflicts. After adding SSL (Phase 8), we'll also add port 443.

### 5.2 Verify the full `docker-compose.yml`

The complete file should look like this:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: bakery_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - bakery_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Node.js Backend API
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: bakery_backend
    restart: unless-stopped
    env_file:
      - backend/.env.production
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - bakery_network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Nginx Web Server
  nginx:
    image: nginx:alpine
    container_name: bakery_nginx
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./frontend:/usr/share/nginx/html:ro
    depends_on:
      - backend
    networks:
      - bakery_network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  bakery_network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
```

---

## Phase 6 — Firewall Configuration

### 6.1 Allow required ports

```bash
# If using ufw (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS (for later)
sudo ufw enable
sudo ufw status
```

### 6.2 Hostinger firewall panel

If Hostinger has its own firewall (in the VPS control panel), ensure ports **22**, **80**, and **443** are open for inbound TCP.

---

## Phase 7 — Build and Launch

### 7.1 Build and start all services

```bash
cd /home/deploy/oos
docker compose --env-file .env.production up -d --build
```

### 7.2 Verify all containers are running

```bash
docker compose ps
```

Expected output:

```
NAME               STATUS                   PORTS
bakery_postgres    Up (healthy)
bakery_backend     Up (healthy)
bakery_nginx       Up (healthy)             0.0.0.0:80->80/tcp
```

> [!warning] If a container shows "unhealthy" or "restarting"
> Check its logs:
> ```bash
> docker compose logs postgres
> docker compose logs backend
> docker compose logs nginx
> ```
>
> Common issues:
> - **postgres restarting**: Wrong `DB_USER`/`DB_PASSWORD` in `.env.production`
> - **backend unhealthy**: Database connection failed — check `backend/.env.production` credentials match root `.env.production`
> - **nginx restarting**: Syntax error in `nginx.conf` — run `docker compose exec nginx nginx -t`

### 7.3 Test the endpoints

```bash
# Health check
curl http://localhost/api/health

# Products
curl http://localhost/api/products

# Customer page
curl -I http://localhost/

# Admin redirect
curl -I http://localhost/admin
```

### 7.4 Test from browser

- Customer: `http://YOUR_VPS_IP` or `http://bakery.jrobbl.com`
- Admin: `http://YOUR_VPS_IP/admin` or `http://bakery.jrobbl.com/admin`

---

## Phase 8 — SSL/HTTPS with Let's Encrypt

### 8.1 Install Certbot on the host

```bash
sudo apt install -y certbot
```

### 8.2 Stop nginx temporarily to free port 80

```bash
docker compose stop nginx
```

### 8.3 Obtain the certificate

```bash
sudo certbot certonly --standalone -d bakery.jrobbl.com
```

Follow the prompts. Certificates will be saved to:
- `/etc/letsencrypt/live/bakery.jrobbl.com/fullchain.pem`
- `/etc/letsencrypt/live/bakery.jrobbl.com/privkey.pem`

### 8.4 Update `nginx/nginx.conf` for HTTPS

Replace the entire file with:

```nginx
# Main nginx configuration for bakery system

upstream backend_api {
    server backend:3000;
}

# Redirect all HTTP to HTTPS
server {
    listen 80;
    server_name bakery.jrobbl.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bakery.jrobbl.com;

    # SSL certificates
    ssl_certificate     /etc/letsencrypt/live/bakery.jrobbl.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bakery.jrobbl.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HSTS — tell browsers to always use HTTPS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    root /usr/share/nginx/html;
    index index.html;

    # API endpoints — proxy to backend (MUST be before location /)
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

### 8.5 Update `docker-compose.yml` nginx service

```yaml
  nginx:
    image: nginx:alpine
    container_name: bakery_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./frontend:/usr/share/nginx/html:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - backend
    networks:
      - bakery_network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Key changes:
- Added port `"443:443"`
- Mounted `/etc/letsencrypt` as a read-only volume so nginx can read the certs

### 8.6 Restart the stack

```bash
docker compose --env-file .env.production up -d
```

### 8.7 Verify HTTPS

```bash
curl -I https://bakery.jrobbl.com
```

Should return `HTTP/2 200` with the security headers.

### 8.8 Auto-renew certificates

Certbot installs a systemd timer by default. Verify:

```bash
sudo systemctl status certbot.timer
```

Since we need to briefly stop nginx for standalone renewal, create a renewal hook:

```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/pre
sudo mkdir -p /etc/letsencrypt/renewal-hooks/post
```

```bash
# Pre-hook: stop nginx
sudo tee /etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh << 'EOF'
#!/bin/bash
cd /home/deploy/oos && docker compose stop nginx
EOF

# Post-hook: start nginx
sudo tee /etc/letsencrypt/renewal-hooks/post/start-nginx.sh << 'EOF'
#!/bin/bash
cd /home/deploy/oos && docker compose start nginx
EOF

sudo chmod +x /etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/post/start-nginx.sh
```

Test renewal dry-run:

```bash
sudo certbot renew --dry-run
```

> [!tip] Alternative: webroot renewal (no downtime)
> Instead of stopping nginx, you can configure certbot to use the webroot method. Add this location to the HTTP server block in nginx.conf:
> ```nginx
> location /.well-known/acme-challenge/ {
>     root /var/www/certbot;
> }
> ```
> Then mount `/var/www/certbot` into the nginx container and run:
> ```bash
> sudo certbot renew --webroot -w /var/www/certbot
> ```
> This avoids any downtime during renewal.

---

## Phase 9 — Verification Checklist

Run through each of these after deployment:

| # | Check | Command / URL | Expected Result |
|---|-------|---------------|-----------------|
| 1 | All containers healthy | `docker compose ps` | All 3 show `Up (healthy)` |
| 2 | API health | `curl https://bakery.jrobbl.com/api/health` | `{"status":"OK",...}` |
| 3 | Products load | `curl https://bakery.jrobbl.com/api/products` | JSON array with 5 products |
| 4 | Customer page | Browser: `https://bakery.jrobbl.com` | Styled page with product cards |
| 5 | Customer CSS | Browser DevTools → Network | `styles.css` loads (200) |
| 6 | Add to cart | Click "Agregar al Carrito" | Cart updates, toast appears |
| 7 | Place order | Fill form, submit | Success view with order number |
| 8 | Admin redirect | Browser: `https://bakery.jrobbl.com/admin` | Redirects to `/admin/` |
| 9 | Admin login | Enter credentials | Dashboard loads |
| 10 | Admin orders | Dashboard | New order appears as "pendiente" |
| 11 | Update status | Click "Marcar Completado" | Status changes to "completado" |
| 12 | HTTP redirect | `curl -I http://bakery.jrobbl.com` | `301` to `https://...` |
| 13 | SSL valid | Browser padlock icon | Valid certificate, no warnings |
| 14 | HSTS header | `curl -I https://bakery.jrobbl.com` | `Strict-Transport-Security` present |

---

## Phase 10 — Maintenance Operations

### View logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f nginx
docker compose logs -f postgres
```

### Restart a single service

```bash
docker compose restart backend
```

### Rebuild after code changes

```bash
# Pull latest code (if using git)
git pull origin main

# Rebuild and restart
docker compose --env-file .env.production up -d --build
```

### Database backup

```bash
docker compose exec postgres pg_dump -U oos_admin oos_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Database restore

```bash
cat backup_file.sql | docker compose exec -T postgres psql -U oos_admin oos_db
```

### Reset database (destructive)

```bash
docker compose down
docker volume rm oos_postgres_data
docker compose --env-file .env.production up -d --build
```

> [!danger] This deletes ALL data
> The `init.sql` will re-run on the fresh volume, recreating tables and sample products. All orders will be lost.

### View database directly

```bash
docker compose exec postgres psql -U oos_admin oos_db

# Useful queries:
SELECT * FROM products;
SELECT * FROM orders ORDER BY order_date DESC LIMIT 10;
SELECT COUNT(*), status FROM orders GROUP BY status;
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs SERVICE_NAME

# Check config syntax (nginx)
docker compose exec nginx nginx -t

# Rebuild from scratch
docker compose down
docker compose --env-file .env.production up -d --build
```

### "Connection refused" on the API

1. Check backend is running: `docker compose ps`
2. Check backend logs: `docker compose logs backend`
3. Verify `DB_HOST=postgres` in `backend/.env.production` (not `localhost`)
4. Verify database credentials match between both `.env.production` files

### Products not showing

1. Check the API directly: `curl http://localhost/api/products`
2. If empty array: the database initialized without products — check `init.sql` and consider resetting the volume
3. If connection error: see "Connection refused" above
4. If working in curl but not browser: check browser DevTools Console for errors

### Admin page not loading

1. Check `/admin` redirects to `/admin/`: `curl -I http://localhost/admin`
2. Check `/admin/` serves HTML: `curl http://localhost/admin/`
3. If JS errors in console: check that `auth.js` loads before `script.js` in `index.html`
4. If `SyntaxError: Identifier 'API_URL' has already been declared`: `script.js` must NOT declare `const API_URL` — it's declared in `auth.js`

### SSL certificate errors

```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Check expiry from outside
openssl s_client -connect bakery.jrobbl.com:443 -servername bakery.jrobbl.com < /dev/null 2>/dev/null | openssl x509 -noout -dates
```

### Docker disk space

```bash
# Check disk usage
df -h
docker system df

# Clean unused images/containers
docker system prune -a
```

---

## Architecture Reference

```
                    Internet
                       │
                       ▼
               ┌───────────────┐
               │   DNS (A rec) │
               │ bakery.jrobbl │──► VPS_IP
               │    .com       │
               └───────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Nginx :80/443 │
              │  (SSL termination,
              │   static files) │
              └────────┬────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
    /customer/*   /admin/*     /api/*
    (static)      (static)     (proxy)
                                  │
                                  ▼
                         ┌────────────────┐
                         │  Backend :3000 │
                         │   (Express.js) │
                         └───────┬────────┘
                                 │
                                 ▼
                         ┌────────────────┐
                         │ PostgreSQL :5432│
                         │   (oos_db)     │
                         └────────────────┘
```

All three services communicate over the `bakery_network` Docker bridge. Only nginx exposes ports to the host (80 and 443). The backend and database are completely internal.

---

## Quick Reference — Key Paths on VPS

| What | Path |
|------|------|
| Project root | `/home/deploy/oos/` |
| Root env file | `/home/deploy/oos/.env.production` |
| Backend env file | `/home/deploy/oos/backend/.env.production` |
| Nginx config | `/home/deploy/oos/nginx/nginx.conf` |
| Database init script | `/home/deploy/oos/database/init.sql` |
| SSL certificates | `/etc/letsencrypt/live/bakery.jrobbl.com/` |
| Certbot renewal hooks | `/etc/letsencrypt/renewal-hooks/` |
| Docker data (postgres) | `/var/lib/docker/volumes/oos_postgres_data/` |

---

## Quick Reference — Key URLs

| What | URL |
|------|-----|
| Customer storefront | `https://bakery.jrobbl.com` |
| Admin dashboard | `https://bakery.jrobbl.com/admin` |
| Admin login | `https://bakery.jrobbl.com/admin/login.html` |
| API health check | `https://bakery.jrobbl.com/api/health` |
| Products API | `https://bakery.jrobbl.com/api/products` |

---

## Related Notes

- [[nginx-fix]] — Detailed breakdown of all nginx routing bugs and fixes
- [[docker-env-fix]] — The `$` escaping issue with bcrypt hashes in Docker Compose
- [[audit-report]] — Full project audit with recommendations
- [[test-plan]] — Manual test plan for all features
- [[project-log]] — Complete session log with all changes made
