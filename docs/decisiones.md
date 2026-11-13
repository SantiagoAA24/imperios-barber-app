# Decisiones

Registro de decisiones que se apartan de `arquitectura.md` o que la completan. Una entrada por decisión, la más reciente arriba.

Formato:

```text
## AAAA-MM-DD · Título corto
Contexto: qué pasaba.
Decisión: qué se hizo.
Motivo: por qué.
Impacto: qué fases o secciones cambian.
```

## 2026-11-13 · Decisiones de la fase 1 (esquema y modelos)
Contexto: el prompt de la fase 1 deja varios detalles abiertos.
Decisión:
- Enums como tipos nativos de PostgreSQL (`user_role`, `appointment_status`, `appointment_source`, `product_availability`); la migración los elimina al hacer downgrade.
- `appointment.status` es `booked` por defecto en la base; `no_show` y `cancelled` no bloquean el hueco (la exclusión solo cubre `booked` y `attended`).
- CHECK extra no pedidos: `email = lower(email)` en `user`; `appointment.price_cop >= 0` y `duration_min > 0`; `product.price_cop >= 0`; `resource.capacity > 0`; valores positivos/no negativos en los parámetros de `business`.
- Duración de servicio múltiplo de 5 con `mod(duration_min, 5) = 0` (evita `%` en SQL, que Alembic duplica al renderizar).
- La restricción por recurso asume capacidad 1; `resource.capacity` se guarda pero no se aplica en la base.
- `business_id` no se verifica entre tablas (p. ej. una cita con barbero de otro negocio): lo garantizará la capa de servicios en la fase 3.
- La extensión `btree_gist` no se elimina en el downgrade, por si otros objetos la usan.
- `DATABASE_URL` pasa a `postgresql+psycopg://`; `app.core.db.driver_url` también convierte `postgresql://` por si un `.env` viejo no se actualizó.
- Las pruebas crean `imperio_test` (y `imperio_test_migraciones` para el ciclo de Alembic) en el mismo servidor, migran con Alembic y las borran al final; requieren un rol con permiso para `CREATE DATABASE` y `CREATE EXTENSION` (el de `docker-compose.yml` lo tiene).
- El job `api` del CI ahora levanta un servicio PostgreSQL 16 porque las pruebas lo necesitan.
- Seed: nombre del admin "Administrador"; los 8 productos, sus precios y descripciones son valores de ejemplo.
Motivo: cerrar los huecos sin cambiar el alcance de la fase.
Impacto: la fase 3 puede apoyarse en 23P01 para el 409; fase 2 usa `get_session`.

## 2026-11-13 · Dependencias implícitas en la fase 0
Contexto: la fase 0 nombra FastAPI, pytest, ruff, mypy, Vitest, Testing Library, ESLint y Prettier, pero estas herramientas no funcionan sin otras piezas que el prompt no nombra.
Decisión: se instalaron `uvicorn[standard]` (servidor para `--reload`), `httpx` (lo exige `TestClient` de FastAPI), `jsdom` (entorno DOM de Vitest), `@vitejs/plugin-react`, `@testing-library/dom` (peer de Testing Library), `@eslint/js`, `globals` y los tipos `@types/react` y `@types/react-dom`. TypeScript se fijó en 6.0.x porque typescript-eslint no soporta la versión 7.
Motivo: sin ellas no arrancan la API, las pruebas ni el lint.
Impacto: ninguna dependencia de negocio. Revisar `httpx` frente a `httpx2` cuando Starlette elimine el aviso de obsolescencia.

## 2026-11-13 · Prettier también en `make lint` y en el CI
Contexto: el prompt pide Prettier pero no dice dónde se verifica.
Decisión: `prettier --check` corre en `make lint` y como un paso extra del job web del CI.
Motivo: que el formato no se desvíe sin que nadie lo note.
Impacto: ninguno en fases posteriores.
