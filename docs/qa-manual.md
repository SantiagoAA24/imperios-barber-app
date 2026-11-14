# Lista de comprobación manual

Para probar **antes de cada lanzamiento** en dos celulares reales: un **Android de gama baja** (p. ej. 2-3 GB de RAM, Chrome) y un **iPhone** (Safari). Marca cada casilla; si algo falla, anota el dispositivo, la versión y una captura.

Lo que ya prueba una máquina (CI) no se repite aquí: ver `docs/qa-accesibilidad.md`, `apps/web/e2e/` y `pnpm --filter web lhci`. Esta lista es para lo que solo se ve en un aparato real.

**Preparación:** una barbería de prueba con servicios, barberos y horarios; un barbero con su celular real para recibir WhatsApp; la URL de la app publicada (HTTPS).

| | Android | iPhone |
| --- | :---: | :---: |
| Modelo y versión | | |
| Navegador y versión | | |

## 1. Instalar la PWA

- [ ] **Android (Chrome):** al abrir la app aparece «Instalar app» o el menú ⋮ → «Instalar aplicación». Se instala con el sello como ícono y el nombre «Imperio».
- [ ] **iPhone (Safari):** Compartir → «Añadir a pantalla de inicio». El ícono es el sello (apple-touch-icon), sin bordes raros.
- [ ] Al abrirla desde el ícono se ve a pantalla completa (sin barra del navegador) y la barra de estado es oscura (`theme-color`).
- [ ] La pantalla de arranque no parpadea en blanco: el fondo es negro de inmediato.
- [ ] El ícono maskable en Android se recorta en círculo/cuadrado sin cortar el sello.
- [ ] Desinstalar y volver a instalar funciona.

## 2. Agendar de punta a punta

- [ ] Abrir `/`, elegir servicio, barbero (o «Cualquiera»), día y hora, escribir nombre y celular, aceptar y confirmar.
- [ ] Se llega a «Tu cita está lista» con servicio, día largo (`viernes 13 nov`), hora (`10:30 am`) y total (`$22.000`) bien escritos.
- [ ] «Agregar al calendario» descarga el `.ics` y el calendario del celular lo abre con la hora correcta (zona de Bogotá).
- [ ] La barra de resumen fija no tapa el botón «Confirmar cita» ni los campos mientras se escribe.
- [ ] Tocar con el dedo es cómodo: ningún botón difícil de acertar (mínimo 44 px).
- [ ] Reprogramar la cita y cancelarla funcionan (con más de la anticipación mínima).
- [ ] El barbero ve la cita en su agenda con el nombre y el servicio.

## 3. Abrir el enlace de la cita desde WhatsApp

- [ ] Enviarse el enlace `/cita/<token>` por WhatsApp y abrirlo: con la app instalada abre la app (Android) o Safari (iPhone) y muestra la cita.
- [ ] Pegar el enlace en un chat: la vista previa muestra el sello, «Imperio Barber — Agenda tu cita» y la descripción (la imagen `og:image` debe cargar; requiere que el sitio se publique con `SITE_URL`).
- [ ] Compartir el enlace de inicio `/` (no el de una cita) y comprobar la misma vista previa.
- [ ] **Recordatorio:** en la agenda del barbero, una cita pendiente que empieza en menos de 24 h muestra «Recordar por WhatsApp». Al tocarlo abre WhatsApp con el mensaje completo y el número correcto en una pestaña nueva; al volver, el botón dice «Recordatorio enviado hace…».
- [ ] El mensaje no lleva enlace de gestión y el nombre es solo el primero.

## 4. Rotar la pantalla

- [ ] En horizontal, `/`, la cita y el catálogo siguen siendo usables (se puede desplazar; nada queda tapado por la barra de resumen).
- [ ] Volver a vertical no pierde lo escrito ni la selección.
- [ ] En la agenda del barbero, la barra inferior de pestañas sigue visible y no tapa la última cita.
- [ ] iPhone con muesca: el contenido no queda debajo de la muesca ni de la barra inferior.

## 5. Teclado numérico en el celular

- [ ] El campo «Celular (WhatsApp)» abre el **teclado numérico/telefónico** (`type="tel"` con `inputmode="tel"`; en la pantalla del barbero, `inputmode="numeric"`).
- [ ] El texto del campo es de 16 px: Safari **no** hace zoom automático al enfocarlo.
- [ ] Escribir `300 123 4567` o `3001234567` se acepta; letras no entran.
- [ ] Al enfocar un campo, el teclado no tapa el campo ni el botón «Confirmar cita» (se puede desplazar hasta ellos).
- [ ] El campo de nombre abre el teclado normal con mayúscula inicial.

## 6. Modo oscuro del sistema

La app es oscura siempre. Comprobar que **no se rompe** al cambiar el tema del sistema:

- [ ] Con el sistema en **claro**: la app se ve igual (fondo negro, texto claro), los campos y menús del navegador salen oscuros (`color-scheme: dark`) y nada queda blanco sobre blanco.
- [ ] Con el sistema en **oscuro**: igual.
- [ ] El teclado y la barra de Safari/Chrome no «flashean» en blanco al abrir la app.
- [ ] «Aumentar contraste» / «Texto en negrita» del sistema: el texto sigue legible.
- [ ] Tamaño de letra del sistema al máximo: el texto crece y no se corta.

## 7. Conexión lenta (3G simulada)

Con las herramientas del navegador (Chrome → DevTools remoto, «Slow 3G») o el modo de red lenta del celular:

- [ ] La primera carga de `/` muestra el título y los servicios en un tiempo razonable (esqueletos «Cargando servicios…» mientras tanto).
- [ ] Los horarios cargan; si tardan, aparece «Cargando horarios…» y no se puede confirmar a medias.
- [ ] Si una petición falla por la red, sale el aviso «Revisa tu conexión…» con el botón **Reintentar**, y reintentar funciona.
- [ ] Confirmar la cita con red lenta **no la duplica** si se toca dos veces.
- [ ] Las fuentes no hacen «saltar» el texto de forma molesta (se precargan las dos de arriba).

## 8. Sin conexión

- [ ] Abrir la app instalada con el modo avión: arranca (el shell está en caché).
- [ ] `/productos` carga el último catálogo guardado.
- [ ] En `/`, elegir un servicio sin red muestra «No pudimos cargar los horarios» con **Reintentar** y el botón de confirmar deshabilitado.
- [ ] Un área de personal (`/barbero`, `/admin`) sin red lleva a «Sin conexión» con «Reintentar» y «Volver al inicio».
- [ ] Al volver la red, **Reintentar** recupera sin recargar a mano.
- [ ] Nunca se muestra una disponibilidad vieja como si fuera actual (los horarios no se guardan en caché).

## 9. Barbero y admin (solo si se usan en el celular o la tableta)

- [ ] «Citas por revisar»: la insignia de «Agenda» muestra el número; la lista permite marcar «Atendida» / «No asistió» y el número baja.
- [ ] La agenda del admin y la semana se desplazan con el dedo dentro de su caja sin mover toda la página.
- [ ] Cerrar sesión desde el celular y volver a ingresar.

## 10. Cierre

- [ ] Ninguna pantalla muestra texto en inglés, `undefined`, `NaN`, `{…}` ni textos cortados.
- [ ] Precios como `$22.000` y horas como `10:30 am` en todas partes.
- [ ] Anotar los fallos con captura y abrirlos como tareas antes de publicar.
