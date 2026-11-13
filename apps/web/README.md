# apps/web

React 18 + Vite + Tailwind v4. PWA instalable (`vite-plugin-pwa`).

## Comandos

- `pnpm --filter web dev` · `build` · `preview` · `test` · `lint` · `lint:colors` · `e2e`
- `make types`: regenera `tokens.css`, `openapi.json` y `src/lib/api/schema.d.ts`.
- `pnpm --filter web icons`: regenera los íconos de la PWA desde el sello.
- `/ui` (solo en desarrollo): galería de componentes a 390 px.

## TODO visible: logo vectorial

Los íconos de la PWA (`public/icons/`) salen de `design-system/assets/Logo/imperio-sello.png`, una
foto del letrero físico. **TODO:** cuando exista el logo vectorial, sustituir ese archivo y volver a
correr `pnpm --filter web icons`.

## PWA

- Precachea el shell (HTML, JS, CSS, fuentes woff2, íconos). Los chunks de barbero y administración
  no se precachean: sin red, abrir esas rutas lleva a `/offline`.
- `GET /api/v1/public/{business,services,barbers,products}`: stale-while-revalidate.
- `/availability`, `/appointments`, `/auth` (y `/me`, `/admin`): NetworkOnly, nunca en caché.
- Las funciones de `urlPattern` en `vite.config.ts` se serializan dentro de `sw.js`: no pueden usar
  variables externas.

## Flujo del cliente (fase 5)

| Ruta           | Pantalla                                          | Código                  |
| -------------- | ------------------------------------------------- | ----------------------- |
| `/`            | Agendar en 3 pasos                                | `features/booking/`     |
| `/cita/:token` | Ver, reprogramar, cancelar y añadir al calendario | `features/appointment/` |
| `/productos`   | Catálogo                                          | `features/catalog/`     |
| `/privacidad`  | Política de datos                                 | `app/pages/Privacy.tsx` |

- **PENDIENTE DE REVISIÓN LEGAL:** el texto de `/privacidad` es provisional (ver README de la raíz).
- E2E en `e2e/` (Playwright + axe, 390×844). Corren contra la API real y la web compilada:
  `scripts/e2e-setup.sh` crea la base `imperio_e2e` y `playwright.config.ts` levanta ambos servidores.
  El límite de peticiones por IP se apaga allí con `RATE_LIMIT_ENABLED=false` (ignorado en producción).
