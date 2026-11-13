import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx, FOCUS_RING, TAPPABLE, TRANSITION } from '../classes'

export type BarberPillProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-pressed' | 'type'
> & {
  name: string
  /** Iniciales del avatar; si falta se sacan del nombre. */
  initials?: string
  /** Icono de trazo en lugar de iniciales (p. ej. "Cualquiera"). */
  icon?: ReactNode
  selected: boolean
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

export function BarberPill({
  name,
  initials,
  icon,
  selected,
  className,
  ...rest
}: BarberPillProps) {
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={selected}
      className={cx(
        'box-border inline-flex items-center gap-10 rounded-pill border py-8 pl-8 pr-[calc(var(--space-8)*2)] text-small font-medium font-body text-text',
        selected
          ? 'border-gold bg-surface-selected'
          : 'border-line bg-surface enabled:hover:border-line-strong enabled:active:bg-surface-selected',
        'disabled:cursor-not-allowed disabled:opacity-60',
        TAPPABLE,
        TRANSITION,
        FOCUS_RING,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-[calc(var(--space-8)*4)] items-center justify-center rounded-round bg-surface-muted text-overline font-semibold text-gold"
      >
        {icon ?? initials ?? initialsOf(name)}
      </span>
      {name}
    </button>
  )
}
