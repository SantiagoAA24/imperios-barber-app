import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Skeleton } from '../../components/Skeleton'
import { cx, FOCUS_RING } from '../../components/classes'
import { useAdminAgenda, useAdminBarbers } from '../../lib/api/admin'
import {
  addDays,
  bogotaDay,
  formatClock,
  formatTime,
  formatWeekdayShort,
  dayOfMonth,
} from '../../lib/format'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'
import { AgendaHeader } from './AgendaHeader'
import {
  agendaColumns,
  blockBox,
  formatWeekRange,
  gridHeight,
  gridRange,
  hourMarks,
  laneCodes,
  PX_PER_MINUTE,
  weekDays,
  weekStart,
} from './agendaLayout'
import { NewAppointmentPanel } from './NewAppointmentPanel'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MIN_PX = 120

const LANE_TONE = [
  'border-gold-edge bg-surface-selected',
  'border-line-strong bg-surface-muted',
  'border-line bg-surface',
]

/** Agenda semanal (admin-semana.dc.html): siete columnas de día, un carril por barbero. */
export default function WeekPage() {
  useDocumentTitle('Agenda de la semana')
  const [params, setParams] = useSearchParams()
  const today = bogotaDay(new Date())
  const raw = params.get('fecha')
  const anchor = raw && DATE.test(raw) ? raw : today
  const start = weekStart(anchor)
  const days = weekDays(start)
  const end = days[6]!
  const agenda = useAdminAgenda(start, end)
  const barbers = useAdminBarbers()
  const [creating, setCreating] = useState(false)

  const items = useMemo(() => agenda.data?.items ?? [], [agenda.data])
  const range = useMemo(
    () => gridRange(agenda.data?.day_start ?? '09:00', agenda.data?.day_end ?? '18:00', items),
    [agenda.data, items],
  )
  const lanes = useMemo(
    () => agendaColumns(barbers.data?.items ?? [], items),
    [barbers.data, items],
  )
  const codes = laneCodes(lanes.map((l) => l.label))
  const laneIndex = new Map(lanes.map((l, i) => [l.id, i]))
  const height = gridHeight(range)
  const marks = hourMarks(range)
  const gridCols = `72px repeat(7, minmax(${Math.max(DAY_MIN_PX, lanes.length * 60)}px, 1fr))`
  const minWidth = 72 + 7 * Math.max(DAY_MIN_PX, lanes.length * 60)

  const countByDay = new Map<string, number>()
  for (const item of items) {
    const d = item.starts_at.slice(0, 10)
    countByDay.set(d, (countByDay.get(d) ?? 0) + 1)
  }

  const go = (d: string) => `/admin/semana?fecha=${d}`
  const subtitle = `semana ${formatWeekRange(start, end)} · ${items.length} ${items.length === 1 ? 'cita' : 'citas'}`

  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="outline-none flex flex-col gap-20 px-20 py-20 md:px-36 md:py-36"
    >
      <AgendaHeader
        view="week"
        date={days.includes(today) ? today : start}
        subtitle={subtitle}
        prev={{ to: go(addDays(start, -7)), label: 'Semana anterior' }}
        next={{ to: go(addDays(start, 7)), label: 'Semana siguiente' }}
        todayTo={go(today)}
        onNew={() => setCreating(true)}
      />

      <ul
        aria-label="Carriles por barbero"
        className="m-0 flex list-none flex-wrap items-center gap-14 p-0 text-small text-text"
      >
        {lanes.map((lane, i) => (
          <li key={lane.id} className="flex items-center gap-8">
            <span
              aria-hidden="true"
              className={cx(
                'h-[14px] w-[14px] rounded-field border',
                LANE_TONE[i % LANE_TONE.length],
              )}
            />
            {lane.label} ({codes[i]})
          </li>
        ))}
        <li className="text-text-muted">Cada columna de día se divide en un carril por barbero.</li>
      </ul>

      <div className="flex flex-wrap items-start gap-14">
        <section
          aria-label="Agenda de la semana"
          // Con teclado: foco aquí y flechas para desplazarse si las siete columnas no caben.
          tabIndex={0}
          className={cx(
            'min-w-0 flex-[3_1_620px] overflow-x-auto rounded-summary border border-line bg-surface',
            FOCUS_RING,
          )}
        >
          {agenda.isPending || barbers.isPending ? (
            <div role="status" aria-busy="true" className="flex flex-col gap-10 p-20">
              <span className="sr-only">Cargando la semana…</span>
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
                No pudimos cargar la semana. {NETWORK_MESSAGE}
              </RetryNotice>
            </div>
          ) : (
            <div style={{ minWidth }}>
              <div className="grid border-b border-line" style={{ gridTemplateColumns: gridCols }}>
                <span aria-hidden="true" />
                {days.map((d) => {
                  const isToday = d === today
                  const n = countByDay.get(d) ?? 0
                  return (
                    <Link
                      key={d}
                      to={`/admin/agenda?fecha=${d}`}
                      aria-current={isToday ? 'date' : undefined}
                      className={cx(
                        'm-4 flex min-h-touch flex-col items-center justify-center rounded-field border px-4 py-4 text-center font-body',
                        isToday
                          ? 'border-gold bg-surface-selected text-gold'
                          : 'border-transparent text-text hover:border-line-strong',
                        FOCUS_RING,
                      )}
                    >
                      <span
                        className={cx(
                          'text-caption',
                          isToday ? 'font-semibold' : 'text-text-muted',
                        )}
                      >
                        {formatWeekdayShort(d)}
                        {isToday && ' · hoy'}
                      </span>
                      <span className="text-body-strong">{dayOfMonth(d)}</span>
                      <span className="text-caption text-text-muted">
                        {n} {n === 1 ? 'cita' : 'citas'}
                      </span>
                    </Link>
                  )
                })}
              </div>
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
                {days.map((d) => (
                  <div
                    key={d}
                    role="group"
                    aria-label={`Citas del ${d}`}
                    className={cx(
                      'relative border-l border-line',
                      d === today && 'bg-surface-selected/40',
                    )}
                  >
                    {items
                      .filter((i) => i.starts_at.slice(0, 10) === d)
                      .map((item) => {
                        const idx = laneIndex.get(item.barber.id) ?? 0
                        const box = blockBox(item, range)
                        const width = 100 / Math.max(lanes.length, 1)
                        return (
                          <div
                            key={item.id}
                            style={{
                              top: box.top,
                              height: box.height,
                              left: `calc(${idx * width}% + 2px)`,
                              width: `calc(${width}% - 4px)`,
                            }}
                            className={cx(
                              'absolute box-border flex flex-col overflow-hidden rounded-field border px-4 py-[1px] font-body',
                              LANE_TONE[idx % LANE_TONE.length],
                            )}
                          >
                            <span className="truncate text-caption font-semibold text-text">
                              {item.client.name}
                            </span>
                            <span className="text-caption text-text-muted">{codes[idx]}</span>
                            <span className="sr-only">
                              {item.service.name}, {formatTime(item.starts_at)},{' '}
                              {item.barber.display_name}
                            </span>
                          </div>
                        )
                      })}
                  </div>
                ))}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                  {marks.map((m) => (
                    <span
                      key={m}
                      className="absolute inset-x-0 border-t border-line"
                      style={{ top: Math.round((m - range.startMin) * PX_PER_MINUTE) }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {creating && (
          <NewAppointmentPanel
            day={anchor >= start && anchor <= end ? anchor : start}
            onClose={() => {
              setCreating(false)
              document.getElementById('nueva-cita')?.focus()
            }}
            onCreated={(created) => {
              setCreating(false)
              setParams({ fecha: created.starts_at.slice(0, 10) })
            }}
          />
        )}
      </div>
    </main>
  )
}
