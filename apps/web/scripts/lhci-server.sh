#!/usr/bin/env bash
# Servidor para Lighthouse CI: base de pruebas sembrada + API real + la web compilada servida con
# compresión (scripts/serve-dist.mjs). Lo arranca y lo detiene `lhci` (startServerCommand).
# Con LHCI_SKIP_BUILD=1 reutiliza el dist/ que ya exista.
set -euo pipefail

WEB="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${LHCI_API_PORT:-8100}"
cd "$WEB"

bash ../../scripts/e2e-setup.sh
if [ "${LHCI_SKIP_BUILD:-0}" != "1" ]; then pnpm build; fi

(
  cd ../api
  DATABASE_URL='postgresql://imperio:imperio@localhost:5432/imperio_e2e' \
  JWT_SECRET='secreto-solo-para-e2e-0123456789abcdef0123456789' \
  COOKIE_SECURE=false ENVIRONMENT=test RATE_LIMIT_ENABLED=false \
  ALLOWED_ORIGINS='http://localhost:4173' \
  exec uv run uvicorn app.main:app --host 127.0.0.1 --port "$API_PORT"
) &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT INT TERM

API_PROXY_TARGET="http://127.0.0.1:${API_PORT}" node scripts/serve-dist.mjs 4173
