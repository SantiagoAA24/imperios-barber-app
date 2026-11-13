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

## 2026-11-13 · Decisiones de la fase 4 (frontend base)
Contexto: el prompt de la fase 4 deja detalles abiertos o choca con los archivos del sistema de diseño.
Decisión:
- Nombres de tokens CSS por valor en px (`--space-4` = 4 px) como pide el prompt; se añadieron `--text-*` (tamaño, interlineado, peso por estilo) y `--shadow-logo-glow`, porque los componentes no pueden usar tamaños fuera de los tokens.
- `@theme inline` apunta a las variables de `tokens.css`; donde el nombre coincide la variable de tema se apunta a sí misma, y `tokens.css` (sin capa) gana a `@layer theme`.
- Sin `@types/node`: `vite.config.ts` usa una declaración mínima de `node:fs`.
- Los íconos de la PWA se generan con un script en Node puro (zlib) desde el sello PNG, sin añadir una librería de imágenes. TODO: logo vectorial.
- Los chunks de barbero/admin no se precachean; sin red, `RouteBoundary` y `RutaProtegida` llevan a `/offline`.
- Las pruebas de 44 px leen `min-height`/`height` declarados (jsdom no calcula layout); en Chromium real se comprobó con getBoundingClientRect en `/ui`.
- Se omitió `@testing-library/user-event` y `jest-dom` (no nombrados): se usa `fireEvent` y aserciones simples.
- El CI del job web instala uv y ejecuta `make types` + `git diff --exit-code`.
Motivo: cerrar los huecos sin añadir dependencias no pedidas.
Impacto: fases 5 en adelante reutilizan componentes, cliente y guardia de rutas.

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

## 2026-11-13 · Decisiones de la fase 2 (catálogo público y autenticación)
Contexto: el prompt de la fase 2 deja varios detalles abiertos.
Decisión:
- Dependencias nuevas, las que pide el prompt: `pyjwt` y `slowapi` (con `limits`). `argon2-cffi` ya estaba.
- `JWT_SECRET` ya no tiene valor por defecto: sin él, o con menos de 32 caracteres, la app no arranca. El `.env` local debe actualizarse (ver `.env.example`); el CI y `conftest.py` fijan uno de prueba.
- `COOKIE_SECURE` (por defecto `true`) y `ENVIRONMENT` (`production` activa HSTS) son variables nuevas; `.env.example` pone `COOKIE_SECURE=false` solo para desarrollo local.
- Login: el tope de 5/min se aplica por separado a la IP y al correo (normalizado), contando todos los intentos. Un usuario inactivo recibe el mismo `invalid_credentials`. Con correo inexistente se gasta una verificación argon2 de relleno para igualar tiempos.
- Los límites viven en memoria del proceso (`memory://`): sirven con un solo worker. Con varios, pasar a Redis antes de producir. Detrás de un proxy, la IP depende de `--proxy-headers` en uvicorn.
- Los 120/min de las rutas públicas son un tope compartido entre las cuatro rutas por IP.
- Origin: si la petición trae `Origin` y no está en `ALLOWED_ORIGINS`, 403 `origin_not_allowed` (incluye `null`). Si no trae `Origin` (curl, servidores) pasa, porque un navegador siempre lo manda y el riesgo de CSRF es de navegador.
- Un access token solo vale en el negocio de su `business_id`: si el Host resuelve a otro negocio, 401 `invalid_token`. Además, `current_user` carga al usuario por `id` y `business_id` del token y exige `active`, así que desactivar a alguien corta su acceso de inmediato sin esperar los 15 min. El rol sale de la base, no del claim.
- "Familia" del refresh = la cadena de rotaciones de un login (`family_id`). Reutilizar un refresh ya rotado o cerrado revoca esa cadena; las demás sesiones del mismo usuario siguen vivas. Dos refresh simultáneos con el mismo token se serializan (`FOR UPDATE`), así que el segundo cuenta como reutilización: la web debe evitar refrescar en paralelo desde varias pestañas.
- Un refresh inválido, vencido o reutilizado borra ambas cookies en la respuesta 401. `/auth/logout` es idempotente y responde 204.
- `/auth/*` responde `Cache-Control: no-store`; las rutas públicas añaden `Vary: Host`.
- `barber` no tiene columna `sort`: `/public/barbers` ordena por `display_name`. Tampoco se cruza con `user.active` (el prompt pide solo `visible_in_booking` y `active` del barbero).
- La tabla `refresh_token` no lleva `business_id` (el prompt fija sus columnas): el negocio se verifica a través del usuario en cada refresh.
- Los errores 422 devuelven solo `loc` y `type` de cada campo, nunca el valor enviado, para no eco de contraseñas.
- Pruebas asíncronas con el plugin `anyio` que ya trae el entorno (`@pytest.mark.anyio`), sin `pytest-asyncio`.
- `/admin/ping` y `/me/ping` son rutas de apoyo; se reemplazan en las fases 6 y 7.
Motivo: cerrar los huecos sin cambiar el alcance de la fase.
Impacto: la fase 3 puede usar `CurrentBusiness`, `DbSession`, `BarberUser` y `AdminUser` (`app.core.tenant`, `app.core.db`, `app.core.security`).

## 2026-11-13 · Decisiones de la fase 3 (disponibilidad y reservas)
Contexto: el prompt de la fase 3 deja varios detalles abiertos y un caso real de concurrencia no previsto.
Decisión:
- Dependencias de desarrollo nuevas, las autorizadas: `pytest-cov`, `pytest-asyncio` y `hypothesis`. Las pruebas asíncronas siguen usando `anyio` (como la fase 2); `pytest-asyncio` quedó instalado y configurado (`asyncio_default_fixture_loop_scope`) pero sin uso.
- **Deadlock como carrera perdida.** Dos INSERT simultáneos contra la restricción de exclusión pueden bloquearse entre sí y PostgreSQL aborta a uno con SQLSTATE `40P01` en vez de `23P01`. Se trata igual que 23P01 (rollback al savepoint, siguiente candidato o 409). Cuesta hasta ~1 s (`deadlock_timeout`) en el perdedor. Sin esto, "cualquiera" fallaba con 500.
- Cada intento de INSERT va en un SAVEPOINT (`begin_nested`): así el cliente recién creado sobrevive al intento fallido y se prueba el siguiente barbero dentro de la misma transacción.
- Cliente: `INSERT ... ON CONFLICT DO NOTHING` + `SELECT`, y luego se actualiza `consent_at` (conserva el nombre existente). Ese UPDATE toma el bloqueo de la fila del cliente, lo que serializa el conteo de `too_many_active` por celular sin `FOR UPDATE` explícito.
- `SELECT ... FOR UPDATE` solo se usa en cancelar y reprogramar, sobre la misma cita, para que ambas operaciones no se pisen. No sustituye las restricciones de exclusión, que siguen siendo la garantía contra la doble reserva.
- Reloj inyectable (`app.core.clock.utcnow`, dependencia `Now`): `compute_slots` y el servicio reciben `now` por parámetro; las pruebas lo sustituyen con `dependency_overrides`.
- Validación de nombre, celular y consentimiento en el servicio (no con pydantic) para devolver códigos propios: `invalid_name`, `invalid_phone`, `consent_required`. Honeypot con texto: 400 `bad_request` genérico.
- Se rechaza también en el POST (no solo en `/availability`) un día pasado o a más de 60 días: 422 `date_out_of_range`. Un horario de hoy ya pasado o dentro del margen responde 409 `slot_unavailable`.
- Respuestas de la cita: se añadió `id` a `service` y `barber` (el prompt no los lista) para que el frontend pueda pedir disponibilidad al reprogramar. Precio y duración salen de la cita (snapshot); el nombre, del servicio vivo. Nunca se devuelve el celular.
- Reprogramar conserva barbero, duración y recurso de la cita original; si el barbero ya no está activo, 409. Cita no `booked`: 409 `appointment_not_active`. Fuera de plazo al reprogramar: 409 `too_late_to_reschedule`. El texto del plazo se arma con `cancel_min_notice_min` ("1 hora", "2 horas", "45 minutos").
- Alternativas del 409: hasta 3 horarios libres del mismo día, los más cercanos al pedido (empate: el más temprano), en orden cronológico; se recalculan con la base después de perder la carrera. Con barbero fijo solo se ofrecen los de ese barbero.
- Límite de 10 solicitudes/hora por IP solo en `POST /public/appointments`; cancelar, reprogramar y ver comparten el tope general de 120/min. El límite sigue en memoria del proceso (ver fase 2).
- Rutas de reservas en `routers/booking.py` (sin el `Cache-Control: public` del router de catálogo): todas responden `no-store`.
- Citas con `attended` bloquean horario igual que `booked`; `no_show` y `cancelled` lo liberan.
- Limitación conocida: el tope `max_active_per_phone` cuenta citas `booked` futuras; un cliente con dos celulares puede sumar más. Es una defensa contra abuso casual, no un control de identidad.
Motivo: cerrar los huecos sin cambiar el alcance de la fase.
Impacto: las fases 5 y 6 consumen estas rutas; la fase 6 debe reutilizar `availability_for` y tratar 40P01 igual que 23P01 al crear citas manuales.
