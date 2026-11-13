import type { ButtonHTMLAttributes } from 'react'
import { cx, FOCUS_RING, TAPPABLE, TRANSITION } from '../classes'

export type DayChipProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-pressed' | 'type'
> & {
  /** Día de la semana abreviado en español ("Vie"); se muestra en mayúsculas. */
  weekday: string
  day: number | string
  selected: boolean
}

export function DayChip({ weekday, day, selected, className, ...rest }: DayChipProps) {
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={selected}
      className={cx(
        'box-border flex h-[78px] min-h-touch w-[62px] shrink-0 flex-col items-center justify-center gap-[2px] rounded-card border',
        selected
          ? 'border-gold bg-gold text-on-gold'
          : 'border-line bg-surface text-text enabled:hover:border-line-strong enabled:active:bg-surface-selected',
        'disabled:cursor-not-allowed disabled:border-dashed disabled:border-line-strong disabled:bg-transparent disabled:text-text-disabled disabled:line-through',
        TAPPABLE,
        TRANSITION,
        FOCUS_RING,
        className,
      )}
    >
      <span
        className={cx(
          'text-overline uppercase font-body',
          selected ? 'text-on-gold' : 'text-text-muted',
        )}
      >
        {weekday}
      </span>
      <span className="font-display text-day-number">{day}</span>
    </button>
  )
}
