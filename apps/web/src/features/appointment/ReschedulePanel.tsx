import { useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'
import { ApiError } from '../../lib/api/client'
import { isSlotConflict, slotAlternatives } from '../../lib/api/conflict'
import type { Alternative } from '../../lib/api/conflict'
import { isTransientError, useRescheduleAppointment } from '../../lib/api/hooks'
import type { PublicAppointment } from '../../lib/api/types'
import { activatedByKeyboard, goToSection } from '../../lib/accessibility'
import { SlotConflict } from '../booking/SlotConflict'
import { SlotPicker } from '../booking/SlotPicker'
import { useSlotPicker } from '../booking/useSlotPicker'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'

/** Reprogramar: el mismo selector de día y hora, con el servicio y el barbero de la cita. */
export function ReschedulePanel({
  token,
  appointment,
  onClose,
  onDone,
  onBlocked,
}: {
  token: string
  appointment: PublicAppointment
  onClose: () => void
  onDone: () => void
  /** La API ya no deja reprogramar (fuera de plazo, cita no activa): se muestra su mensaje. */
  onBlocked: (message: string) => void
}) {
  const picker = useSlotPicker(appointment.service.id, appointment.barber.id)
  const reschedule = useRescheduleAppointment(token)
  const [conflict, setConflict] = useState<Alternative[] | null>(null)
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  const slot =
    picker.selectedSlot ??
    (conflict?.some((a) => a.starts_at === picker.chosenSlot) ? picker.chosenSlot : null)

  function pick(startsAt: string, event: React.MouseEvent) {
    picker.chooseSlot(startsAt)
    setError(null)
    if (activatedByKeyboard(event)) goToSection(heading.current, true)
  }

  function confirm() {
    if (!slot || reschedule.isPending) return
    setError(null)
    setConflict(null)
    reschedule.mutate(slot, {
      onSuccess: onDone,
      onError: (failure) => {
        if (isSlotConflict(failure)) {
          setConflict(slotAlternatives(failure))
          void picker.refresh()
        } else if (failure instanceof ApiError && failure.status === 409) {
          onBlocked(failure.message)
        } else if (isTransientError(failure)) {
          setError({ message: `No pudimos reprogramar tu cita. ${NETWORK_MESSAGE}`, retry: true })
        } else {
          setError({ message: (failure as Error).message, retry: false })
        }
      },
    })
  }

  return (
    <section
      aria-labelledby="reprogramar-titulo"
      className="flex flex-col gap-14 rounded-summary border border-gold-edge bg-surface px-20 py-[22px]"
    >
      <h2
        id="reprogramar-titulo"
        ref={heading}
        tabIndex={-1}
        className="m-0 font-display text-h2 text-text outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        Elige un nuevo horario
      </h2>
      <SlotPicker
        picker={picker}
        onDay={() => setConflict(null)}
        onSlot={pick}
        note={`Mismo servicio (${appointment.service.name}) y mismo barbero (${appointment.barber.display_name}).`}
      />
      {conflict && <SlotConflict alternatives={conflict} selected={slot} onPick={pick} />}
      {error &&
        (error.retry ? (
          <RetryNotice onRetry={confirm} loading={reschedule.isPending}>
            {error.message}
          </RetryNotice>
        ) : (
          <Notice tone="danger">{error.message}</Notice>
        ))}
      <Button block disabled={!slot} loading={reschedule.isPending} onClick={confirm}>
        {reschedule.isPending ? 'Confirmando…' : 'Confirmar nuevo horario'}
      </Button>
      <Button block size="md" variant="ghost" onClick={onClose}>
        Mantener mi horario actual
      </Button>
    </section>
  )
}
