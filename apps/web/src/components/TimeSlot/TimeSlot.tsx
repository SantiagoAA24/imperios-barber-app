import type { ButtonHTMLAttributes } from 'react'
import { cx, FOCUS_RING, TAPPABLE, TRANSITION } from '../classes'

export type TimeSlotProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-pressed' | 'type'
> & {
  /** Hora ya formateada, p. ej. "10:30 am" (lib/format.formatTime). */
  time: string
  selected: boolean
}

/** Pásale `disabled` cuando el bloque ya no cabe: queda tachada, con borde discontinuo y sin foco. */
export function TimeSlot({ time, selected, className, ...rest }: TimeSlotProps) {
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={selected}
      className={cx(
        'box-border flex h-control-46 min-h-touch w-full items-center justify-center rounded-field border text-label font-body',
        selected
          ? 'border-gold bg-gold text-on-gold font-semibold'
          : 'border-line bg-surface text-text enabled:hover:border-line-strong enabled:active:bg-surface-selected',
        'disabled:cursor-not-allowed disabled:border-dashed disabled:border-line-strong disabled:bg-transparent disabled:text-text-disabled disabled:line-through',
        TAPPABLE,
        TRANSITION,
        FOCUS_RING,
        className,
      )}
    >
      {time}
    </button>
  )
}
