import type { ButtonHTMLAttributes } from 'react'
import { formatCOP, formatDuration } from '../../lib/format'
import { cx, FOCUS_RING, TAPPABLE, TRANSITION } from '../classes'

export type ServiceCardProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-pressed' | 'type'
> & {
  name: string
  /** Duración en minutos; se omite en productos. */
  durationMin?: number
  /** Duración promedio: se muestra como "~45 min". */
  approximate?: boolean
  priceCop: number
  /** Nota corta, p. ej. "con vaporizador"; va tras la duración, separada con " · ". */
  note?: string
  selected: boolean
}

export function ServiceCard({
  name,
  durationMin,
  approximate = false,
  priceCop,
  note,
  selected,
  className,
  ...rest
}: ServiceCardProps) {
  const meta = [
    durationMin === undefined ? null : `${approximate ? '~' : ''}${formatDuration(durationMin)}`,
    note ?? null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      {...rest}
      type="button"
      aria-pressed={selected}
      className={cx(
        'box-border flex w-full min-h-[64px] items-center justify-between gap-10 rounded-card border px-14 py-14 text-left font-body',
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
      <span className="flex flex-col gap-4">
        <span className="text-body-strong text-text">{name}</span>
        {meta && <span className="text-caption text-text-muted">{meta}</span>}
      </span>
      <span className="whitespace-nowrap font-display text-price text-gold">
        {formatCOP(priceCop)}
      </span>
    </button>
  )
}
