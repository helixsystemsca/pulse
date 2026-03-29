# Maintenance System

API-first **work requests**, **work orders**, **preventive maintenance (PM)**, and **assets** — structured as a standalone module with `company_id` on tenant records for later integration into an Operations Intelligence Platform.

- **Backend:** FastAPI, SQLAlchemy 2.x (async), SQLite via `aiosqlite` (connection string compatible with PostgreSQL + `asyncpg` later).
- **Frontend:** Static HTML/CSS/JS (no build step). Point `frontend/config.js` at your API URL.
- **Auth:** Bearer JWT (`Authorization: Bearer <token>`).

## Quick start

### Backend

```powershell
cd maintenance_system\backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- On first startup, tables are created and **demo data** is seeded if the database is empty.
- Database file (default): `backend/maintenance.db`.

**Demo users** (password `demo12345`):

| Email                      | Role           |
|---------------------------|----------------|
| admin@demo.example.com   | company_admin  |
| manager@demo.example.com | manager        |
| tech@demo.example.com    | worker         |

### Frontend

Use any static host, **or** from the frontend folder:

```powershell
cd maintenance_system\frontend
python -m http.server 8080
```

Open `http://127.0.0.1:8080`. Set `window.__MAINT_API_BASE__` in `config.js` to match the API (default `http://127.0.0.1:8000`). The backend `CORS_ORIGINS` must include your frontend origin (see `.env.example`).

## API overview

Base URL: `http://127.0.0.1:8000` (default).

| Area              | Method & path | Notes |
|-------------------|---------------|--------|
| Health            | `GET /health` | Liveness |
| Auth              | `POST /auth/register` | Body: email, password, full_name, company_name — creates tenant + `company_admin` |
| Auth              | `POST /auth/login` | Returns JWT + user |
| Users             | `GET /users` | Admins |
| Users             | `POST /users` | Admins — create tenant user |
| Users             | `GET /users/me` | Current profile |
| Users             | `GET /users/{id}`, `PATCH /users/{id}` | Admins |
| Assets            | `GET /assets?q=` | Search |
| Assets            | `POST /assets`, `PATCH /assets/{id}` | Manager+ |
| Work requests     | `GET /work-requests?status_filter=&q=` | Workers: own requests; manager+: all |
| Work requests     | `POST /work-requests` | Create |
| Work requests     | `POST /work-requests/{id}/approve` | Manager+ |
| Work requests     | `POST /work-requests/{id}/reject` | Body: `reason` |
| Work requests     | `POST /work-requests/{id}/convert` | Approved → work order |
| Work orders       | `GET /work-orders?status_filter=&q=` | Workers: assigned only |
| Work orders       | `POST /work-orders` | Manager+ |
| Work orders       | `GET /work-orders/{id}` | Assignee or manager+ |
| Work orders       | `PATCH /work-orders/{id}` | Manager+ |
| Work orders       | `POST /work-orders/{id}/assign` | Manager+ |
| Work orders       | `POST /work-orders/{id}/status` | Assignee or manager+ |
| Work orders       | `POST /work-orders/{id}/notes` | |
| Work orders       | `POST /work-orders/{id}/attachments` | Metadata only (placeholder storage URI) |
| PM                | `GET /pm/schedules` | |
| PM                | `POST /pm/schedules` | Manager+ |
| PM                | `GET /pm/schedules/{id}`, `PATCH ...` | |
| PM                | `POST /pm/generate-due` | Create WOs for due schedules (no open PM WO) |
| PM                | `GET /pm/completions?schedule_id=` | History |
| Dashboard         | `GET /dashboard/summary` | Counts for UI |

Interactive docs: `http://127.0.0.1:8000/docs`.

## Integration notes

- Major entities include **`company_id`** and user references (`requested_by_user_id`, `assigned_to_user_id`, etc.).
- JSON shapes mirror Pydantic schemas under `backend/app/schemas/`.
- **Audit** rows (`audit_logs`) and **notification** rows (`notification_logs`, channel `log`) record key actions for future bus/webhook integration.

## Layout

```text
maintenance_system/
  backend/
    app/
      core/          # JWT, password hashing
      models/        # SQLAlchemy models
      routes/        # FastAPI routers
      services/      # Domain logic
      schemas/       # Request/response models
      main.py
    requirements.txt
    .env.example
  frontend/
    index.html
    *.html
    app.js
    config.js
    styles.css
```

## Roles (RBAC)

| Role            | Capabilities (summary) |
|-----------------|-------------------------|
| `company_admin` | Full within tenant (users, assets, WOs, PM, requests) |
| `manager`       | Work orders, PM, assignments, approve/convert requests |
| `worker`        | Assigned work orders: status, notes, attachments; own work requests |
| `system_admin`  | Reserved enum value for future platform scope |
