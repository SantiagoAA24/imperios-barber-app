import { Notice } from '../../components/Notice'
import { TimeSlot } from '../../components/TimeSlot'
import type { Alternative } from '../../lib/api/conflict'
import { formatTime } from '../../lib/format'

/** El horario elegido se ocupó: aviso y hasta 3 alternativas que se eligen con un toque. */
export function SlotConflict({
  alternatives,
  selected,
  onPick,
  message = 'Ese horario se acaba de ocupar. Elige otro.',
}: {
  alternatives: Alternative[]
  selected: string | null
  onPick: (startsAt: string, event: React.MouseEvent) => void
  message?: string
}) {
  return (
    <div className="flex flex-col gap-10">
      <Notice tone="danger">{message}</Notice>
      {alternatives.length > 0 && (
        <div
          role="group"
          aria-label="Horarios cercanos disponibles"
          className="grid grid-cols-3 gap-10"
        >
          {alternatives.map((alternative) => (
            <TimeSlot
              key={alternative.starts_at}
              time={formatTime(alternative.starts_at)}
              selected={alternative.starts_at === selected}
              onClick={(event) => onPick(alternative.starts_at, event)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
