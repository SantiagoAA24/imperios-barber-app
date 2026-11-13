# Imperio Barber
PWA de citas para barberías. Monorepo: apps/web (React+TS), apps/api (FastAPI), packages/tokens.

## Comandos
- make dev | make test | make lint | make types   (types regenera el cliente desde OpenAPI)
- API: cd apps/api && uv run pytest -q
- Web: pnpm --filter web test && pnpm --filter web e2e

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