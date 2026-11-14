# Revisión de accesibilidad (WCAG 2.2 AA)

Fase 8. Esta lista dice **qué se revisó, cómo y qué sigue pendiente**. Hay tres tipos de evidencia y no se mezclan:

- **Automática** — una prueba del repositorio lo comprueba en cada CI (se nombra el archivo).
- **Inspección de código** — se leyó el componente; la lista de abajo dice cuál.
- **Manual pendiente** — necesita una persona, un lector de pantalla o un dispositivo real. **Nadie la ha ejecutado todavía**: este documento deja el guion para hacerlo y una columna para anotar el resultado.

> Honestidad: en esta fase no se probó con VoiceOver, TalkBack ni NVDA. Lo marcado «automática» demuestra que no hay regresiones que una máquina pueda ver; no reemplaza a una persona usando un lector de pantalla.

## 1. Qué cubre la automatización

| Qué | Prueba | Falla si… |
| --- | --- | --- |
| axe-core en **todas** las rutas (cliente y barbero a 390 px, admin a 1280 px), también con diálogos, paneles y errores de campo abiertos | `apps/web/e2e/a11y-rutas.spec.ts` (+ `a11y.spec.ts`, `barber.spec.ts`, `admin-*.spec.ts`) | hay una violación `serious` o `critical` |
| Contraste WCAG de los pares de color reales | `scripts/check-contrast.mjs` (+ `check-contrast.test.mjs`) | un par queda bajo 4,5:1 (texto) o 3:1 (bordes de controles y componentes) |
| Áreas táctiles de 44 px | `a11y-rutas.spec.ts` › «Áreas táctiles de 44 px» | un botón, enlace o campo visible mide menos de 44 px (los enlaces dentro de un párrafo están exentos) |
| Enlace «Saltar al contenido», foco visible, orden de foco, agendar solo con teclado, foco atrapado en diálogos, movimiento reducido, reflujo a 320 px y texto al 200 % | `apps/web/e2e/teclado.spec.ts`, `app/accesibilidad.test.tsx` | cualquiera de esas cosas deja de cumplirse |
| Título distinto por ruta, `lang="es-CO"` | `app/accesibilidad.test.tsx`, `e2e/pwa.spec.ts` | dos rutas comparten título o cambia el idioma |
| Jerarquía de encabezados sin saltos (h1 → h3) | `app/encabezados.test.tsx` | un encabezado salta de nivel |
| Nombre accesible de cada control con solo ícono | axe (`button-name`, `link-name`, `aria-input-field-name`: son `critical`) | un control no tiene nombre |
| Lighthouse accesibilidad ≥ 95 sobre `/` y `/productos` | `pnpm --filter web lhci` | la puntuación baja de 95 |

## 2. Revisión manual: guion y estado

Estado: ✅ verificado automáticamente · 🔎 inspección de código · ⏳ manual pendiente (anota fecha, quién, dispositivo).

### 2.1 Agendamiento completo solo con teclado

Guion (escritorio, teclado físico, sin ratón):

1. Abre `/`. Primer `Tab`: aparece «Saltar al contenido». `Enter`: el foco queda en el contenido.
2. `Tab` hasta un servicio; `Enter` o `Espacio` lo elige (`aria-pressed`).
3. `Tab` hasta un barbero («Cualquiera» o uno); `Espacio`.
4. `Tab` hasta un día disponible; `Enter`. El foco pasa a la zona de horarios.
5. `Tab` hasta una hora; `Enter`. El foco pasa a «Tus datos».
6. Escribe nombre y celular (10 dígitos); `Tab` a la casilla de tratamiento de datos; `Espacio`.
7. `Tab` hasta «Confirmar cita»; `Enter`. Se llega a `/cita/<token>` con el foco en un lugar lógico.
8. Desde ahí: «Agregar al calendario», «Reprogramar» y «Cancelar cita» (diálogo) se usan solo con teclado.

| Paso | Estado | Evidencia |
| --- | --- | --- |
| Recorrido 1-7 | ✅ | `teclado.spec.ts` › «el agendamiento completo se hace solo con teclado» |
| Paso 8 (reprogramar y cancelar) | ✅ parcial | diálogo de cancelar en `teclado.spec.ts`; reprogramar con teclado ⏳ |
| Recorrido con teclado en iPad/Android externo | ⏳ | — |

### 2.2 Orden de foco

El orden del DOM es el orden visual (no se usa `tabindex` positivo ni `order` de CSS para reordenar). Cada pantalla trae un único `<main id="contenido">`.

| Qué | Estado | Evidencia |
| --- | --- | --- |
| `/` con servicio, día y hora elegidos: el foco nunca salta hacia arriba más de una fila | ✅ | `teclado.spec.ts` › «orden de foco lógico…» |
| La barra de resumen fija (abajo) queda al final del orden y no tapa el control enfocado (`scroll-padding-bottom`) | 🔎 | `styles/index.css` |
| Orden en barbero y admin (agenda semanal, paneles laterales) | ⏳ | — |

### 2.3 Foco visible

Anillo dorado sólido de 2 px con separación de 2 px (`FOCUS_RING` en `components/classes.ts`), contraste 9,4:1 sobre el fondo.

| Qué | Estado | Evidencia |
| --- | --- | --- |
| Cada parada de foco de `/` tiene anillo (`outline: solid 2px`) | ✅ | `teclado.spec.ts`. **Hallazgo corregido:** el enlace «Leer la política» no tenía anillo; ahora usa `FOCUS_RING` |
| Resto de pantallas | ⏳ | revisar con `Tab` en barbero y admin |

### 2.4 Diálogos con foco atrapado

Todos los diálogos usan el `<dialog>` nativo con `showModal()` (`components/Dialog`): la página de atrás queda inerte, `Escape` cierra, el foco entra en la opción segura (`data-autofocus`) y vuelve al botón que lo abrió.

| Qué | Estado | Evidencia |
| --- | --- | --- |
| El foco no sale del diálogo con 12 `Tab` y 12 `Shift+Tab`; `Escape` cierra; el foco vuelve al botón | ✅ | `teclado.spec.ts` › «diálogo…». Nota: en Chromium el ciclo pasa por la barra del navegador y vuelve; es el comportamiento esperado de `showModal()` |
| Diálogos de cancelar (cliente, barbero, admin), desactivar/ocultar/eliminar y salir sin guardar | 🔎 | todos usan `Dialog` |
| Con VoiceOver / TalkBack: se anuncia «diálogo» y el título | ⏳ | — |

### 2.5 Etiquetas de los botones que solo tienen ícono

axe lo vigila (`button-name` y `link-name` son `critical`). Inventario revisado en el código:

| Control | Nombre accesible |
| --- | --- |
| Flechas de día en la agenda del barbero | «Día anterior», «Día siguiente» |
| Flechas de día/semana en la agenda del admin | «Día anterior», «Día siguiente», «Semana anterior», «Semana siguiente» |
| Flecha de volver en el catálogo | «Volver a agendar» |
| Subir / bajar / editar en servicios y productos | «Subir {nombre}», «Bajar {nombre}», «Editar {nombre}» |
| Interruptores (`Switch`) | el nombre que recibe cada uno («Trabajo el lunes», «Visible para los clientes: {nombre}»…) |
| Atendida / No asistió en «Citas por revisar» | «Atendida: {cliente}, {día} {hora}» (empieza con el texto visible: cumple `label-content-name-mismatch`) |
| Recordatorio por WhatsApp | «Recordar por WhatsApp a {cliente} (se abre en otra pestaña)» / «Recordatorio enviado hace {X}. Reenviar por WhatsApp a …» |
| Insignia de «Agenda» | «{N} citas por revisar» (texto oculto visualmente; el número es `aria-hidden`) |

Estado: ✅ por axe + 🔎 por el inventario. ⏳ oírlos con un lector de pantalla.

### 2.6 Anuncios `aria-live`

| Dónde | Mecanismo | Estado |
| --- | --- | --- |
| Cargas («Cargando servicios…», agenda, productos…) | `role="status"` + `aria-busy` | 🔎 |
| Errores de red y de formulario | `role="alert"` (`Notice` tono peligro) | 🔎 |
| Resumen de la cita elegida en `/` | región `aria-live="polite"` en `BookingPage` | 🔎 |
| Marcar una cita por revisar: «Cita de {nombre} marcada como atendida.» | `role="status"` en `PendingReviewSection` | ✅ `AgendaPage.fase8.test.tsx` |
| Cambio de estado de la agenda, guardado de horario, copiar clave | `Notice` éxito (`role="status"`) | 🔎 |
| Oírlos con VoiceOver (iOS) y TalkBack (Android): que no se repitan ni se pisen | ⏳ | — |

### 2.7 Zoom al 200 % sin pérdida de contenido

| Qué | Estado | Evidencia |
| --- | --- | --- |
| Reflujo a 320 px de ancho (= 400 % en un escritorio de 1280): sin desplazamiento horizontal en `/`, `/productos`, `/privacidad`, `/ingresar`, `/offline`, 404 y las 3 pantallas del barbero | ✅ | `teclado.spec.ts` › «Zoom y reflujo» |
| Admin a 640 px (= 200 % en 1280): las 7 pantallas sin desplazamiento horizontal de la página (la rejilla de la agenda se desplaza dentro de su caja, con teclado) | ✅ | `teclado.spec.ts` |
| Texto al 200 % (tamaño de letra del navegador) en `/` | ✅ | `teclado.spec.ts` |
| Ver a ojo que nada se corta ni se solapa con el texto grande en cada pantalla | ⏳ | — |

### 2.8 `prefers-reduced-motion`

| Qué | Estado | Evidencia |
| --- | --- | --- |
| Transiciones de color: `motion-reduce:transition-none` (`TRANSITION`); con la preferencia, `transition-property: none` | ✅ | `teclado.spec.ts` › «Movimiento reducido» |
| Desplazamiento suave desactivado (`scroll-behavior: auto`) y `goToSection` usa `behavior: 'auto'` | ✅ | `teclado.spec.ts`, `lib/accessibility.ts` |
| Giro del spinner y pulso del esqueleto apagados (`motion-reduce:animate-none`) | 🔎 | `Button`, `Skeleton` |
| Todas las pruebas E2E corren con `reducedMotion: 'reduce'` (Playwright) | ✅ | `playwright.config.ts` |

### 2.9 Otros

| Qué | Estado | Evidencia |
| --- | --- | --- |
| `html lang="es-CO"` | ✅ | `index.html`, `e2e/pwa.spec.ts` |
| Un título de página distinto por ruta («Agendar cita · Imperio Barber») | ✅ | `lib/useDocumentTitle.ts`, `app/accesibilidad.test.tsx`, `e2e/pwa.spec.ts` |
| Estado de una cita nunca solo por color (palabra + ícono) | 🔎 | `StatusBadge`; la insignia de «por revisar» lleva número y texto |
| Zoom de la página bloqueado | ✅ no | el `viewport` no trae `maximum-scale` ni `user-scalable=no` |
| Modo oscuro del sistema: la app es oscura siempre (`color-scheme: dark`) | 🔎 | `index.html` |

## 3. Hallazgos de esta fase

**Corregidos, cada uno con una prueba que habría fallado antes:**

| # | Hallazgo | Corrección | Prueba (falla sin la corrección) |
| --- | --- | --- | --- |
| 1 | `/productos`: los nombres de producto eran `h3` bajo un `h1` (salto de nivel; Lighthouse `heading-order`, accesibilidad 98) | `ProductCard` recibe `headingLevel`; el catálogo usa `h2` | `app/encabezados.test.tsx` (verificado: falla sin el cambio con `h1 -> h3`) |
| 2 | «Leer la política» (casilla de consentimiento) sin anillo de foco propio | `FOCUS_RING` en el enlace | `e2e/teclado.spec.ts` › orden de foco y anillo |
| 3 | `/privacidad`: «Volver a agendar» medía 350 × 22 px | `min-h-touch` | `e2e/a11y-rutas.spec.ts` › áreas táctiles |
| 4 | Casilla de consentimiento de 20 px (WCAG 2.5.8 pide 24) | 24 px; el área de 44 px sigue siendo la etiqueta | `a11y-rutas.spec.ts` › áreas táctiles |
| 5 | Sin enlace «Saltar al contenido», sin título por ruta y sin `id` en `<main>` | `SkipLink`, `useDocumentTitle`, `id="contenido"` | `app/accesibilidad.test.tsx`, `teclado.spec.ts` |
| 6 | Texto engañoso para el barbero: «el cliente recibe el recordatorio por WhatsApp» (no hay envío automático) | «Con celular podrás recordarle su cita por WhatsApp.» | `NewAppointmentPage.test.tsx` |
| 7 | Barras de ingresos (admin): las que no son el día pico usaban `gold-edge` (33 % de opacidad) y daban **2,04:1** sobre la tarjeta (WCAG 1.4.11 pide 3:1) | pasan a `line-strong` (3,19:1; par ya vigilado por `check-contrast.mjs`); el día pico sigue en `gold`. **Cambia el aspecto**: avísalo a diseño | `OverviewPage.test.tsx` (falla con `fill-gold-edge`) |
| 8 | «Citas por revisar»: al marcar la última, la sección entera (y su región `role="status"` con «Cita de X marcada como atendida.») se desmontaba y el anuncio se perdía para lectores de pantalla | la región vive fuera de la sección (siempre montada) | `AgendaPage.fase8.test.tsx` (falla si la región se desmonta) |

**Pendientes, con motivo:**

| # | Pendiente | Motivo |
| --- | --- | --- |
| P1 | Probar con VoiceOver (iOS/macOS), TalkBack (Android) y NVDA (Windows) | Requiere dispositivos y una persona; no hay en este entorno. Guion en §2 |
| P2 | Comprobar a ojo el nuevo color de las barras del gráfico de ingresos | axe no mide gráficos SVG. Se corrigió (hallazgo 7), pero un cambio de aspecto lo debe aprobar quien diseña |
| P3 | `robots.txt` no impide que un enlace compartido aparezca en buscadores; para `/cita/…` conviene además `<meta name="robots" content="noindex">` | No era parte de esta fase; es privacidad más que accesibilidad |
| P4 | Anuncio de cambio de ruta (SPA) con el lector de pantalla: hoy lo da el cambio de `document.title` | Falta confirmar con un lector real si basta o se necesita una región `aria-live` de rutas |
| P5 | Los chips de hora tachados (`text-disabled`) quedan bajo 4,5:1 a propósito (control deshabilitado, exento por WCAG 1.4.3) | Decisión del sistema de diseño; solo se documenta |
