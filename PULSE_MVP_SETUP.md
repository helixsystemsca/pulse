# Pulse MVP — full-stack setup

This guide covers the **`frontend/`** Next.js Pulse UI with the **backend** FastAPI service, PostgreSQL, JWT auth, and tenant-scoped **`/api/v1/pulse/*`** APIs.

## Prerequisites

- **Node.js 18+** (for Next.js)
- **Python 3.11+** with `pip` (for FastAPI)
- **PostgreSQL 14+** (local or Docker)

## 1. Database

1. Create a database (example name: `ops_intel`).
2. Set `DATABASE_URL` in `backend/.env` (see `backend/.env.example`). Use the async form:

   `postgresql+asyncpg://USER:PASSWORD@HOST:5432/ops_intel`

3. From the `backend` directory, run migrations:

   ```bash
   alembic upgrade head
   ```

   This applies revision **`0005`** (Pulse tables: work requests, worker profiles, schedule shifts, beacon equipment).

## First system admin (seed)

Set **`SYS_ADMIN_PASSWORD`** (8+ characters), optionally **`SYS_ADMIN_EMAIL`** (default **`josh.collins@helixsystems.ca`**), then from `backend/` run **`python -m scripts.seed_sys_admin`**. That creates or updates that account. Use that email and password to sign in and reach **`/api/system`**; from there you can create companies and tenant users. See **Internal system admin API** at the end of this doc.

## 2. Backend (FastAPI)

1. Create and activate a virtualenv, then install dependencies:

   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. Copy `backend/.env.example` to `backend/.env` and set at minimum:

   | Variable | Purpose |
   |----------|---------|
   | `DATABASE_URL` | Async Postgres URL (see above) |
   | `SECRET_KEY` | Long random string for JWT signing |
   | `CORS_ORIGINS` | Include your Next dev origin, e.g. `http://localhost:3000` |
   | `PULSE_UPLOADS_DIR` | Optional; default `var/uploads` for beacon photo mocks |

3. Optional **bootstrap system admin** (only when no system admin exists):

   - `bootstrap_system_admin_email`
   - `bootstrap_system_admin_password`

4. Run the API:

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **Tenant users**: Pulse routes require a **company user** (`company_id` set, not `system_admin`).

   - Use system admin to create a **company** and **users** (see `POST /api/v1/system/companies` and your user-creation flow / admin tooling).
   - Log in with a tenant user’s **email** and password (**minimum 8 characters** per `LoginRequest`).

## 3. Frontend (Next.js — `frontend/`)

1. Install dependencies:

   ```bash
   cd frontend
   npm install
   ```

2. Copy `frontend/.env.example` to `frontend/.env.local` and set:

   | Variable | Purpose |
   |----------|---------|
   | `NEXT_PUBLIC_API_URL` | API origin, e.g. `http://127.0.0.1:8000` |
   | `NEXT_PUBLIC_USE_MOCK_AUTH` | Leave empty or `false` for real JWT login; set `true` to force demo mock login |

3. Run the app:

   ```bash
   npm run dev
   ```

4. Open **`/login`**, sign in with a **tenant** user when API mode is on. **`/overview`** loads **`GET /api/v1/pulse/dashboard`** when `NEXT_PUBLIC_API_URL` is set and mock auth is off.

## 4. API surface (MVP)

All routes are under **`/api/v1/pulse/`** and require **`Authorization: Bearer <access_token>`** from **`POST /api/v1/auth/login`**.

| Area | Endpoints (summary) |
|------|----------------------|
| Dashboard | `GET /pulse/dashboard` |
| Work requests | `GET/POST /pulse/work-requests`, `GET/PATCH/DELETE /pulse/work-requests/{id}` |
| Workers + profiles | `GET /pulse/workers`, `PATCH /pulse/workers/{user_id}/profile` |
| Schedule | `GET/POST /pulse/schedule/shifts`, `PATCH/DELETE /pulse/schedule/shifts/{id}` |
| Zones / assets | `GET /pulse/zones`, `GET/PATCH /pulse/assets/{id}` |
| Inventory | `GET /pulse/inventory`, `GET /pulse/inventory/low-stock`, `PATCH /pulse/inventory/{id}` |
| Beacons | `GET/POST /pulse/equipment`, `PATCH /pulse/equipment/{id}`, `POST .../photo` (local file mock) |

Scheduling enforces **overlap** and **supervisor / ticketed** rules; **availability** mismatches return **warnings** on create/update shift responses.

## Developer checklist

- [ ] Install **Postgres**, **Node**, **Python**.
- [ ] Configure **`backend/.env`** (`DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`).
- [ ] Run **`alembic upgrade head`**.
- [ ] Start **uvicorn**; confirm OpenAPI at `http://127.0.0.1:8000/docs` (non-production).
- [ ] Create a **company** and **tenant users** with passwords (8+ chars).
- [ ] Configure **`frontend/.env.local`** with **`NEXT_PUBLIC_API_URL`**.
- [ ] Run **`npm run dev`**; test **`/login`** → **`/overview`**.
- [ ] (Later) Point **`PULSE_UPLOADS_DIR`** / app config at **S3/R2** and replace local file writes in the beacon photo handler.

## Internal system admin API (`/api/system`)

System routes moved under **`/api/system`** (no `/api/v1` prefix). They require a JWT for a user with **`role=system_admin`** (and recommended **`is_system_admin=true`**).

- **Seed** system admin: set `SYS_ADMIN_PASSWORD` (and optionally `SYS_ADMIN_EMAIL`, default `josh.collins@helixsystems.ca`), then from `backend/`:  
  `python -m scripts.seed_sys_admin`
- **Next.js**: open **`/system`** (same app origin as Pulse). You must sign in with API mode so the session includes `is_system_admin` from **`GET /api/v1/auth/me`**.
- **Invites / reset links** use paths **`/invite?token=…`** and **`/reset-password?token=…`** on the frontend (hashed, single-use tokens on the server).

## Deploy (later)

- Run Postgres and migrations in your cloud environment.
- Run FastAPI behind HTTPS; set **`ENVIRONMENT=production`** (disables OpenAPI UI if configured).
- Build Next.js (`npm run build`) and serve with your host; set **`NEXT_PUBLIC_API_URL`** to the public API URL.
- Rotate **`SECRET_KEY`** and use managed secrets for DB and JWT.
