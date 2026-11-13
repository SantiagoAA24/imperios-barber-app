.PHONY: db-up db-down dev dev-api dev-web test lint types

db-up:
	docker compose up -d --wait db

db-down:
	docker compose down

dev-api:
	cd apps/api && uv run uvicorn app.main:app --reload --port 8000

dev-web:
	pnpm --filter web dev

# Base de datos + API (:8000) + web (:5173). Ctrl+C detiene ambos procesos.
dev: db-up
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) --no-print-directory dev-api & \
	$(MAKE) --no-print-directory dev-web & \
	wait

test:
	cd apps/api && uv run pytest -q
	pnpm --filter web test

lint:
	cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run mypy .
	pnpm --filter web lint
	pnpm --filter web lint:colors
	pnpm --filter web format:check
	pnpm --filter web typecheck

# Regenera todo lo derivado: tokens.css, openapi.json y el cliente tipado (schema.d.ts).
types:
	pnpm --filter @imperio/tokens build
	cd apps/api && uv run python -m app.export_openapi
	pnpm --filter web types
