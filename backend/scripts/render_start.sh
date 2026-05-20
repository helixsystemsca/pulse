#!/usr/bin/env bash
# Render web service entrypoint — run migrations, then exec uvicorn (PID 1).
# Prefer setting this as the Start Command:
#   bash scripts/render_start.sh
# Optional: move migrations to Render "Pre-Deploy Command" and use only the uvicorn exec line here.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "STARTUP: alembic migrate begin"
python scripts/alembic_migrate.py
echo "STARTUP: alembic migrate complete"

if [[ -z "${PORT:-}" ]]; then
  echo "STARTUP ERROR: PORT is not set (Render sets PORT automatically)" >&2
  exit 1
fi

echo "STARTUP: launching uvicorn on 0.0.0.0:${PORT}"
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT}" \
  --proxy-headers \
  --forwarded-allow-ips='*'
