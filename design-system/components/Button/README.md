Botón de acción a todo el ancho del contenedor, con una variante principal dorada, una secundaria con borde y un estado deshabilitado.

**Quien lo usa aporta:** el texto (verbo en infinitivo, `button`), el manejador de clic y, cuando falte un dato, el atributo `disabled` junto con un texto que diga qué falta ("Elige una hora para continuar").

**Clases:** `imp-btn` + `imp-btn--primary` o `imp-btn--secondary`; `imp-btn--block` para ocupar todo el ancho.

- Un solo botón principal por pantalla: la acción que cierra el flujo (Confirmar cita).
- Alto `control-lg` (54 px) y radio `radius-md`. No lo reduzcas bajo `touch-min`.
- Deshabilitado usa `surface-muted` y `text-muted`; no lo pintes de gris genérico ni lo ocultes.
- No pongas iconos dentro del principal salvo que acompañen al texto.
