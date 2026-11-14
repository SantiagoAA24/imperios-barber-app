import { FOCUS_RING } from '../components/classes'

/**
 * «Saltar al contenido»: primer elemento enfocable de la página, visible solo con el foco.
 * Lleva el foco al `<main id="contenido">` de la pantalla (cada pantalla trae el suyo), no solo el
 * desplazamiento.
 */
export function SkipLink() {
  return (
    <a
      href="#contenido"
      onClick={(event) => {
        // Cada <main> trae id="contenido" y tabIndex=-1; el enlace #contenido ya lo encuentra.
        // Se enfoca a mano para que el siguiente Tab continúe desde el contenido, no desde el enlace.
        const main = document.getElementById('contenido')
        if (!main) return
        event.preventDefault()
        main.focus()
        main.scrollIntoView()
      }}
      className={`sr-only focus:not-sr-only focus:fixed focus:top-8 focus:left-8 focus:z-50 focus:inline-flex focus:min-h-touch focus:items-center focus:rounded-card focus:bg-gold focus:px-20 focus:font-body focus:text-button focus:text-on-gold ${FOCUS_RING}`}
    >
      Saltar al contenido
    </a>
  )
}
