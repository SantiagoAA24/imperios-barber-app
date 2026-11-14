import { useEffect } from 'react'

export const BRAND = 'Imperio Barber'

/** 'Agendar cita' -> 'Agendar cita · Imperio Barber'. */
export function pageTitle(title: string): string {
  return `${title} · ${BRAND}`
}

/**
 * Título de la pestaña distinto por pantalla (lo anuncian los lectores de pantalla al navegar y
 * es lo que se ve en el historial). Al salir de la pantalla vuelve al título anterior.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title
    document.title = pageTitle(title)
    return () => {
      document.title = previous
    }
  }, [title])
}
