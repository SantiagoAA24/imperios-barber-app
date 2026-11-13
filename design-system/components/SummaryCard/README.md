Tarjeta que cierra el flujo: repite lo elegido, muestra el total y contiene el botón principal y el aviso de puntualidad.

**Quien lo usa aporta:** servicio, barbero, fecha y hora, duración y total ya formateados; el estado del botón (deshabilitado hasta que haya hora) y, después de confirmar, un mensaje de éxito con `Notice`.

**Clases:** `imp-summary` con `imp-summary__row`, `imp-summary__rule`, `imp-summary__total` e `imp-total`; dentro van `Button` y `Notice`.

- Fondo `surface`, borde `gold-edge`, radio `radius-lg`, relleno 22 × 20 px.
- Etiquetas a la izquierda en `text-muted`; valores a la derecha en `body-strong`.
- Mientras no haya hora, la fila de fecha dice "Elige una hora".
- El total siempre aclara que se paga en el local; la app no cobra.
