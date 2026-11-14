import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppointmentCard } from '../../components/AppointmentCard'
import { BrandSeal } from '../../components/BrandSeal'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  CrossCircleIcon,
} from '../../components/icons'
import { Notice } from '../../components/Notice'
import { Skeleton } from '../../components/Skeleton'
import { ApiError } from '../../lib/api/client'
import {
  isTransientError,
  useAppointment,
  useBusiness,
  useCancelAppointment,
} from '../../lib/api/hooks'
import { queryKeys } from '../../lib/api/queryClient'
import type { PublicAppointment } from '../../lib/api/types'
import { formatDayLong, formatDuration, formatTime } from '../../lib/format'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'
import { appointmentIcs, downloadIcs } from './ics'
import { ReschedulePanel } from './ReschedulePanel'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

type Tone = 'success' | 'danger' | 'muted'

const TONE: Record<Tone, string> = {
  success: 'text-success',
  danger: 'text-danger',
  muted: 'text-text-muted',
}

/** Texto de cabecera por estado de la cita. */
function headerFor(status: PublicAppointment['status']) {
  switch (status) {
    case 'booked':
      return {
        label: 'Cita confirmada',
        tone: 'success' as const,
        title: 'Tu cita está lista',
        text: 'Te esperamos en Imperio. Te enviaremos un recordatorio por WhatsApp.',
      }
    case 'cancelled':
      return {
        label: 'Cancelada',
        tone: 'danger' as const,
        title: 'Cita cancelada',
        text: 'Ese horario quedó libre. Cuando quieras, agenda otra cita.',
      }
    case 'attended':
      return {
        label: 'Atendida',
        tone: 'success' as const,
        title: 'Gracias por venir',
        text: 'Fue un gusto atenderte. Te esperamos de nuevo en Imperio.',
      }
    case 'no_show':
      return {
        label: 'No asististe',
        tone: 'muted' as const,
        title: 'No pudimos atenderte',
        text: 'Esta cita quedó marcada como no asistida. No pasa nada: cuando quieras, agenda otra.',
      }
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="outline-none flex flex-col gap-[28px] px-20 pt-36 pb-36"
    >
      {children}
    </main>
  )
}

function InvalidToken() {
  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="outline-none flex flex-col items-center gap-14 px-20 py-36 text-center"
    >
      <BrandSeal size={96} />
      <h1 className="m-0 font-display text-h1 text-text">No encontramos tu cita</h1>
      <p className="m-0 text-body text-text-muted">
        El enlace no es válido o la cita ya no existe. Revisa que lo hayas copiado completo.
      </p>
      <Button block href="/">
        Agendar una cita
      </Button>
    </main>
  )
}

export function AppointmentPage() {
  useDocumentTitle('Tu cita')
  const { token = '' } = useParams()
  const appointment = useAppointment(token)

  if (appointment.isPending) {
    return (
      <Shell>
        <div role="status" aria-busy="true" className="flex flex-col items-center gap-14">
          <span className="sr-only">Cargando tu cita…</span>
          <Skeleton className="size-[96px] rounded-round" />
          <Skeleton className="h-[40px] w-[240px]" />
          <Skeleton className="h-[260px] w-full" />
        </div>
      </Shell>
    )
  }

  if (appointment.isError) {
    const error = appointment.error
    if (error instanceof ApiError && error.status === 404) return <InvalidToken />
    return (
      <Shell>
        <RetryNotice onRetry={() => void appointment.refetch()} loading={appointment.isFetching}>
          {isTransientError(error)
            ? `No pudimos cargar tu cita. ${NETWORK_MESSAGE}`
            : error.message}
        </RetryNotice>
      </Shell>
    )
  }

  return <AppointmentView token={token} appointment={appointment.data} />
}

function AppointmentView({
  token,
  appointment,
}: {
  token: string
  appointment: PublicAppointment
}) {
  const client = useQueryClient()
  const business = useBusiness()
  const cancel = useCancelAppointment(token)

  const [rescheduling, setRescheduling] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; message: string } | null>(null)

  const title = useRef<HTMLHeadingElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const refocusTitle = useRef(false)

  // Tras cancelar o reprogramar, el botón que tenía el foco desaparece: el foco va al título.
  useEffect(() => {
    if (refocusTitle.current) {
      title.current?.focus()
      refocusTitle.current = false
    }
  })

  const { status } = appointment
  const header = headerFor(status)
  const isBooked = status === 'booked'
  const muted = status === 'cancelled' || status === 'no_show'
  const StatusIcon = header.tone === 'danger' ? CrossCircleIcon : CheckCircleIcon

  function closeDialog() {
    setCancelOpen(false)
    setDialogError(null)
    trigger.current?.focus()
  }

  function confirmCancel() {
    setDialogError(null)
    cancel.mutate(undefined, {
      onSuccess: () => {
        refocusTitle.current = true
        setNotice(null)
        setRescheduling(false)
        setCancelOpen(false)
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          // Fuera de plazo (too_late_to_cancel) o cita ya no activa: se muestra el mensaje del API.
          setNotice({ tone: 'danger', message: error.message })
          setCancelOpen(false)
          void client.invalidateQueries({ queryKey: [...queryKeys.appointment, token] })
        } else if (isTransientError(error)) {
          setDialogError(`No pudimos cancelar tu cita. ${NETWORK_MESSAGE}`)
        } else {
          setDialogError((error as Error).message)
        }
      },
    })
  }

  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="outline-none flex flex-col gap-[28px] px-20 pt-36 pb-36"
    >
      <header className="flex flex-col items-center gap-10 text-center">
        <BrandSeal size={96} className="mb-8" />
        <div
          className={`flex items-center gap-8 text-overline font-medium uppercase ${TONE[header.tone]}`}
        >
          <StatusIcon />
          <span>{header.label}</span>
        </div>
        <h1
          ref={title}
          tabIndex={-1}
          className="m-0 font-display text-h1 text-text outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {header.title}
        </h1>
        <p className="m-0 text-small text-text-muted">{header.text}</p>
      </header>

      {notice && <Notice tone={notice.tone}>{notice.message}</Notice>}

      <AppointmentCard
        date={formatDayLong(appointment.starts_at)}
        time={formatTime(appointment.starts_at)}
        service={appointment.service.name}
        barber={appointment.barber.display_name}
        duration={`~${formatDuration(appointment.service.duration_min)}`}
        totalCop={appointment.service.price_cop}
        muted={muted}
      />

      {isBooked && (
        <>
          <section aria-label="Acciones de tu cita" className="flex flex-col gap-14">
            <Button
              block
              icon={<CalendarIcon size={20} />}
              onClick={() => downloadIcs(appointmentIcs(appointment))}
            >
              Agregar al calendario
            </Button>
            <div className="grid grid-cols-2 gap-10">
              <Button
                variant="secondary"
                disabled={!appointment.can_reschedule}
                aria-expanded={rescheduling}
                onClick={() => {
                  setNotice(null)
                  setRescheduling((open) => !open)
                }}
              >
                Reprogramar
              </Button>
              <Button
                variant="danger-outline"
                disabled={!appointment.can_cancel}
                onClick={(event) => {
                  trigger.current = event.currentTarget
                  setNotice(null)
                  setCancelOpen(true)
                }}
              >
                Cancelar cita
              </Button>
            </div>
            {(!appointment.can_cancel || !appointment.can_reschedule) && (
              <Notice>
                Para cambios de último momento, escríbele al local: desde aquí ya no se puede
                reprogramar ni cancelar.
              </Notice>
            )}
          </section>

          {rescheduling && appointment.can_reschedule && (
            <ReschedulePanel
              token={token}
              appointment={appointment}
              onClose={() => setRescheduling(false)}
              onDone={() => {
                refocusTitle.current = true
                setRescheduling(false)
                setNotice({
                  tone: 'success',
                  message: 'Listo: cambiamos tu cita al nuevo horario.',
                })
              }}
              onBlocked={(message) => {
                setNotice({ tone: 'danger', message })
                setRescheduling(false)
                void client.invalidateQueries({ queryKey: [...queryKeys.appointment, token] })
              }}
            />
          )}

          {business.data && (
            <Notice>
              <span>
                Llega a tu hora: esperamos hasta {business.data.tolerance_min} minutos después.
              </span>
            </Notice>
          )}
        </>
      )}

      {!isBooked && (
        <Button block href="/">
          Agendar otra cita
        </Button>
      )}

      <Link
        to="/productos"
        className="box-border flex min-h-[64px] items-center justify-between gap-[12px] rounded-card border border-line bg-surface px-14 py-14 text-text focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <span className="flex flex-col gap-[2px]">
          <span className="text-body-strong">Productos del local</span>
          <span className="text-caption text-text-muted">
            Mira qué puedes llevarte después de tu corte.
          </span>
        </span>
        <ChevronRightIcon size={20} className="shrink-0 text-gold" />
      </Link>

      <Dialog open={cancelOpen} onClose={closeDialog} title="¿Cancelar tu cita?">
        <p className="m-0 text-small text-text-muted">
          Si cancelas, ese horario queda libre para otros clientes.
        </p>
        <dl className="m-0 flex flex-col gap-10 rounded-card border border-line bg-bg px-14 py-14 text-small">
          <div className="flex items-baseline justify-between gap-[12px]">
            <dt className="sr-only">Fecha y hora</dt>
            <dd className="m-0 text-body-strong">{formatDayLong(appointment.starts_at)}</dd>
            <dd className="m-0 font-display text-price text-gold">
              {formatTime(appointment.starts_at)}
            </dd>
          </div>
          <div className="flex justify-between gap-[12px]">
            <dt className="text-text-muted">Servicio</dt>
            <dd className="m-0 text-right font-semibold">{appointment.service.name}</dd>
          </div>
          <div className="flex justify-between gap-[12px]">
            <dt className="text-text-muted">Barbero</dt>
            <dd className="m-0 text-right font-semibold">{appointment.barber.display_name}</dd>
          </div>
        </dl>
        {dialogError && <Notice tone="danger">{dialogError}</Notice>}
        <div className="flex flex-col gap-[12px]">
          <Button
            block
            variant="danger"
            icon={<CrossCircleIcon size={18} />}
            loading={cancel.isPending}
            onClick={confirmCancel}
          >
            Sí, cancelar cita
          </Button>
          <Button block variant="secondary" data-autofocus onClick={closeDialog}>
            Mantener mi cita
          </Button>
          {appointment.can_reschedule && (
            <Button
              block
              size="md"
              variant="ghost"
              onClick={() => {
                setCancelOpen(false)
                setRescheduling(true)
              }}
            >
              Prefiero reprogramar
            </Button>
          )}
        </div>
      </Dialog>
    </main>
  )
}
