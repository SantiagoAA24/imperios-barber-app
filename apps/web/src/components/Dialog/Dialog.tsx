import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../classes'

export type DialogProps = {
  open: boolean
  /** Se llama al pulsar Escape, tocar el fondo o cerrar el diálogo; quien lo usa pone `open` en false. */
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}

/**
 * Diálogo modal con el elemento nativo `<dialog>`: `showModal()` atrapa el foco, deja inerte el
 * resto de la página y cierra con Escape. Dentro, el elemento con `data-autofocus` recibe el
 * foco al abrir (pon ahí la opción segura). Quien lo usa devuelve el foco al botón que lo abrió.
 */
export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      // jsdom no implementa showModal: allí se abre sin modalidad, suficiente para las pruebas.
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape: el navegador cierra el diálogo y dispara `close`; aquí solo se sincroniza el estado.
      onClose={onClose}
      onClick={(event) => {
        // Tocar el fondo (el propio <dialog>, fuera de su contenido) cierra.
        if (event.target === event.currentTarget) onClose()
      }}
      className={cx(
        'm-auto box-border w-[calc(100%-var(--space-20)*2)] max-w-[440px] rounded-summary border border-gold-edge bg-surface p-0 font-body text-text backdrop:bg-bg/80',
        className,
      )}
    >
      {open && (
        <div className="flex flex-col gap-14 px-20 py-[22px]">
          <h2 id={titleId} className="m-0 font-display text-h2 text-text">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  )
}
