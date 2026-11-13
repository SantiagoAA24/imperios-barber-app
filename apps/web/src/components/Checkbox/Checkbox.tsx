import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cx, FOCUS_RING } from '../classes'
import { CrossCircleIcon } from '../icons'

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
  /** Texto de la casilla; puede incluir un enlace (p. ej. a /privacidad). */
  children: ReactNode
  /** Mensaje de error: va con icono y palabras, no solo con el color. */
  error?: string
}

/** Casilla nativa con área táctil de 44 px: la etiqueta completa es clicable. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { children, error, id, className, 'aria-describedby': describedBy, ...rest },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  const errorId = `${inputId}-error`
  const described = [describedBy, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={cx('flex flex-col gap-[6px] font-body', className)}>
      <div className="flex min-h-touch items-start gap-[12px]">
        <input
          {...rest}
          ref={ref}
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          // El área de 44 px la da el contenedor; la casilla se alinea con la primera línea.
          className={cx('mt-[12px] size-[20px] shrink-0 cursor-pointer accent-gold', FOCUS_RING)}
        />
        <label htmlFor={inputId} className="cursor-pointer py-[10px] text-small text-text">
          {children}
        </label>
      </div>
      {error && (
        <p id={errorId} className="m-0 flex items-start gap-8 text-caption text-danger">
          <CrossCircleIcon className="mt-[1px] shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
})
