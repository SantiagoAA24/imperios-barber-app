Pastilla con avatar y nombre para elegir con qué barbero se agenda; la opción "Cualquiera" deja que el negocio asigne.

**Quien lo usa aporta:** el nombre del barbero, sus iniciales (o su foto en el avatar de 32 px) y el estado en `aria-pressed`. Los nombres reales los define el negocio.

**Clases:** `imp-pill` con `imp-pill__avatar`.

- Es un `<button>` con `aria-pressed`. Una sola pastilla seleccionada.
- Las pastillas hacen salto de línea (`flex-wrap`) con `space-3` entre ellas.
- Para "Cualquiera" usa iniciales o un icono de trazo; no el símbolo "★".
