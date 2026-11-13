import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'

/**
 * Aviso de cambios sin guardar. Con `dirty`:
 *  - cerrar o recargar la pestaña pide confirmación al navegador (`beforeunload`);
 *  - un clic en un enlace interno abre el diálogo "Tienes cambios sin guardar";
 *  - `guard(acción)` hace lo mismo para acciones propias (cambiar de fila, cancelar).
 * La app usa BrowserRouter (sin `useBlocker`), por eso los enlaces se interceptan a mano.
 */
export function useUnsavedGuard(dirty: boolean): {
  guard: (action: () => void) => void
  dialog: ReactNode
} {
  const navigate = useNavigate()
  const [pending, setPending] = useState<(() => void) | null>(null)

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      const href = anchor.getAttribute('href') ?? ''
      if (!href.startsWith('/') || anchor.target === '_blank') return
      event.preventDefault()
      event.stopPropagation()
      setPending(() => () => navigate(href))
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty, navigate])

  const guard = useCallback(
    (action: () => void) => {
      if (dirty) setPending(() => action)
      else action()
    },
    [dirty],
  )

  const dialog = (
    <Dialog
      open={pending !== null}
      onClose={() => setPending(null)}
      title="Tienes cambios sin guardar"
    >
      <p className="m-0 text-body text-text-muted">Si sales ahora, perderás lo que editaste.</p>
      <div className="flex flex-col gap-10">
        <Button data-autofocus block onClick={() => setPending(null)}>
          Seguir editando
        </Button>
        <Button
          block
          variant="danger-outline"
          onClick={() => {
            const action = pending
            setPending(null)
            action?.()
          }}
        >
          Salir sin guardar
        </Button>
      </div>
    </Dialog>
  )

  return { guard, dialog }
}
