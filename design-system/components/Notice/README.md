Mensaje corto de una o dos líneas con un icono de trazo a la izquierda, para avisos de política, éxitos y errores.

**Quien lo usa aporta:** el texto y la variante: por defecto (informativo, `text-muted`), `imp-notice--success` o `imp-notice--danger`.

**Clases:** `imp-notice`, `imp-notice--success`, `imp-notice--danger`.

- El icono acompaña siempre; el color nunca es la única señal. Información: reloj en `gold`; éxito: check; error: equis.
- Escribe el mensaje completo ("Esa hora ya no está disponible. Elige otra."), no solo "Error".
- Para errores que el cliente debe oír al instante, añade `role="alert"` al contenedor.
