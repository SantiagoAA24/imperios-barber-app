#!/usr/bin/env bash
# Crea (desde cero), migra y siembra la base de datos de pruebas E2E: imperio_e2e.
# Usa el mismo servidor PostgreSQL de DATABASE_URL (make db-up) pero otra base, así nunca toca
# los datos de desarrollo. Lo ejecuta playwright.config.ts antes de levantar la API.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_DB="${E2E_DB:-imperio_e2e}"
BASE_URL="${E2E_DATABASE_SERVER_URL:-postgresql://imperio:imperio@localhost:5432}"

cd "$ROOT/apps/api"

export DATABASE_URL="${BASE_URL}/${E2E_DB}"
export JWT_SECRET="${JWT_SECRET:-secreto-solo-para-e2e-0123456789abcdef0123456789}"

echo "E2E: recreando la base ${E2E_DB}…"
uv run python - "$BASE_URL" "$E2E_DB" <<'PY'
import sys

from sqlalchemy import create_engine, text

from app.core.db import driver_url

server, name = sys.argv[1], sys.argv[2]
admin = create_engine(driver_url(f"{server}/postgres"), isolation_level="AUTOCOMMIT")
with admin.connect() as conn:
    conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
    conn.execute(text(f'CREATE DATABASE "{name}"'))
admin.dispose()
PY

echo "E2E: migrando…"
uv run alembic upgrade head

echo "E2E: sembrando…"
uv run python -m app.seed

echo "E2E: historial del resumen…"
uv run python -m app.seed_e2e

echo "E2E: base ${E2E_DB} lista."
