import { DayChip } from '../../components/DayChip'
import { Skeleton } from '../../components/Skeleton'
import { TimeSlot } from '../../components/TimeSlot'
import { isTransientError } from '../../lib/api/hooks'
import { formatTime } from '../../lib/format'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'
import { Notice } from '../../components/Notice'
import type { SlotPickerState } from './useSlotPicker'

const SKELETON_SLOTS = 8

/** Selector de día y hora (siete días, horarios en cuadrícula). Lo usan agendar y reprogramar. */
export function SlotPicker({
  picker,
  hasService = true,
  idleMessage = 'Elige un servicio para ver los horarios disponibles.',
  note,
  onDay,
  onSlot,
}: {
  picker: SlotPickerState
  hasService?: boolean
  idleMessage?: string
  /** Texto pequeño bajo los horarios (p. ej. la duración del servicio). */
  note?: string
  onDay?: (date: string, event: React.MouseEvent) => void
  onSlot: (startsAt: string, event: React.MouseEvent) => void
}) {
  const { days, day, slots, dayStatus, allLoading, allFull, hasError } = picker
  const slotsLoading = hasService && !hasError && (allLoading || dayStatus === 'loading')

  return (
    <div className="flex flex-col gap-14">
      <div
        role="group"
        aria-label="Días disponibles"
        className="flex gap-10 overflow-x-auto pr-20 pb-[6px] mr-[calc(var(--space-20)*-1)]"
      >
        {allLoading
          ? Array.from({ length: days.length }, (_, i) => (
              <Skeleton key={i} className="h-[78px] w-[62px] shrink-0" />
            ))
          : days.map((d) => (
              <DayChip
                key={d.date}
                weekday={d.weekday}
                day={d.day}
                selected={d.date === day}
                disabled={d.status === 'full'}
                note={d.status === 'full' ? 'sin cupo' : undefined}
                onClick={(event) => {
                  picker.chooseDay(d.date)
                  onDay?.(d.date, event)
                }}
              />
            ))}
      </div>

      {!hasService && <p className="m-0 text-small text-text-muted">{idleMessage}</p>}

      {hasService && hasError && (
        <RetryNotice onRetry={picker.retry} loading={picker.isRetrying}>
          {isTransientError(picker.error)
            ? `No pudimos cargar los horarios. ${NETWORK_MESSAGE}`
            : (picker.error as Error).message}
        </RetryNotice>
      )}

      {hasService && allFull && (
        <Notice>
          No hay horarios en los próximos 7 días con esta selección. Prueba con otro barbero.
        </Notice>
      )}

      {slotsLoading && (
        <div role="status" aria-busy="true" className="grid grid-cols-4 gap-10">
          <span className="sr-only">Cargando horarios…</span>
          {Array.from({ length: SKELETON_SLOTS }, (_, i) => (
            <Skeleton key={i} className="h-control-46" />
          ))}
        </div>
      )}

      {hasService && !hasError && !slotsLoading && slots.length > 0 && (
        <div role="group" aria-label="Horarios disponibles" className="grid grid-cols-4 gap-10">
          {slots.map((slot) => (
            <TimeSlot
              key={slot.starts_at}
              time={formatTime(slot.starts_at)}
              selected={slot.starts_at === picker.selectedSlot}
              onClick={(event) => onSlot(slot.starts_at, event)}
            />
          ))}
        </div>
      )}

      {note && <p className="m-0 text-caption text-text-muted">{note}</p>}
    </div>
  )
}
