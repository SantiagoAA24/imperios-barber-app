import { useState } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { useAdminChangeStatus } from '../../lib/api/admin'
import type { AdminNewStatus } from '../../lib/api/admin'
import { ApiError } from '../../lib/api/client'
import type { AdminAppointment } from '../../lib/api/types'
import { formatCOP, formatDayLong, formatDuration, formatTime } from '../../lib/format'
import { NETWORK_MESSAGE } from '../shared/RetryNotice'

const SOURCE: Record<AdminAppointment['source'], string> = {
  online: 'Web',
  manual: 'Manual',
  walk_in: 'Turno sin cita',
}

export function badgeStatus(a: Pick<AdminAppointment, 'status' | 'is_overdue'>) {
  return a.status === 'booked' && a.is_overdue ? 'overdue' : a.status
}

/** Detalle de una cita con sus acciones; los estados y sus reglas los decide el servidor (fase 6). */
export function AppointmentPanel({
  appointment,
  onClose,
}: {
  appointment: AdminAppointment
  onClose: () => void
}) {
  const change = useAdminChangeStatus()
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const status = appointment.status

  async function apply(next: AdminNewStatus) {
    setError(null)
    setConfirmCancel(false)
    try {
      await change.mutateAsync({ id: appointment.id, status: next })
    } catch (e) {
      setError(e instanceof ApiError && e.status < 500 ? e.message : NETWORK_MESSAGE)
    }
  }

  const rows: Array<[string, string]> = [
    ['Cliente', appointment.client.name],
    ['Celular', appointment.client.phone_masked ?? 'Sin celular'],
    ['Servicio', appointment.service.name],
    ['Barbero', appointment.barber.display_name],
    ['Día', formatDayLong(appointment.starts_at)],
    [
      'Hora',
      `${formatTime(appointment.starts_at)} – ${formatTime(appointment.ends_at)} (${formatDuration(appointment.service.duration_min)})`,
    ],
    ['Precio', formatCOP(appointment.price_cop)],
    ['Origen', SOURCE[appointment.source]],
  ]
  if (appointment.service.uses_resource) rows.push(['Vaporizador', 'Usa el vaporizador'])

  return (
    <aside
      aria-label="Detalle de la cita"
      className="flex min-w-0 max-w-[380px] flex-[1_1_300px] flex-col gap-14 rounded-summary border border-gold-edge bg-surface p-20"
    >
      <div className="flex items-start justify-between gap-10">
        <div className="flex flex-col gap-4">
          <h2 className="m-0 font-display text-h2 text-text">Cita</h2>
          <StatusBadge status={badgeStatus(appointment)} />
        </div>
        <Button size="md" variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-14 gap-y-8 text-small">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-text-muted">{term}</dt>
            <dd className="m-0 text-text">{value}</dd>
          </div>
        ))}
      </dl>
      {error && <Notice tone="danger">{error}</Notice>}
      {(status === 'booked' || status === 'no_show') && (
        <div className="flex flex-col gap-10">
          <Button block loading={change.isPending} onClick={() => void apply('attended')}>
            Atendida
          </Button>
          {status === 'booked' && (
            <>
              <Button
                block
                variant="secondary"
                disabled={change.isPending}
                onClick={() => void apply('no_show')}
              >
                No asistió
              </Button>
              <Button
                block
                size="md"
                variant="danger-outline"
                disabled={change.isPending}
                onClick={() => setConfirmCancel(true)}
              >
                Cancelar cita
              </Button>
            </>
          )}
        </div>
      )}
      {(status === 'attended' || status === 'cancelled') && (
        <p className="m-0 text-caption text-text-muted">
          Esta cita ya está {status === 'attended' ? 'atendida' : 'cancelada'}: no hay más acciones.
        </p>
      )}
      <Dialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="¿Cancelar esta cita?"
      >
        <p className="m-0 text-body text-text-muted">
          La cita de {appointment.client.name} ({formatTime(appointment.starts_at)}) quedará
          cancelada y el horario volverá a estar libre.
        </p>
        <div className="flex flex-col gap-10">
          <Button data-autofocus block onClick={() => setConfirmCancel(false)}>
            Mantener la cita
          </Button>
          <Button block variant="danger" onClick={() => void apply('cancelled')}>
            Sí, cancelar cita
          </Button>
        </div>
      </Dialog>
    </aside>
  )
}
