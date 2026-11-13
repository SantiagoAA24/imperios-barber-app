Campo de texto con etiqueta visible encima y un recuadro de 52 px; admite un prefijo, como +57 para el celular.

**Quien lo usa aporta:** el `id` que une `label` e `input`, el `type` correcto (`text`, `tel`), `autocomplete`, el `placeholder` y los mensajes de error, si existen.

**Clases:** `imp-field` con `imp-field__box`, `imp-field__prefix`, el `label` y el `input`.

- Siempre con `<label for>`; el `placeholder` no sustituye a la etiqueta.
- Borde `line-strong` (el borde es el único límite del control); al enfocar, el borde pasa a `gold` y aparece el anillo de foco.
- Texto de 16 px para evitar el zoom de iOS. El celular usa `inputmode="numeric"`.
- Un error se escribe debajo en `caption` con `danger` y un icono; no solo cambia el color del borde.
