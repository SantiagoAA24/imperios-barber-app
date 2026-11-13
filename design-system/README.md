Imperio es una barbería de ambiente nocturno y acabado de lujo: negro profundo, dorado espejo y caligrafía ornamental, como su sello circular. Esta guía rige la web-app de agendamiento (clientes sin registro, panel de barberos y panel de administración). Está pensada primero para celular (390 px de ancho).

## Fundamentos de contenido

- Escribe en español de Colombia, tuteando: "Agenda tu cita", "Elige tu servicio", "Tus datos". Frases cortas, directas y cálidas; sin jerga ni exclamaciones salvo en la confirmación final.
- Los botones son verbos en infinitivo o imperativo: "Confirmar cita", "Cancelar cita", "Reagendar". Si falta un dato, el botón lo dice: "Elige una hora para continuar".
- Casos: títulos y botones en mayúscula inicial solo en la primera palabra ("Día y hora", "Tus datos"). Nunca todo en mayúsculas, salvo el día de la semana en `overline` (VIE, SÁB).
- Precios con símbolo y punto de miles, sin decimales: `$22.000`. Duraciones: `30 min`, `~45 min`; cuando es promedio, di "aprox.".
- Horas en formato 12 h con minúsculas: `10:30 am`, `3:00 pm`. Fechas largas: `viernes 13 nov`.
- Nombres de los servicios exactos como el negocio los vende: Corte básico, Corte + barba, Corte + barba + cejas, Corte + cejas, Corte + limpieza facial, Limpieza facial. La limpieza facial indica "con vaporizador".
- Aviso de puntualidad, siempre con el mismo sentido: "Llega puntual: la tolerancia máxima es de 5 minutos después de la hora pactada."
- Aclara siempre que el pago es en el local: "Total (se paga en el local)". La app no cobra.
- Sin emojis. Los iconos son trazos (ver Iconografía).

## Fundamentos visuales

**Color.** Todo vive sobre `bg`. Las superficies elevadas usan `surface`; lo seleccionado usa `surface-selected` con borde `gold`. `gold` es el único acento: precios, selección, botón principal, números de paso y foco. No uses `gold` como fondo de áreas grandes ni lo combines con otro acento. Texto: `text` para lo principal, `text-muted` para lo secundario, `on-gold` encima de rellenos dorados. `success` y `danger` solo existen para estados en los paneles y siempre con palabra o icono.

**Tipografía.** Títulos y cifras (precios, total, día) en `display` (Cormorant Garamond, 600 o 700). Todo lo demás en `sans` (Inter). Usa los estilos `h1`, `h2`, `price`, `total`, `day-number`, `body`, `body-strong`, `small`, `label`, `caption`, `overline` y `button` tal cual; no inventes tamaños. Los campos de texto van a 16 px para que iOS no haga zoom.

**Espaciado y layout.** Margen lateral `space-5` (20 px). Entre secciones `space-6` (36 px); entre el título de una sección y su contenido `space-4`; entre chips y filas `space-3`. Una columna en celular. Las horas van en cuadrícula de 4 columnas; los días en una fila con scroll horizontal. Toda zona tocable mide al menos `touch-min` (44 px).

**Formas.** Campos y chips de hora `radius-sm`; botones, filas de servicio y días `radius-md`; tarjeta de resumen `radius-lg`; pastilla de barbero `radius-pill`; sello, avatares y números de paso `radius-full`.

**Bordes y elevación.** El lujo se logra con bordes finos, no con sombras. Tarjetas: borde 1 px `line`. Campos y controles cuyo único límite es el borde: `line-strong` (cumple 3:1). Seleccionado: borde 1 px `gold`. La única sombra es `logo-glow`, para el sello grande.

**Foco.** Anillo sólido de 2 px `gold`, separado 2 px del control, en todo elemento interactivo (`gold` supera 3:1 sobre `bg`, `surface` y `surface-selected`).

**Estados.** Seleccionado: `surface-selected` + borde `gold`; en chips de hora y día, relleno `gold` con texto `on-gold`. No disponible: transparente, borde discontinuo, `text-disabled` y tachado, con el atributo `disabled`. Botón principal deshabilitado: `surface-muted` con `text-muted` y el texto explica qué falta.

**Imágenes.** El sello circular (assets/Logo) es la única imagen de marca; siempre sobre fondo oscuro. No hay fotografía decorativa. Las fotos de productos y de barberos, cuando existan, van en recuadros `radius-md`.

**Movimiento.** Transiciones de 150 ms en color, borde y relleno al seleccionar. Sin animaciones decorativas ni rebotes.

## Iconografía

Iconos de trazo de 1.8 px, `stroke-linecap: round`, 18 a 24 px, en `gold` o `text-muted`, dibujados como SVG en línea con `aria-hidden="true"` cuando acompañan texto. Sin emojis, sin iconos rellenos y sin símbolos de texto como "★": para "Cualquier barbero" usa un icono de trazo. El reloj del aviso de puntualidad es el modelo: círculo de radio 9 con manecillas en trazo.

## Componentes

Button, ServiceCard, BarberPill, DayChip, TimeSlot, TextField, StepHeader, SummaryCard, Notice y BrandSeal. Sus estilos están en `components/bundle.css` con prefijo `imp-` y leen solo tokens; cada carpeta explica qué debe aportar quien lo usa. Construye pantallas nuevas con estas piezas antes de crear otras.
