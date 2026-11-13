/** Une clases omitiendo valores falsos. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Anillo de foco del sistema: sólido, 2 px, dorado, separado 2 px (design-system/README.md). */
export const FOCUS_RING =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-gold'

/** Transición de 150 ms en color, borde y relleno; sin movimiento si la persona lo pidió. */
export const TRANSITION = 'transition-colors duration-150 motion-reduce:transition-none'

/** Base de todo control tocable: sin resaltado táctil del navegador. */
export const TAPPABLE = 'cursor-pointer [-webkit-tap-highlight-color:transparent]'
