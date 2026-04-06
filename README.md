# Nyra Admin

React (Vite) SPA for operating the Nyra catalog, orders, coupons, and admin auth. It talks to the **Nyra Backend** over HTTP (`/api`, `/healthz`).

## Table of contents

- [Requirements](#requirements)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Build & preview](#build--preview)
- [Docker Compose](#docker-compose)
- [Environments (dev vs production)](#environments-dev-vs-production)
- [GitHub Actions](#github-actions)
- [VPS deployment](#vps-deployment)
- [VPS: Docker operations](#vps-docker-operations)
- [Appendix: Environment template](#appendix-environment-template)

## Requirements

- **Node.js 22** (see `Dockerfile` `FROM node:22-alpine`)
- **npm** (lockfile: `package-lock.json`)

## Local development

```bash
npm ci
npm run dev
```

The dev server defaults to **http://localhost:5173**.

Configure API access via **`.env`**, **`.env.development`**, or **`.env.local`** (Vite `loadEnv`). Start from **[`.env.example`](.env.example)**:

```bash
cp .env.example .env
```

## Environment variables

All client-visible configuration uses the `VITE_` prefix. The full annotated template is **[`.env.example`](.env.example)**.

| Variable | When | Purpose |
|----------|------|---------|
| `VITE_API_BASE_URL` | Prod build **required**; dev optional | API origin, **no trailing slash** (e.g. `https://api.nccppl.com`). In dev, if set, the browser calls this origin directly (CORS must allow the admin origin). |
| `VITE_API_PATH_PREFIX` | Optional | If set, API is under a subpath (e.g. `/api/v2`). Proxies and `getApiBaseUrl()` combine origin + prefix. Usually empty. |
| `VITE_API_PROXY_TARGET` | Dev / `preview` only | Backend URL for Vite’s dev-server proxy (default `http://localhost:8080`). See [`vite.config.ts`](vite.config.ts). |

### Dev modes (see `.env.example`)

1. **Direct to API:** set `VITE_API_BASE_URL=http://localhost:8080` (or your API host). Browser shows cross-origin requests; backend `CORS_ALLOWED_ORIGINS` must include `http://localhost:5173`.

2. **Proxy (recommended for local):** leave `VITE_API_BASE_URL` **empty** in dev. Requests stay same-origin on `:5173`; Vite proxies `/api` and `/healthz` to `VITE_API_PROXY_TARGET`.

Production static builds **embed** `VITE_*` at **build time**. Changing the API URL means **rebuilding** the image or running `npm run build` again with new env vars.

## Build & preview

```bash
npm run build    # tsc + vite build → dist/
npm run preview  # serves dist/; uses same Vite proxy rules as dev when hitting API locally
```

## Docker Compose

[`docker-compose.yml`](docker-compose.yml) defines two static frontends (nginx serving the Vite output):

| Service | Container | Host port | API baked in at build (`build.args`) |
|---------|-----------|-----------|----------------------------------------|
| `admin` | `nyra_admin` | **8081** | `VITE_API_BASE_URL: https://api.nccppl.com` |
| `admin_dev` | `nyra_admin_dev` | **8084** | `VITE_API_BASE_URL: https://api-dev.nccppl.com` |

Build and run:

```bash
docker compose build
docker compose up -d
```

**No `.env` file is required on the server** for these services as committed—the API URLs are fixed in `docker-compose.yml`. To use different hostnames, edit `build.args` (or add `env_file` / build args from a local env file) and rebuild.

Image stages (see [`Dockerfile`](Dockerfile)):

1. **builder:** `npm ci` → `npm run build` with `VITE_API_BASE_URL` / `VITE_API_PATH_PREFIX`.
2. **runtime:** `nginx:alpine` serves `dist/` with SPA fallback ([`nginx.conf`](nginx.conf)).

## Environments (dev vs production)

| | Development admin | Production admin |
|--|-------------------|------------------|
| **Compose service** | `admin_dev` | `admin` |
| **Default API** | `https://api-dev.nccppl.com` | `https://api.nccppl.com` |
| **Host port (default)** | 8084 | 8081 |

These URLs must match the **actual** backend deployment and TLS hostnames on your VPS / reverse proxy.

## GitHub Actions

This repository **does not** ship `.github/workflows` yet. The backend repo automates deploys via SSH + Docker Compose (see that project’s README).

**Optional alignment:** add workflows that:

1. Run `npm ci` and `npm run build` (and optionally `npm run lint`).
2. SCP the repo to e.g. `/opt/nyra_admin` on the same VPS.
3. Run `docker compose up -d --build` for `admin` and/or `admin_dev`.

Reuse the same **`VPS_*`** secrets pattern as the backend if you want one operator playbook.

## VPS deployment

### One-time

1. Install Docker + Compose v2.
2. Place the project (or let CI SCP it) under e.g. `/opt/nyra_admin`:

   ```bash
   sudo mkdir -p /opt/nyra_admin
   sudo chown -R "$USER:$USER" /opt/nyra_admin
   ```

3. Copy in `docker-compose.yml`, `Dockerfile`, `nginx.conf`, app sources, etc. (mirrors a git clone or CI artifact).

4. From `/opt/nyra_admin`:

   ```bash
   docker compose up -d --build
   ```

5. Terminate TLS and route hostnames at the host reverse proxy:

   - `admin.nccppl.com` → `127.0.0.1:8081` (prod)
   - `admin-dev.nccppl.com` → `127.0.0.1:8084` (dev)

   Ensure DNS and certificates match your real domains.

### Cohesion with backend

The admin’s baked-in API base URLs must match the backend **CORS** config: `CORS_ALLOWED_ORIGINS` on the API must list each admin origin (e.g. `https://admin.nccppl.com`).

## VPS: Docker operations

```bash
cd /opt/nyra_admin
COMPOSE="docker compose -f docker-compose.yml"
```

### Restart containers (nginx + static assets already in image)

```bash
$COMPOSE restart admin
$COMPOSE restart admin_dev
$COMPOSE restart
```

### Rebuild after `docker-compose.yml` or source changes

```bash
docker compose up -d --build admin
docker compose up -d --build admin_dev
docker compose up -d --build   # both
```

### Logs

```bash
$COMPOSE logs -f admin
$COMPOSE logs -f admin_dev
```

### Smoke test from the VPS

```bash
curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8081/
curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8084/
```

Expect **200** for the SPA shell (nginx `try_files` → `index.html`).

## Appendix: Environment template

Keep in sync with the repo file [`.env.example`](.env.example); copy below for quick reference.

```dotenv
# API base URL (no trailing slash). For browser access, the backend must include your admin origin in
# CORS_ALLOWED_ORIGINS (e.g. https://admin.nccppl.com for production).
#
# Dev vs prod APIs use different hosts (e.g. api-dev vs api); leave VITE_API_PATH_PREFIX empty unless
# you intentionally mount the API under a path prefix.
#
# Development (direct to API): browser hits the backend; DevTools shows http://localhost:8080.
# The API must allow CORS from http://localhost:5173 (or your dev origin).
# VITE_API_BASE_URL=http://localhost:8080
# VITE_API_PROXY_TARGET=http://localhost:8080
#
# Development (proxy): leave VITE_API_BASE_URL empty — DevTools shows http://localhost:5173
# because requests are same-origin. Vite proxies `/api` and `/healthz` to VITE_API_PROXY_TARGET.
# VITE_API_BASE_URL=
# VITE_API_PROXY_TARGET=http://localhost:8080
#
# Production: required — full public API URL.
# Docker (VPS): `docker-compose.yml` defines `admin` and `admin_dev` with fixed production API URLs;
# you do not need this file on the server for those images. For ad-hoc local `docker compose` builds,
# set VITE_API_BASE_URL (and optional VITE_API_PATH_PREFIX) as build-args or in .env.
# VITE_API_BASE_URL=https://api.example.com

VITE_API_BASE_URL=http://localhost:8080
VITE_API_PROXY_TARGET=http://localhost:8080
```
