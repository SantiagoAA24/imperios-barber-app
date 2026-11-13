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

## 2026-11-13 · Decisiones de la fase 5 (flujo del cliente)
Contexto: el prompt de la fase 5 y los diseños de `design/screens/` difieren en algunos puntos, y faltaban piezas en el sistema de diseño.
Decisión:
- **Dependencias de desarrollo nuevas, las autorizadas:** `@playwright/test` (1.63.0, la versión del navegador ya instalado) y `@axe-core/playwright`.
- **Orden de los pasos:** el prompt manda (1 Servicio + Barbero, 2 Día y hora, 3 Tus datos); el prototipo `agendar.dc.html` tenía Barbero como paso aparte y un bloque "Resumen" en el flujo. El resumen pasó a una barra fija abajo (`SummaryCard variant="bar"`), como pidió el prompt.
- **Cabecera de `/`:** sello de 44 px + "Imperio Barber" + enlace "Productos", como pidió el prompt; el diseño traía el sello de 132 px centrado y sin enlace.
- **Textos del prompt sobre los del diseño:** "Agregar al calendario" (el diseño decía "Añadir"), "Reprogramar" ("Reagendar"), "Agotado" ("Agotado por ahora").
- **Sin motivo de cancelación:** `cliente-cancelar.dc.html` trae chips de "¿Qué pasó?"; la API no tiene dónde guardarlo, así que no se muestran. El diálogo conserva título, resumen, "Sí, cancelar cita", "Mantener mi cita" y "Prefiero reprogramar".
- **Sin filtros por categoría en `/productos`:** el diseño trae chips (Cabello, Barba…); `product` no tiene categoría. Se muestran todos.
- **Componentes añadidos al sistema (cada uno con su prueba):** `Checkbox`, `Dialog` (elemento `<dialog>` nativo: `showModal` da el foco atrapado y Escape), `Skeleton`, `AppointmentCard` (cita-confirmada.dc.html), `ProductCard`. Variantes nuevas: `Button` `danger`, `danger-outline` y `ghost`; `DayChip` `note` ("sin cupo"); `SummaryCard` `variant="bar"` y `totalCop` nulo; `StepHeader` `headingRef`. Iconos: flecha atrás, chevron, frasco y tienda.
- **Disponibilidad:** el cliente solo muestra lo que devuelve `/public/availability`. Se consultan 7 días en paralelo (`useQueries`, `staleTime` 0); si el día elegido se queda sin cupo, se pasa al primer día con horarios. El plazo de cancelación y los límites los decide la API (`can_cancel`, `can_reschedule`, 409 con su `message`).
- **Barbero "Cualquiera":** se envía `barber_id: null`; `/cita/<token>` muestra el barbero que la API asignó.
- **Foco por teclado:** se detecta con `event.detail === 0` en el clic del botón (Enter/Espacio). Con teclado, el foco va al encabezado del paso siguiente; con ratón o toque solo se desplaza (suave, salvo `prefers-reduced-motion`). El paso 1 se da por completo al elegir barbero con el servicio ya elegido; el paso 2, al elegir hora.
- **409 `slot_unavailable`:** se invalida la disponibilidad, se conserva todo lo escrito y se ofrecen hasta 3 alternativas (`details.alternatives`). Igual al reprogramar.
- **Teléfono:** el cliente envía los 10 dígitos nacionales (sin `+57`); la API normaliza a E.164. La validación del cliente (nombre 2-60, celular que empieza por 3) solo adelanta el aviso; la API vuelve a validar.
- **Enlace de privacidad:** abre en otra pestaña para no perder lo escrito en el formulario.
- **`/privacidad`:** texto provisional con la marca visible `PENDIENTE DE REVISIÓN LEGAL` (también en el código y en el README). Falta razón social, NIT y datos de contacto del responsable.
- **Pruebas E2E:** `scripts/e2e-setup.sh` recrea `imperio_e2e` (mismo servidor que `DATABASE_URL`, otra base), migra y siembra. Playwright levanta la API en `:8100` y la web **compilada** con `vite preview` en `:4173` (el service worker solo existe en la compilación); `API_PROXY_TARGET` apunta el proxy de `/api` a la API de pruebas. Un solo trabajador y `reducedMotion: 'reduce'`.
- **API: `RATE_LIMIT_ENABLED`:** variable nueva (por defecto `true`) para apagar el límite por IP solo en E2E, donde todas las pruebas comparten IP. En `ENVIRONMENT=production` se ignora y el límite queda siempre activo.
- **Service worker:** `vite-plugin-pwa` no activa `clientsClaim`, así que la primera visita no queda controlada por el service worker; el catálogo se guarda en caché desde la segunda carga. La prueba offline lo tiene en cuenta (recarga una vez).
Motivo: cerrar los huecos sin cambiar el alcance de la fase.
Impacto: la fase 6 (barbero) puede reutilizar `SlotPicker`/`useSlotPicker` y los componentes nuevos; la fase 8 debe quitar la marca legal de `/privacidad` solo tras la revisión.

## 2026-11-13 · Decisiones de la fase 6 (panel del barbero)
Contexto: el prompt de la fase 6 y los diseños `barbero*.dc.html` dejaban huecos o diferían en algunos puntos.
Decisión:
- **Rutas añadidas:** `GET /me/availability?service_id&date` (horarios libres del propio barbero, sin margen de anticipación) para la cita manual; el prompt no la listaba y la pública exige que el barbero sea visible al agendar.
- **Respuestas:** la agenda devuelve `{date, appointments, summary}`; `summary.total` nunca cuenta canceladas (aunque se pida `include_cancelled`). `GET/PUT /me/schedule` usan `{schedule, conflicts}`; el PUT recibe `{schedule: [...]}`. `GET /me/time-off` lista solo ausencias en curso o futuras.
- **Celular:** `phone_masked` ("300 *** 4567") siempre; `phone_e164` solo en citas pendientes o no asistió (las que se pueden necesitar contactar por WhatsApp).
- **Transiciones:** booked→attended/no_show/cancelled y no_show→attended. `attended` desde 15 min antes (`too_early_for_attended`); `no_show` solo con `now > starts_at + tolerance_min`. no_show→attended puede chocar con una cita nueva en ese hueco: 409 `slot_taken`. Una cita ajena o de otro negocio responde 404.
- **Next-free** (`availability/next_free.py`, pura y con pruebas): hoy, `now` redondeado hacia arriba a 5 min, sin cuadrícula de 30 ni margen de anticipación; 409 `no_free_time` si hoy ya no cabe.
- **Turno sin cita y carrera:** si otra cita gana el hueco (p. ej. el otro barbero con el vaporizador), se responde 409 `slot_unavailable` con la nueva hora en `details.alternatives`, en vez de cambiar la hora en silencio.
- **Nota y consentimiento:** sin migración. El cliente nuevo queda con `consent_at` nulo y `notes` = "Consentimiento recogido en persona." (+ nota opcional). La pantalla no expone el campo de nota todavía; la API sí (`note`).
- **Horario:** tramos de 30 min, hasta 4 por día en la API (la pantalla ofrece 2), tramos pegados válidos. Una cita que no cabe entera en un tramo es conflicto; no se cancela nada.
- **Ausencias:** la pantalla usa `datetime-local` interpretado en hora de Bogotá (UTC-5).
- **Componentes nuevos (con prueba):** `Switch` y `StatusBadge`; íconos plus, check, papelera, alerta, WhatsApp y actualizar. `useSlotPicker` acepta `own` para reutilizar el selector con `/me/availability`.
- **Sondeo:** `refetchInterval` de 30 s con `refetchIntervalInBackground: false`; "Actualizado hace X" se refresca cada 5 s y hay botón "Actualizar".
- **Diferencias con el diseño:** botón "Atendida" (el diseño decía "Llegó"); sin tarjeta "Siguiente" separada ni barra de tolerancia (la siguiente se resalta dentro de la lista); sin "Hueco libre / Turno sin cita" intercalado en la lista; "Horas bloqueadas" pasó a "Ausencias"; el resumen es una tarjeta en el flujo (no barra fija) porque abajo va la navegación fija.
- **Rate limit:** el tope de 5 intentos/min por correo ahora también respeta `RATE_LIMIT_ENABLED` (solo se apaga en E2E; en producción siempre activo).
- **E2E:** el horario de barbero1 se fija a 00:00-23:30 antes de cada prueba para no depender de la hora de ejecución (falla solo si corre entre 23:45 y 00:00).
Motivo: cerrar los huecos sin cambiar el alcance de la fase.
Impacto: la fase 7 (admin) puede reutilizar `Switch`, `StatusBadge` y los conflictos de horario.

## 2026-11-13 · Decisiones de la fase 7, PR 1 (Servicios)
Contexto: primera pantalla del panel de administración; el prompt y `design/screens/admin-servicios.dc.html` dejaban huecos o diferían.
Decisión:
- **Rutas:** `GET/POST /admin/services`, `PATCH/DELETE /admin/services/{id}` y `PUT /admin/services/order`, todas con `require_role('admin')` y filtradas por el `business_id` del token (un servicio de otro negocio responde 404). `GET` y `PUT order` devuelven `{items, resources}`: los recursos del negocio salen ahí para no añadir una ruta solo para el checkbox del vaporizador.
- **Orden:** `PUT /admin/services/order` exige la lista completa de ids, sin repetir ni ajenos (422 `invalid_order`); asigna `sort` 0..n-1. Un servicio nuevo entra al final. El orden es el mismo en la web pública.
- **PATCH parcial:** solo cambian los campos enviados; `description` y `resource_id` aceptan `null`, el resto no. Un `resource_id` de otro negocio responde 422 `invalid_resource`. Precio y duración se copian a la cita al reservar, así que el cambio solo afecta a las reservas futuras (prueba con una cita antes y otra después).
- **DELETE:** 409 `has_history` si existe cualquier cita (incluidas canceladas) con ese servicio; la FK queda como segunda defensa. Mensaje tal cual lo pidió el prompt.
- **Prueba de acceso:** `tests/api/test_admin_acceso.py` parametriza 401/403 sobre todas las operaciones `/admin` leídas del OpenAPI de la app; las pantallas siguientes quedan cubiertas sin tocarla.
- **Frontend:** `Switch` en la columna "Estado" (desactivar pide confirmación; activar no), "Subir"/"Bajar" como botones, panel lateral con el mismo formulario para crear y editar, aviso de cambios sin guardar. Como la app usa `BrowserRouter` (sin `useBlocker`), el aviso intercepta los clics en enlaces internos y `beforeunload` (`useUnsavedGuard`, reutilizable en Productos y Barberos).
- **Catálogo público:** responde `Cache-Control: public, max-age=60`, así que un cambio de precio puede tardar hasta un minuto en verse en un navegador que ya lo cargó. No se cambió; la prueba E2E usa un visitante nuevo.
- **Diferencias con el diseño:** columna "Estado" con interruptor en vez de "Visible" (y "Oculto para los clientes" bajo el nombre); se añaden "Subir/Bajar" y "Eliminar servicio" (el diseño traía "Archivar"); "Nota para el cliente" pasó a "Descripción para el cliente" (es `description`, máx. 200); el checkbox del vaporizador solo aparece si el negocio tiene un recurso; el panel no se abre por defecto (aparece al pulsar "Editar" o "Agregar servicio"); sin el bloque "Ajustes" en la barra lateral (no existe la pantalla); iconos de la barra lateral sin añadir (la barra ya existía sin ellos).
Motivo: cerrar los huecos sin cambiar el alcance del PR.
Impacto: Productos reutiliza `CatalogHeader`, `useUnsavedGuard`, `moveId` y el patrón del panel; Barberos, `useUnsavedGuard`.

## 2026-11-13 · Decisiones de la fase 7, PR 2 (Productos)
Contexto: segunda pantalla del admin; mismo patrón que Servicios.
Decisión:
- **Rutas** (solo admin, filtradas por `business_id`): `GET/POST /admin/products`, `PATCH/DELETE /admin/products/{id}`, `PUT /admin/products/order` (lista completa, 422 `invalid_order`). Respuesta de lista: `{items}`.
- **`image_url`:** solo `https://`, máx. 500 caracteres; vacío se guarda como `null`; cualquier otro esquema (`http:`, `javascript:`) responde 422. Sin subida de archivos en el MVP.
- **DELETE:** los productos no tienen historial (solo catálogo), así que se pueden eliminar con confirmación; ocultar también pide confirmación.
- **Pantalla:** "Disponibilidad" con palabra e ícono (Disponible / Agotado) y un interruptor "Hay en inventario" en el panel; "Estado" con interruptor de visible. Reutiliza `CatalogHeader`, `useUnsavedGuard` y `moveId`.
- **Diferencias con el diseño:** el diseño de productos (`admin-productos.dc.html`) tiene categorías y fotos subidas; `product` no tiene categoría y no hay subida, así que se edita un enlace https a la foto.
Motivo: cerrar los huecos sin cambiar el alcance del PR.
Impacto: ninguno en otras pantallas.
