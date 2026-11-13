import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cx, FOCUS_RING, TRANSITION } from '../classes'
import { CrossCircleIcon } from '../icons'

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  /** Etiqueta visible encima del campo; el placeholder no la sustituye. */
  label: string
  /** Ayuda bajo el campo. */
  hint?: string
  /** Mensaje de error: va con icono y palabras, no solo con el borde. */
  error?: string
  /** Texto fijo antes del valor, p. ej. "+57". */
  prefix?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, prefix, id, className, 'aria-describedby': describedBy, ...rest },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const described =
    [describedBy, hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined

  return (
    <div className={cx('flex flex-col gap-[6px] font-body', className)}>
      <label htmlFor={inputId} className="text-label text-text-muted">
        {label}
      </label>
      <div
        className={cx(
          'box-border flex h-control-52 min-h-touch items-center gap-10 rounded-field border bg-surface px-[16px] focus-within:border-gold',
          error ? 'border-danger' : 'border-line-strong',
          TRANSITION,
        )}
      >
        {prefix && (
          <span aria-hidden="true" className="text-body-strong text-gold">
            {prefix}
          </span>
        )}
        <input
          {...rest}
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          // 16 px para que iOS no haga zoom: es --text-button, el único token de 16 px.
          className={cx(
            'h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-button font-normal text-text placeholder:text-text-muted disabled:cursor-not-allowed disabled:text-text-muted',
            FOCUS_RING,
          )}
        />
      </div>
      {hint && !error && (
        <p id={hintId} className="m-0 text-caption text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="m-0 flex items-start gap-8 text-caption text-danger">
          <CrossCircleIcon className="mt-[1px] shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
})
