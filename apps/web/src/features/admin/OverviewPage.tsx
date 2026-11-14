import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Notice } from '../../components/Notice'
import { Skeleton } from '../../components/Skeleton'
import { cx, FOCUS_RING, TRANSITION } from '../../components/classes'
import { PlusIcon } from '../../components/icons'
import { useAdminOverview } from '../../lib/api/admin'
import { ApiError } from '../../lib/api/client'
import type { AdminOverview } from '../../lib/api/types'
import { bogotaDay, formatCOP } from '../../lib/format'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'
import { RevenueChart } from './RevenueChart'
import { monthRange, peakDay, periodTitle, validateCustomRange } from './overviewRange'
import type { RangeMode } from './overviewRange'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const MODES: Array<{ value: RangeMode; label: string }> = [
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'custom', label: 'Personalizado' },
]

const CARD = 'flex flex-col gap-4 rounded-summary border border-line bg-surface p-20'

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={CARD}>
      <span className="text-small text-text-muted">{label}</span>
      <span className="font-display text-h1 text-text">{value}</span>
      <span className="text-caption text-text-muted">{note}</span>
    </div>
  )
}

function percent(rate: number | null): string {
  return rate === null ? 'Sin datos' : `${Math.round(rate * 100)}%`
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function Cards({ data }: { data: AdminOverview }) {
  const a = data.appointments
  const decided = a.attended + a.no_show
  return (
    <section
      aria-label="Indicadores"
      className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-14"
    >
      <Stat
        label="Ingresos"
        value={formatCOP(data.revenue_cop)}
        note={`Citas atendidas. Pendientes por cobrar: ${formatCOP(data.projected_cop)}`}
      />
      <Stat
        label="Citas"
        value={String(a.total)}
        note={`${plural(a.attended, 'atendida', 'atendidas')} · ${a.no_show} ${a.no_show === 1 ? 'no asistió' : 'no asistieron'} · ${plural(a.booked, 'pendiente', 'pendientes')} · ${plural(a.cancelled, 'cancelada', 'canceladas')}`}
      />
      <Stat
        label="Asistencia"
        value={percent(data.attendance_rate)}
        note={
          decided === 0
            ? 'Aún no hay citas atendidas ni inasistencias.'
            : `${plural(a.no_show, 'inasistencia', 'inasistencias')} de ${plural(decided, 'cita', 'citas')}`
        }
      />
      <Stat
        label="Clientes nuevos"
        value={String(data.new_clients)}
        note="Se registraron en este periodo"
      />
    </section>
  )
}

/** Resumen (admin-resumen.dc.html): cifras, ingresos por día, servicios y barberos. */
export default function OverviewPage() {
  useDocumentTitle('Resumen')
  const today = bogotaDay(new Date())
  const [mode, setMode] = useState<RangeMode>('week')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const customError = mode === 'custom' ? validateCustomRange(custom.from, custom.to) : null
  const range =
    mode === 'month' ? monthRange(today) : mode === 'custom' && !customError ? custom : null
  const waiting = mode === 'custom' && customError !== null
  const query = useAdminOverview(range)
  const data = waiting ? undefined : query.data

  const peak = data ? peakDay(data.revenue_by_day) : null
  const subtitle = data ? periodTitle(mode, data.date_from, data.date_to) : ' '
  const topMax = Math.max(1, ...(data?.top_services.map((s) => s.count) ?? [1]))

  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="outline-none flex flex-col gap-20 px-20 py-20 md:px-36 md:py-36"
    >
      <header className="flex flex-wrap items-end justify-between gap-14">
        <div className="flex flex-col gap-4">
          <h1 className="m-0 font-display text-h1 text-text">Resumen</h1>
          <p className="m-0 text-small text-text-muted">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-10">
          <div
            role="group"
            aria-label="Periodo"
            className="flex flex-wrap gap-4 rounded-pill border border-line-strong bg-surface p-4"
          >
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={mode === m.value}
                onClick={() => setMode(m.value)}
                className={cx(
                  'min-h-touch rounded-pill border-0 px-14 text-small font-semibold',
                  mode === m.value
                    ? 'bg-gold text-on-gold'
                    : 'bg-transparent text-text-muted hover:text-text',
                  TRANSITION,
                  FOCUS_RING,
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <Link
            to="/admin/agenda"
            className={cx(
              'inline-flex min-h-control-54 items-center gap-8 rounded-field bg-gold px-20 text-button font-semibold text-on-gold hover:brightness-110',
              FOCUS_RING,
            )}
          >
            <PlusIcon /> Nueva cita
          </Link>
        </div>
      </header>

      {mode === 'custom' && (
        <div className="flex flex-wrap items-end gap-14">
          {(
            [
              ['from', 'Desde'],
              ['to', 'Hasta'],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex flex-col gap-[6px] font-body text-label text-text-muted"
            >
              {label}
              <input
                type="date"
                value={custom[key]}
                onChange={(e) => setCustom((c) => ({ ...c, [key]: e.target.value }))}
                className={cx(
                  'box-border h-control-46 min-h-touch rounded-field border border-line-strong bg-surface px-14 text-button text-text',
                  FOCUS_RING,
                )}
              />
            </label>
          ))}
          {customError && custom.from && custom.to && <Notice tone="danger">{customError}</Notice>}
          {!custom.from || !custom.to ? (
            <p className="m-0 text-small text-text-muted">
              Elige las dos fechas para ver el resumen.
            </p>
          ) : null}
        </div>
      )}

      {waiting ? null : query.isPending ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-14">
          <span className="sr-only">Cargando el resumen…</span>
          <Skeleton className="h-[120px] w-full" />
          <Skeleton className="h-[260px] w-full" />
        </div>
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.status < 500 ? (
          <Notice tone="danger">{query.error.message}</Notice>
        ) : (
          <RetryNotice onRetry={() => void query.refetch()} loading={query.isFetching}>
            No pudimos cargar el resumen. {NETWORK_MESSAGE}
          </RetryNotice>
        )
      ) : data ? (
        <>
          <Cards data={data} />

          <section className="flex flex-wrap items-start gap-14">
            <div className={cx(CARD, 'min-w-0 flex-[3_1_460px]')}>
              <div className="flex flex-wrap items-baseline justify-between gap-10">
                <h2 className="m-0 font-display text-h2 text-text">Ingresos por día</h2>
                <span className="text-small text-text-muted">
                  {peak ? `Pico: ${peak.label}` : 'Sin ingresos en el periodo'}
                </span>
              </div>
              <RevenueChart days={data.revenue_by_day} />
            </div>
            <div className={cx(CARD, 'min-w-0 flex-[2_1_300px]')}>
              <h2 className="m-0 font-display text-h2 text-text">Servicios más pedidos</h2>
              {data.top_services.length === 0 ? (
                <p className="m-0 text-small text-text-muted">
                  Todavía no hay citas en este periodo.
                </p>
              ) : (
                <ol className="m-0 flex list-none flex-col gap-14 p-0">
                  {data.top_services.map((s) => (
                    <li key={s.service_id} className="flex flex-col gap-4">
                      <div className="flex items-baseline justify-between gap-10 text-small">
                        <span className="min-w-0 truncate text-text">{s.name}</span>
                        <span className="shrink-0 font-semibold text-text">
                          {plural(s.count, 'cita', 'citas')}
                        </span>
                      </div>
                      <div aria-hidden="true" className="h-[8px] rounded-pill bg-surface-muted">
                        <div
                          className="h-full rounded-pill bg-gold"
                          style={{ width: `${Math.round((s.count / topMax) * 100)}%` }}
                        />
                      </div>
                      <span className="text-caption text-text-muted">
                        Ingresos: {formatCOP(s.revenue_cop)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section className={cx(CARD, 'overflow-x-auto')}>
            <h2 className="m-0 font-display text-h2 text-text">Barberos</h2>
            {data.by_barber.length === 0 ? (
              <p className="m-0 text-small text-text-muted">
                Todavía no hay citas en este periodo.
              </p>
            ) : (
              <table className="w-full min-w-[420px] border-collapse text-small">
                <thead>
                  <tr className="text-left text-text-muted">
                    <th scope="col" className="py-10 pr-8 font-medium">
                      Barbero
                    </th>
                    <th scope="col" className="px-8 py-10 text-right font-medium">
                      Citas
                    </th>
                    <th scope="col" className="px-8 py-10 text-right font-medium">
                      Ingresos
                    </th>
                    <th scope="col" className="py-10 pl-8 text-right font-medium">
                      No asistió
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_barber.map((b) => (
                    <tr key={b.barber_id} className="border-t border-line">
                      <th scope="row" className="py-10 pr-8 text-left font-semibold text-text">
                        {b.display_name}
                      </th>
                      <td className="px-8 py-10 text-right text-text">{b.count}</td>
                      <td className="px-8 py-10 text-right font-semibold text-gold">
                        {formatCOP(b.revenue_cop)}
                      </td>
                      <td className="py-10 pl-8 text-right text-text-muted">{b.no_show}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : null}
    </main>
  )
}
