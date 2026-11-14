import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'
import { Skeleton } from '../../components/Skeleton'
import { ArrowLeftIcon, ChevronRightIcon, PlusIcon, RefreshIcon } from '../../components/icons'
import { cx, FOCUS_RING, TAPPABLE, TRANSITION } from '../../components/classes'
import {
  useAgenda,
  useChangeStatus,
  usePendingReview,
  useReminderSent,
  useResolvePending,
} from '../../lib/api/barber'
import type { NewStatus } from '../../lib/api/barber'
import { useMe } from '../../lib/api/auth'
import { isTransientError, useBusiness } from '../../lib/api/hooks'
import { addDays, bogotaDay, formatCOP, formatDayLong } from '../../lib/format'
import { PendingReviewSection } from '../shared/PendingReviewList'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'
import { AppointmentRow } from './AppointmentRow'
import { updatedAgo } from './updatedAgo'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Reloj que se actualiza solo: para "Actualizado hace X" y para saber cuándo cambia el día. */
function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(id)
  }, [everyMs])
  return now
}

const NAV_BUTTON = cx(
  'box-border flex min-h-touch min-w-touch items-center justify-center rounded-card border border-line bg-surface text-gold',
  TAPPABLE,
  TRANSITION,
  FOCUS_RING,
  'enabled:hover:border-line-strong enabled:active:bg-surface-selected',
)

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-4 rounded-card border border-line bg-surface px-8 py-14">
      <span className="font-display text-price text-text">{value}</span>
      <span className="text-caption text-text-muted">{label}</span>
    </div>
  )
}

/** Agenda del día del barbero (barbero.dc.html): resumen, siguiente cita y acciones por cita. */
export function AgendaPage() {
  useDocumentTitle('Mi agenda')
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const me = useMe()
  const now = useNow(5_000)
  const today = bogotaDay(new Date(now))
  const requested = params.get('fecha')
  const date = requested && DAY.test(requested) ? requested : today
  const highlightId = params.get('cita')

  const agenda = useAgenda(date)
  const change = useChangeStatus(date)
  const business = useBusiness()
  const reminder = useReminderSent(date)
  const pending = usePendingReview()
  const resolvePending = useResolvePending()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busyIds, setBusyIds] = useState<string[]>([])

  // Aviso de éxito que deja otra pantalla (p. ej. "Cita guardada"); se lee una vez y se limpia.
  const [flash] = useState<string | null>(
    () => (location.state as { flash?: string } | null)?.flash ?? null,
  )
  useEffect(() => {
    if (flash) navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
    // Solo al montar: limpia el estado de navegación para que recargar no repita el aviso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const appointments = agenda.data?.appointments ?? []
  const nextId = appointments.find((a) => a.status === 'booked' && !a.is_overdue)?.id ?? null

  // Llegar desde un conflicto de horario: se desplaza hasta la cita una sola vez.
  const scrolled = useRef(false)
  useEffect(() => {
    if (!highlightId || scrolled.current || !agenda.data) return
    const target = document.getElementById(`cita-${highlightId}`)
    if (target) {
      scrolled.current = true
      target.scrollIntoView({ block: 'center' })
    }
  }, [highlightId, agenda.data])

  function goTo(day: string) {
    setParams(day === today ? {} : { fecha: day })
  }

  async function onStatus(id: string, status: NewStatus) {
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id)))
    setBusyIds((prev) => [...prev, id])
    try {
      await change.mutateAsync({ id, status })
    } catch (error) {
      const message = isTransientError(error)
        ? `No pudimos guardar el cambio. ${NETWORK_MESSAGE}`
        : (error as Error).message
      setErrors((prev) => ({ ...prev, [id]: message }))
    } finally {
      setBusyIds((prev) => prev.filter((x) => x !== id))
    }
  }

  const isToday = date === today
  const summary = agenda.data?.summary

  return (
    <main id="contenido" tabIndex={-1} className="outline-none flex flex-col gap-20 px-20 pb-20">
      <div className="flex flex-col gap-4">
        {me.data && <p className="m-0 text-small text-text-muted">Hola, {me.data.name}</p>}
        <h1 className="m-0 font-display text-h1 text-text">Mi agenda</h1>
      </div>

      {flash && <Notice tone="success">{flash}</Notice>}

      <nav aria-label="Día de la agenda" className="flex items-center gap-10">
        <button
          type="button"
          aria-label="Día anterior"
          className={NAV_BUTTON}
          onClick={() => goTo(addDays(date, -1))}
        >
          <ArrowLeftIcon size={20} />
        </button>
        <button
          type="button"
          aria-current={isToday ? 'date' : undefined}
          className={cx(
            'box-border flex min-h-touch flex-1 flex-col items-center justify-center rounded-card border px-14 py-8 text-center',
            isToday ? 'border-gold-edge bg-surface-selected' : 'border-line bg-surface',
            TAPPABLE,
            TRANSITION,
            FOCUS_RING,
          )}
          onClick={() => goTo(today)}
        >
          <span className="text-caption font-semibold text-gold">
            {isToday ? 'Hoy' : 'Ir a hoy'}
          </span>
          <span className="text-small text-text">{formatDayLong(date)}</span>
        </button>
        <button
          type="button"
          aria-label="Día siguiente"
          className={NAV_BUTTON}
          onClick={() => goTo(addDays(date, 1))}
        >
          <ChevronRightIcon size={20} />
        </button>
      </nav>

      {/* Siempre montada: su región `role="status"` debe seguir ahí cuando se marca la última. */}
      <PendingReviewSection
        headingId="por-revisar-titulo"
        items={(pending.data?.items ?? []).map((a) => ({
          id: a.id,
          starts_at: a.starts_at,
          clientName: a.client.name,
          serviceName: a.service.name,
        }))}
        resolve={(id, status) => resolvePending.mutateAsync({ id, status })}
      />

      <section aria-label="Resumen del día" className="flex flex-col gap-10">
        <div className="flex gap-10">
          <Stat value={summary ? String(summary.attended) : '–'} label="Atendidas" />
          <Stat value={summary ? String(summary.pending) : '–'} label="Pendientes" />
          <Stat value={summary ? formatCOP(summary.revenue_cop) : '–'} label="Ingresos" />
        </div>
        {summary && summary.total > 0 && (
          <p className="m-0 text-caption text-text-muted">
            {summary.total} {summary.total === 1 ? 'cita' : 'citas'} en el día
            {summary.no_show > 0 && ` · ${summary.no_show} no asistió`}
          </p>
        )}
      </section>

      <div className="flex items-center justify-between gap-10">
        <p className="m-0 text-caption text-text-muted">{updatedAgo(agenda.dataUpdatedAt, now)}</p>
        <Button
          size="md"
          variant="ghost"
          icon={<RefreshIcon size={18} />}
          loading={agenda.isFetching && !agenda.isPending}
          onClick={() => void agenda.refetch()}
        >
          Actualizar
        </Button>
      </div>

      {agenda.isError && agenda.data && (
        <Notice tone="danger">
          No pudimos actualizar la agenda. Estás viendo los datos de{' '}
          {updatedAgo(agenda.dataUpdatedAt, now).replace('Actualizado ', '')}.
        </Notice>
      )}

      <section aria-labelledby="agenda-titulo" className="flex flex-col gap-14">
        <div className="flex items-center justify-between gap-10">
          <h2 id="agenda-titulo" className="m-0 font-display text-h2 text-text">
            {isToday ? 'Agenda de hoy' : 'Agenda del día'}
          </h2>
          <Button
            size="md"
            variant="ghost"
            href="/barbero/nueva"
            icon={<PlusIcon size={18} />}
            onClick={(event) => {
              event.preventDefault()
              navigate('/barbero/nueva')
            }}
          >
            Cita
          </Button>
        </div>

        {agenda.isPending && (
          <div role="status" aria-busy="true" className="flex flex-col gap-10">
            <span className="sr-only">Cargando la agenda…</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[124px] w-full" />
            ))}
          </div>
        )}

        {agenda.isError && !agenda.data && (
          <RetryNotice onRetry={() => void agenda.refetch()} loading={agenda.isFetching}>
            {isTransientError(agenda.error)
              ? `No pudimos cargar la agenda. ${NETWORK_MESSAGE}`
              : (agenda.error as Error).message}
          </RetryNotice>
        )}

        {agenda.data && appointments.length === 0 && (
          <div className="flex flex-col items-start gap-10">
            <Notice>No tienes citas para este día.</Notice>
            <Button
              size="md"
              variant="secondary"
              href="/barbero/nueva"
              onClick={(event) => {
                event.preventDefault()
                navigate('/barbero/nueva')
              }}
            >
              Registrar un turno sin cita
            </Button>
          </div>
        )}

        {appointments.length > 0 && (
          <ul className="m-0 flex flex-col gap-10 p-0">
            {appointments.map((a) => (
              <AppointmentRow
                key={a.id}
                appointment={a}
                isNext={a.id === nextId}
                today={today}
                now={now}
                toleranceMin={business.data?.tolerance_min ?? 5}
                onReminderSent={() => reminder.mutate(a.id)}
                highlighted={a.id === highlightId}
                busy={busyIds.includes(a.id)}
                error={errors[a.id] ?? null}
                onStatus={(status) => void onStatus(a.id, status)}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
