Chip de hora para la cuadrícula de 4 columnas con tres estados: disponible, seleccionada y no disponible.

**Quien lo usa aporta:** la hora en formato 12 h (`10:30 am`), el estado en `aria-pressed` y `disabled` cuando el bloque ya no cabe. Calcula la disponibilidad con la duración del servicio elegido: una hora está disponible solo si todos los bloques de 30 min que ocupa están libres y terminan antes del cierre.

**Clases:** `imp-slot` dentro de un contenedor `imp-slots`.

- No disponible: transparente, borde discontinuo, `text-disabled` y tachado. Siempre `disabled`, para que no reciba foco ni toque.
- Seleccionada: `gold` con `on-gold`. Si el cambio de servicio o de día deja inválida la hora elegida, límpiala.
- Alto `control-sm` (46 px); espacio `space-3`.
