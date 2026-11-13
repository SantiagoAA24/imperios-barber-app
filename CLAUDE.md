# Imperio Barber
PWA de citas para barberías. Monorepo: apps/web (React+TS), apps/api (FastAPI), packages/tokens.

## Comandos
- make dev | make test | make lint | make types   (types regenera el cliente desde OpenAPI)
- make db-up | make db-down   (PostgreSQL 16 en Docker; API y web corren en el host)
- API: cd apps/api && uv run pytest -q   (también ruff y mypy --strict vía make lint)
- Web: pnpm --filter web test   (e2e con Playwright llega en la fase 5)
- make types solo imprime "disponible desde la fase 4" por ahora.

## Estructura
- apps/api/app: routers (solo HTTP), services (reglas), availability (cálculo puro), models, schemas, core.
- Los routers validan, autorizan y llaman a un servicio; no contienen reglas de negocio.
- docs/arquitectura.md es el plan; las desviaciones se anotan en docs/decisiones.md.
- design-system/ es de solo lectura salvo que se pida lo contrario.

## Reglas de negocio
- Slots cada 30 min; la disponibilidad se calcula solo en apps/api/availability.
- Tolerancia de 5 min; la cita vencida la decide el barbero, no el sistema.
- Precios en pesos enteros (COP); fechas en UTC; zona del negocio America/Bogota.
- Toda consulta filtra por business_id.

## Convenciones
- Textos en español (Colombia), tuteo; precios $22.000, horas 10:30 am.
- Estilos solo con variables de packages/tokens; nunca colores en hexadecimal.
- Botones y enlaces reales, áreas táctiles de 44 px, estado nunca solo por color.
- Una migración por cambio de esquema; nunca editar migraciones ya aplicadas.

## Flujo
- Rama por fase (fase-3-disponibilidad); PR pequeño; pruebas antes del código en availability.
- No instalar dependencias nuevas sin pedirlo.