#!/usr/bin/env bash
# Dependency vulnerability scan (npm + Python). Requires: npm, pip-audit (pip install pip-audit).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== Pulse dependency security audit ==="
echo ""
echo "--- Python (pip-audit) ---"
if command -v pip-audit >/dev/null 2>&1; then
  pip-audit -r "$ROOT/backend/requirements.txt" || true
else
  echo "pip-audit not installed. Run: pip install pip-audit"
fi
echo ""
echo "--- Frontend (npm audit) ---"
if [ -f "$ROOT/frontend/package.json" ]; then
  (cd "$ROOT/frontend" && npm audit --audit-level=moderate) || true
else
  echo "frontend/package.json not found"
fi
echo ""
echo "Done. Review findings and SECURITY_HARDENING_REPORT.md for CI recommendations."
