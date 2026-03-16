---
aliases:
  - Docker Env Fix
tags:
  - fix
  - docker
  - deployment
  - env
created: 2026-02-16
---

# Docker Compose Environment Variable Fix: Mangled Bcrypt Hash

## Symptoms

After running `docker compose --env-file .env.production up -d`, two issues appear:

### Warning messages at startup

```
WARN[0000] The "DB_USER" variable is not set. Defaulting to a blank string.
WARN[0000] The "DB_NAME" variable is not set. Defaulting to a blank string.
WARN[0000] The "DB_PASSWORD" variable is not set. Defaulting to a blank string.
WARN[0000] The "hkkmXw5D" variable is not set. Defaulting to a blank string.
```

### Admin login broken

Even though the containers start and postgres reports healthy, logging in as `emmer_admin` fails — bcrypt comparison always returns `false`.

## Root Cause

### The `hkkmXw5D` warning (critical)

`backend/.env.production` line 14 had:

```env
ADMIN_PASSWORD_HASH=$2b$10$hkkmXw5D.XI8MH.4nzRshuVn4N.q.nkUONzAqi5Hg9v7d6sagS6Bi
```

Docker Compose's `env_file` directive parses `$` as the start of a variable reference. It sees:

| Token | Interpreted as |
|---|---|
| `$2b` | Variable `$2b` — not set, replaced with empty string |
| `$10` | Variable `$10` — not set, replaced with empty string |
| `$hkkmXw5D` | Variable `$hkkmXw5D` — not set, replaced with empty string |

**Result:** The password hash that reaches the Node.js container is completely mangled — all the `$`-prefixed segments are stripped out. `bcrypt.compare()` always fails because it's comparing against a corrupted hash.

This is why the warning says `The "hkkmXw5D" variable is not set` — Docker Compose is literally trying to substitute `$hkkmXw5D` as an environment variable.

### The `DB_USER`/`DB_NAME`/`DB_PASSWORD` warnings (cosmetic)

The root `docker-compose.yml` uses `${DB_USER}`, `${DB_PASSWORD}`, `${DB_NAME}` for the postgres service. The `--env-file .env.production` flag passes the root-level `.env.production` which contains these values, so they DO get set. The warnings appear during an early parse phase but the values are resolved correctly — postgres starts and reports healthy, confirming this.

These warnings are harmless but can be silenced by also having a `.env` file at the project root (Docker Compose reads `.env` automatically in addition to any `--env-file`).

## The Fix

### Escape `$` as `$$` in `backend/.env.production`

In Docker Compose `env_file` syntax, `$$` is the literal escape for a single `$` character.

**Before (broken):**

```env
ADMIN_PASSWORD_HASH=$2b$10$hkkmXw5D.XI8MH.4nzRshuVn4N.q.nkUONzAqi5Hg9v7d6sagS6Bi
```

**After (fixed):**

```env
ADMIN_PASSWORD_HASH=$$2b$$10$$hkkmXw5D.XI8MH.4nzRshuVn4N.q.nkUONzAqi5Hg9v7d6sagS6Bi
```

Docker Compose replaces every `$$` with a literal `$` before passing the value to the container, so the Node.js process receives the correct hash: `$2b$10$hkkmXw5D...`.

> [!warning] Important
> This only applies to files loaded via Docker Compose's `env_file` directive. The `backend/.env` used in local development (loaded by `dotenv` in Node.js) does NOT need this escaping — `dotenv` does not interpret `$` as variable substitution by default.

### When to apply this rule

Any time a value in a Docker Compose `env_file` contains `$`, it must be escaped as `$$`. Common cases:

- Bcrypt hashes (`$2b$10$...`)
- JWT secrets that contain `$`
- Passwords with `$` characters

## After applying

```bash
docker compose --env-file .env.production down
docker compose --env-file .env.production up -d --build
```

Verify the hash arrives intact inside the container:

```bash
docker exec bakery_backend sh -c 'echo $ADMIN_PASSWORD_HASH'
```

Expected output should start with `$2b$10$` — if it starts with `b` or is missing segments, the escaping is still wrong.
