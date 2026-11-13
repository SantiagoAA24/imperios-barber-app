import type { ButtonHTMLAttributes } from 'react'
import { cx, FOCUS_RING, TAPPABLE, TRANSITION } from '../classes'

export type SwitchProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'role' | 'aria-checked' | 'type' | 'onChange'
> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Nombre accesible del interruptor ("Turno sin cita", "Trabajo este día"). */
  label: string
}

/**
 * Interruptor `role="switch"` (barbero-nueva.dc.html, barbero-horario.dc.html). El estado se ve
 * por la posición de la perilla y por la marca de visto, no solo por el color; el área táctil
 * es de 44 px aunque la pista sea más pequeña.
 */
export function Switch({ checked, onCheckedChange, label, className, ...rest }: SwitchProps) {
  return (
    <button
      {...rest}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        rest.onClick?.(event)
        if (!event.defaultPrevented) onCheckedChange(!checked)
      }}
      className={cx(
        'box-border flex min-h-touch min-w-[60px] shrink-0 items-center justify-center rounded-pill disabled:cursor-not-allowed disabled:opacity-60',
        TAPPABLE,
        FOCUS_RING,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'box-border flex h-[30px] w-[52px] items-center rounded-pill border p-[3px]',
          checked
            ? 'justify-end border-gold bg-gold'
            : 'justify-start border-line-strong bg-surface-muted',
          TRANSITION,
        )}
      >
        <span
          className={cx(
            'flex h-[22px] w-[22px] items-center justify-center rounded-round',
            checked ? 'bg-on-gold text-gold' : 'bg-text-muted text-surface-muted',
          )}
        >
          {checked && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
        </span>
      </span>
    </button>
  )
}
