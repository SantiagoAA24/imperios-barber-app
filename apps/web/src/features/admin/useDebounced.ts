import { useEffect, useState } from 'react'

/** Devuelve `value` tras `delayMs` sin cambios (búsqueda de clientes: 300 ms). */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
