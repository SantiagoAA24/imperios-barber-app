# Imperio Barber

PWA de agendamiento de citas para una barbería en Bogotá. Monorepo con la web (React), la API (FastAPI) y los tokens del sistema de diseño.

La arquitectura y el plan por fases están en [`docs/arquitectura.md`](docs/arquitectura.md); el sistema de diseño, en [`design-system/`](design-system/README.md).

## Requisitos

- Node 22 y pnpm 10 (`corepack enable`)
- Python 3.12 y [uv](https://docs.astral.sh/uv/)
- Docker (solo para PostgreSQL)
- make

## Primeros pasos

```bash
cp .env.example .env
pnpm install
(cd apps/api && uv sync)
make dev
```

`make dev` levanta PostgreSQL 16, la API en <http://localhost:8000/health> y la web en <http://localhost:5173>. La web reenvía `/api` a la API.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `make db-up` / `make db-down` | Inicia o detiene PostgreSQL |
| `make dev` | Base de datos + API con recarga + web |
| `make test` | pytest y Vitest |
| `make lint` | ruff, mypy, ESLint, Prettier y `tsc` |
| `make types` | Cliente de API desde OpenAPI (disponible desde la fase 4) |

## Estructura

```text
apps/web          Vite + React 18 + TypeScript
apps/api          FastAPI (Python 3.12, uv)
packages/tokens   Tokens del sistema de diseño
docs/             Arquitectura y decisiones
design-system/    Sistema de diseño
```
