import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Skeleton } from '../../components/Skeleton'
import { StatusBadge } from '../../components/StatusBadge'
import { cx, FOCUS_RING, TRANSITION } from '../../components/classes'
import { useAdminAgenda, useAdminBarbers, useAdminServices } from '../../lib/api/admin'
import type { AdminAppointment } from '../../lib/api/types'
import {
  addDays,
  bogotaDay,
  formatClock,
  formatDayLong,
  formatTime,
  minutesOfDay,
} from '../../lib/format'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'
import { AgendaHeader } from './AgendaHeader'
import {
  agendaColumns,
  blockBox,
  gridHeight,
  gridRange,
  hourMarks,
  nowLineTop,
  PX_PER_MINUTE,
} from './agendaLayout'
import { AppointmentPanel, badgeStatus } from './AppointmentPanel'
import { NewAppointmentPanel } from './NewAppointmentPanel'

const DATE = /^\d{4}-\d{2}-\d{2}$/

const BOX: Record<string, string> = {
  booked: 'border-line-strong bg-bg',
  attended: 'border-line bg-surface-muted',
  no_show: 'border-danger border-dashed bg-surface',
  cancelled: 'border-line border-dashed bg-surface opacity-70',
  overdue: 'border-danger bg-surface-selected',
}

function useNowMinutes(): number {
  const [now, setNow] = useState(() => minutesOfDay(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setNow(minutesOfDay(new Date())), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function Block({
  item,
  top,
  height,
  selected,
  onSelect,
}: {
  item: AdminAppointment
  top: number
  height: number
  selected: boolean
  onSelect: () => void
}) {
  const status = badgeStatus(item)
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      style={{ top, height }}
      className={cx(
        'absolute inset-x-[4px] box-border flex flex-col items-start gap-0 overflow-hidden rounded-field border px-8 py-[2px] text-left font-body',
        BOX[status],
        selected && 'ring-2 ring-gold',
        TRANSITION,
        FOCUS_RING,
      )}
    >
      <span className="flex w-full items-center justify-between gap-4">
        <span className="truncate text-caption font-semibold text-text">{item.client.name}</span>
        <StatusBadge status={status} className="shrink-0" />
      </span>
      <span className="w-full truncate text-caption text-text-muted">{item.service.name}</span>
      <span className="sr-only">{formatTime(item.starts_at)}</span>
    </button>
  )
}

/** Agenda del día (admin-agenda.dc.html): una columna por barbero y una del vaporizador. */
export default function AgendaPage() {
  const [params, setParams] = useSearchParams()
  const today = bogotaDay(new Date())
  const raw = params.get('fecha')
  const day = raw && DATE.test(raw) ? raw : today
  const agenda = useAdminAgenda(day, day)
  const barbers = useAdminBarbers()
  const services = useAdminServices()
  const nowMin = useNowMinutes()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const items = useMemo(() => agenda.data?.items ?? [], [agenda.data])
  const range = useMemo(
    () => gridRange(agenda.data?.day_start ?? '09:00', agenda.data?.day_end ?? '18:00', items),
    [agenda.data, items],
  )
  const columns = useMemo(
    () => agendaColumns(barbers.data?.items ?? [], items),
    [barbers.data, items],
  )
  const resource = services.data?.resources[0]
  const selected = items.find((i) => i.id === selectedId)
  const line = nowLineTop(day === today, nowMin, range)
  const height = gridHeight(range)
  const vaporItems = items.filter((i) => i.service.uses_resource)
  const showVapor = Boolean(resource) || vaporItems.length > 0
  const marks = hourMarks(range)

  const go = (d: string) => `/admin/agenda?fecha=${d}`
  const gridCols = `72px repeat(${columns.length + (showVapor ? 1 : 0)}, minmax(150px, 1fr))`

  const subtitle = `${formatDayLong(day)} · ${columns.length} ${columns.length === 1 ? 'barbero' : 'barberos'}${
    resource ? ` · 1 ${resource.name.toLowerCase()}` : ''
  }`

  return (
    <main className="flex flex-col gap-20 px-20 py-20 md:px-36 md:py-36">
      <AgendaHeader
        view="day"
        date={day}
        subtitle={subtitle}
        prev={{ to: go(addDays(day, -1)), label: 'Día anterior' }}
        next={{ to: go(addDays(day, 1)), label: 'Día siguiente' }}
        todayTo={go(today)}
        onNew={() => {
          setSelectedId(null)
          setCreating(true)
        }}
      />
      <label className="flex max-w-[260px] flex-col gap-[6px] font-body text-label text-text-muted">
        Ir a un día
        <input
          type="date"
          value={day}
          onChange={(e) => e.target.value && setParams({ fecha: e.target.value })}
          className={cx(
            'box-border h-control-46 min-h-touch rounded-field border border-line-strong bg-surface px-14 text-button text-text',
            FOCUS_RING,
          )}
        />
      </label>

      <div className="flex flex-wrap items-start gap-14">
        <section
          aria-label="Agenda del día"
          className="min-w-0 flex-[3_1_620px] overflow-x-auto rounded-summary border border-line bg-surface"
        >
          {agenda.isPending || barbers.isPending ? (
            <div role="status" aria-busy="true" className="flex flex-col gap-10 p-20">
              <span className="sr-only">Cargando la agenda…</span>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-[44px] w-full" />
              ))}
            </div>
          ) : agenda.isError || barbers.isError ? (
            <div className="p-20">
              <RetryNotice
                onRetry={() => {
                  void agenda.refetch()
                  void barbers.refetch()
                }}
                loading={agenda.isFetching}
              >
                No pudimos cargar la agenda. {NETWORK_MESSAGE}
              </RetryNotice>
            </div>
          ) : (
            <div style={{ minWidth: 72 + (columns.length + (showVapor ? 1 : 0)) * 150 }}>
              <div
                className="grid border-b border-line text-small font-semibold text-text"
                style={{ gridTemplateColumns: gridCols }}
              >
                <span className="sr-only">Hora</span>
                <span aria-hidden="true" />
                {columns.map((c) => (
                  <h2 key={c.id} className="m-0 px-10 py-14 text-small font-semibold">
                    {c.label}
                  </h2>
                ))}
                {showVapor && (
                  <h2 className="m-0 px-10 py-14 text-small font-semibold">
                    {resource?.name ?? 'Vaporizador'}
                  </h2>
                )}
              </div>
              {items.length === 0 && (
                <p className="m-0 border-b border-line px-20 py-14 text-small text-text-muted">
                  No hay citas este día. Usa «Nueva cita» para crear una.
                </p>
              )}
              <div className="relative grid" style={{ gridTemplateColumns: gridCols, height }}>
                <div className="relative" aria-hidden="true">
                  {marks.map((m) => (
                    <span
                      key={m}
                      className="absolute right-10 -translate-y-1/2 text-caption text-text-muted"
                      style={{ top: Math.round((m - range.startMin) * PX_PER_MINUTE) }}
                    >
                      {formatClock(m)}
                    </span>
                  ))}
                </div>
                {columns.map((c) => (
                  <div
                    key={c.id}
                    role="group"
                    aria-label={`Citas de ${c.label}`}
                    className="relative border-l border-line"
                  >
                    {items
                      .filter((i) => i.barber.id === c.id)
                      .map((item) => (
                        <Block
                          key={item.id}
                          item={item}
                          {...blockBox(item, range)}
                          selected={item.id === selectedId}
                          onSelect={() => {
                            setCreating(false)
                            setSelectedId(item.id)
                          }}
                        />
                      ))}
                  </div>
                ))}
                {showVapor && (
                  <div
                    role="group"
                    aria-label={`Uso de ${resource?.name ?? 'Vaporizador'}`}
                    className="relative border-l border-line"
                  >
                    {vaporItems.map((item) => {
                      const box = blockBox(item, range)
                      return (
                        <div
                          key={item.id}
                          style={{ top: box.top, height: box.height }}
                          className="absolute inset-x-[4px] box-border flex flex-col overflow-hidden rounded-field border border-gold-edge bg-surface-selected px-8 py-4 font-body"
                        >
                          <span className="truncate text-caption font-semibold text-text">
                            {item.client.name}
                          </span>
                          <span className="truncate text-caption text-text-muted">
                            En uso · {item.barber.display_name}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* Líneas de hora, solo decorativas. */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                  {marks.map((m) => (
                    <span
                      key={m}
                      className="absolute inset-x-0 border-t border-line"
                      style={{ top: Math.round((m - range.startMin) * PX_PER_MINUTE) }}
                    />
                  ))}
                </div>
                {line !== null && (
                  <div
                    role="presentation"
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                    style={{ top: line }}
                  >
                    <span className="rounded-pill bg-danger px-8 text-caption font-semibold text-on-gold">
                      Ahora
                    </span>
                    <span className="h-0 flex-1 border-t-2 border-danger" />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {creating && (
          <NewAppointmentPanel
            key="new"
            day={day}
            onClose={() => {
              setCreating(false)
              document.getElementById('nueva-cita')?.focus()
            }}
            onCreated={(created) => {
              setCreating(false)
              setParams({ fecha: created.starts_at.slice(0, 10) })
              setSelectedId(created.id)
            }}
          />
        )}
        {!creating && selected && (
          <AppointmentPanel appointment={selected} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </main>
  )
}
