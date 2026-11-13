import type { MouseEvent } from 'react'

/**
 * Un clic en un botón nativo activado con Enter o Espacio llega con `detail === 0`;
 * con ratón o toque, `detail >= 1`. Sirve para mover el foco solo a quien navega con teclado.
 */
export function activatedByKeyboard(event: MouseEvent): boolean {
  return event.detail === 0
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Lleva a la persona a otra sección: con teclado mueve el foco al encabezado (el navegador
 * desplaza hasta él); con ratón o toque solo desplaza, suave salvo que pida menos movimiento.
 */
export function goToSection(heading: HTMLElement | null, byKeyboard: boolean): void {
  if (!heading) return
  if (byKeyboard) {
    heading.focus()
    return
  }
  heading.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
}
