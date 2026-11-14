import { useState } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { CheckIcon, ClockIcon, TrashIcon, WhatsappIcon } from '../../components/icons'
import { cx } from '../../components/classes'
import type { NewStatus } from '../../lib/api/barber'
import type { MeAppointment } from '../../lib/api/types'
import { formatAgo, formatCOP, formatDuration, formatTime } from '../../lib/format'
import { canRemind, reminderUrl, whatsappUrl } from '../../lib/whatsapp'

export type AppointmentRowProps = {
  appointment: MeAppointment
  /** Próxima cita pendiente del día: va resaltada. */
  isNext: boolean
  /** Día de calendario de hoy (AAAA-MM-DD); solo para redactar el mensaje de WhatsApp. */
  today: string
  /** Reloj de la pantalla (ms): decide si falta menos de 24 h y el «hace X» del recordatorio. */
  now: number
  /** Minutos de tolerancia del negocio, para el texto del recordatorio. */
  toleranceMin: number
  /** Se llama después de abrir WhatsApp para registrar el envío (reminder_sent_at). */
  onReminderSent: () => void
  /** Llegada desde un enlace (p. ej. un conflicto de horario): se marca para encontrarla. */
  highlighted?: boolean
  busy: boolean
  error: string | null
  onStatus: (status: NewStatus) => void
}

function badgeStatus(a: MeAppointment) {
  return a.status === 'booked' && a.is_overdue ? ('overdue' as const) : a.status
}

/** Una cita de la agenda: hora, cliente, servicio, estado y las acciones que el servidor permite. */
export function AppointmentRow({
  appointment: a,
  isNext,
  today,
  now,
  toleranceMin,
  onReminderSent,
  highlighted = false,
  busy,
  error,
  onStatus,
}: AppointmentRowProps) {
  const [confirming, setConfirming] = useState(false)
  const headingId = `cita-${a.id}-titulo`
  const open = a.status === 'booked' || a.status === 'no_show'
  const phone = a.client.phone_e164
  const remindHref = canRemind(a, now)
    ? reminderUrl(phone, {
        clientName: a.client.name,
        serviceName: a.service.name,
        startsAt: a.starts_at,
        toleranceMin,
      })
    : null
  const sentAgo = a.reminder_sent_at ? formatAgo(a.reminder_sent_at, now) : null

  return (
    <li id={`cita-${a.id}`} className="list-none">
      <article
        aria-labelledby={headingId}
        className={cx(
          'box-border flex flex-col gap-10 rounded-card border bg-surface p-14 font-body',
          isNext || highlighted ? 'border-gold bg-surface-selected' : 'border-line',
        )}
      >
        <div className="flex items-start justify-between gap-10">
          <div className="flex min-w-0 flex-col gap-4">
            <p className="m-0 font-display text-price text-gold">{formatTime(a.starts_at)}</p>
            <h3 id={headingId} className="m-0 text-body-strong text-text">
              {a.client.name}
            </h3>
          </div>
          <StatusBadge status={badgeStatus(a)} />
        </div>

        <p className="m-0 text-small text-text-muted">
          {a.service.name} · {formatDuration(a.service.duration_min)} ·{' '}
          {formatCOP(a.service.price_cop)}
        </p>

        {isNext && (
          <p className="m-0 flex items-center gap-4 text-caption font-semibold text-gold">
            <ClockIcon size={16} />
            Siguiente
          </p>
        )}
        {highlighted && !isNext && (
          <p className="m-0 text-caption font-semibold text-gold">Cita del aviso</p>
        )}

        {error && <Notice tone="danger">{error}</Notice>}

        {open && (
          <div className="flex flex-wrap gap-10">
            <Button
              size="md"
              icon={<CheckIcon size={18} />}
              loading={busy}
              className="min-w-[132px] flex-1"
              onClick={() => onStatus('attended')}
            >
              Atendida
            </Button>
            {a.status === 'booked' && a.is_overdue && (
              <Button
                size="md"
                variant="secondary"
                disabled={busy}
                className="min-w-[132px] flex-1"
                onClick={() => onStatus('no_show')}
              >
                No asistió
              </Button>
            )}
            {a.status === 'booked' && (
              <Button
                size="md"
                variant="danger-outline"
                icon={<TrashIcon size={18} />}
                disabled={busy}
                className="flex-1"
                onClick={() => setConfirming(true)}
              >
                Cancelar
              </Button>
            )}
            {remindHref && (
              <Button
                size="md"
                variant="secondary"
                icon={<WhatsappIcon size={18} />}
                href={remindHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onReminderSent}
                aria-label={
                  sentAgo
                    ? `Recordatorio enviado ${sentAgo}. Reenviar por WhatsApp a ${a.client.name} (se abre en otra pestaña)`
                    : `Recordar por WhatsApp a ${a.client.name} (se abre en otra pestaña)`
                }
                className="min-w-full flex-1"
              >
                {sentAgo ? `Recordatorio enviado ${sentAgo}` : 'Recordar por WhatsApp'}
              </Button>
            )}
            {phone && (
              <Button
                size="md"
                variant="secondary"
                icon={<WhatsappIcon size={18} />}
                href={whatsappUrl(phone, a.client.name, a.starts_at, today)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WhatsApp a ${a.client.name} (se abre en otra pestaña)`}
                className="flex-1"
              >
                WhatsApp
              </Button>
            )}
          </div>
        )}
      </article>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="¿Cancelar esta cita?">
        <p className="m-0 text-body text-text-muted">
          {a.client.name} · {formatTime(a.starts_at)} · {a.service.name}. El hueco queda libre para
          otros clientes.
        </p>
        <div className="flex flex-col gap-10">
          <Button block variant="secondary" data-autofocus onClick={() => setConfirming(false)}>
            Mantener cita
          </Button>
          <Button
            block
            variant="danger"
            onClick={() => {
              setConfirming(false)
              onStatus('cancelled')
            }}
          >
            Sí, cancelar cita
          </Button>
        </div>
      </Dialog>
    </li>
  )
}
