Ficha de 62 × 78 px con el día de la semana en mayúsculas y el número del día, pensada para una fila con scroll horizontal.

**Quien lo usa aporta:** el día abreviado en español (Vie, Sáb…), el número y el estado en `aria-pressed`. Los días sin cupo no se muestran; si hay que mostrarlos, usa el atributo `disabled`.

**Clases:** `imp-day` con `imp-day__wd` e `imp-day__n`.

- Contenedor: `display:flex`, `gap: space-3`, `overflow-x:auto` y un margen negativo a la derecha igual a `space-5` para que el scroll llegue al borde de la pantalla.
- Seleccionado: relleno `gold` y texto `on-gold` (también el día de la semana).
- El número en `day-number` (display 28 px); el día de la semana en `overline`.
