Fila seleccionable que muestra un servicio con su duración y su precio; también sirve para productos del catálogo sin la duración.

**Quien lo usa aporta:** el nombre exacto del servicio, la duración en minutos (con "aprox." si es promedio), el precio ya formateado (`$22.000`) y el estado en `aria-pressed`. Elige uno solo a la vez dentro de un mismo grupo.

**Clases:** `imp-card`, con `imp-card__text`, `imp-card__name`, `imp-card__meta` e `imp-price`.

- Es un `<button>` con `aria-pressed`; nunca un `div` con clic.
- Seleccionada: `surface-selected` con borde `gold`. El precio siempre va en `gold` y `display`.
- Notas del servicio (como "con vaporizador") van en la línea de `caption`, separadas con " · ".
- Alto mínimo 64 px; entre filas `space-3`.
