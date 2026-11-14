import { useState } from 'react'
import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'
import { Skeleton } from '../../components/Skeleton'
import { StatusBadge } from '../../components/StatusBadge'
import { cx, FOCUS_RING, TRANSITION } from '../../components/classes'
import { WhatsappIcon } from '../../components/icons'
import { useAdminClient, useAdminClients, useSaveClientNotes } from '../../lib/api/admin'
import { ApiError } from '../../lib/api/client'
import type { AdminClientListItem, ClientFilter } from '../../lib/api/types'
import { formatCOP, formatDayLong, formatTime, bogotaDay } from '../../lib/format'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'
import {
  clientWhatsappUrl,
  formatAttendance,
  formatFullPhone,
  formatSince,
  initials,
} from './clientFormat'
import { useDebounced } from './useDebounced'

const SEARCH_DELAY_MS = 300
const MAX_NOTES = 500

const FILTERS: Array<{ value: ClientFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'frequent', label: 'Frecuentes' },
  { value: 'no_show', label: 'Con inasistencias' },
]

function shortDay(iso: string | null): string {
  if (!iso) return 'Sin visitas'
  // '13 nov' (día y mes) a partir del formato largo del proyecto.
  const [, day, month] = formatDayLong(iso).split(' ')
  return `${day} ${month}`
}

/** Clientes (admin-clientes.dc.html): búsqueda, filtros, tabla paginada y detalle con notas. */
export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ClientFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const q = useDebounced(search.trim(), SEARCH_DELAY_MS)
  const list = useAdminClients({ q, filter })

  const pages = list.data?.pages ?? []
  const rows = pages.flatMap((p) => p.items)
  const total = pages[0]?.total ?? 0
  const subtitle = list.isSuccess ? `${total} ${total === 1 ? 'cliente' : 'clientes'}` : 'Clientes'

  return (
    <main className="flex flex-col gap-20 px-20 py-20 md:px-36 md:py-36">
      <header className="flex flex-col gap-4">
        <h1 className="m-0 font-display text-h1 text-text">Clientes</h1>
        <p className="m-0 text-small text-text-muted">{subtitle}</p>
      </header>

      <div className="flex flex-wrap items-start gap-14">
        <section
          aria-label="Lista de clientes"
          className="flex min-w-0 flex-[2_1_560px] flex-col gap-14 rounded-summary border border-line bg-surface p-14"
        >
          <div className="flex flex-wrap items-end gap-14">
            <div className="flex min-w-[220px] flex-1 flex-col gap-[6px] font-body">
              <label htmlFor="cl-buscar" className="text-label text-text-muted">
                Buscar cliente
              </label>
              <input
                id="cl-buscar"
                type="search"
                value={search}
                placeholder="Nombre o últimos dígitos"
                onChange={(e) => setSearch(e.target.value)}
                className={cx(
                  'box-border h-control-52 min-h-touch w-full rounded-field border border-line-strong bg-bg px-14 text-button text-text placeholder:text-text-muted',
                  FOCUS_RING,
                )}
              />
            </div>
            <div role="group" aria-label="Filtro" className="flex flex-wrap gap-8">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={cx(
                    'box-border min-h-touch rounded-pill border px-14 text-small font-semibold',
                    filter === f.value
                      ? 'border-gold bg-surface-selected text-gold'
                      : 'border-line-strong bg-surface text-text',
                    TRANSITION,
                    FOCUS_RING,
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {list.isPending ? (
            <div role="status" aria-busy="true" className="flex flex-col gap-10">
              <span className="sr-only">Cargando clientes…</span>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-[44px] w-full" />
              ))}
            </div>
          ) : list.isError ? (
            <RetryNotice onRetry={() => void list.refetch()} loading={list.isFetching}>
              No pudimos cargar los clientes. {NETWORK_MESSAGE}
            </RetryNotice>
          ) : rows.length === 0 ? (
            <p role="status" className="m-0 py-20 text-body text-text-muted">
              {q || filter !== 'all'
                ? 'No encontramos clientes con esa búsqueda o filtro.'
                : 'Aún no tienes clientes. Aparecen cuando agendan su primera cita.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-small">
                <caption className="sr-only">Clientes de la barbería</caption>
                <thead>
                  <tr className="text-left text-text-muted">
                    <th scope="col" className="py-10 pr-8 font-medium">
                      Cliente
                    </th>
                    <th scope="col" className="px-8 py-10 font-medium">
                      Celular
                    </th>
                    <th scope="col" className="px-8 py-10 text-right font-medium">
                      Citas
                    </th>
                    <th scope="col" className="px-8 py-10 font-medium">
                      Última visita
                    </th>
                    <th scope="col" className="py-10 pl-8 font-medium">
                      Asistencia
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <ClientRow
                      key={c.id}
                      client={c}
                      selected={c.id === selectedId}
                      onSelect={() => setSelectedId(c.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {list.isSuccess && rows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-10">
              <p role="status" className="m-0 text-caption text-text-muted">
                Mostrando {rows.length} de {total} · el celular se muestra parcial por privacidad.
              </p>
              {list.hasNextPage && (
                <Button
                  size="md"
                  variant="secondary"
                  loading={list.isFetchingNextPage}
                  onClick={() => void list.fetchNextPage()}
                >
                  Cargar más
                </Button>
              )}
            </div>
          )}
        </section>

        {selectedId && <ClientDetail key={selectedId} id={selectedId} />}
      </div>
    </main>
  )
}

function ClientRow({
  client,
  selected,
  onSelect,
}: {
  client: AdminClientListItem
  selected: boolean
  onSelect: () => void
}) {
  return (
    <tr className={cx('border-t border-line', selected && 'bg-surface-selected')}>
      <th scope="row" className="py-4 pr-8 text-left font-semibold text-text">
        <button
          type="button"
          aria-pressed={selected}
          onClick={onSelect}
          className={cx(
            'flex min-h-touch items-center gap-10 rounded-field border-0 bg-transparent px-4 text-left text-small font-semibold text-text',
            FOCUS_RING,
          )}
        >
          <span
            aria-hidden="true"
            className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-round bg-surface-muted text-caption text-gold"
          >
            {initials(client.name)}
          </span>
          {client.name}
        </button>
      </th>
      <td className="px-8 py-10 text-text-muted">{client.phone_masked ?? 'Sin celular'}</td>
      <td className="px-8 py-10 text-right text-text">{client.appointments_count}</td>
      <td className="px-8 py-10 text-text-muted">{shortDay(client.last_visit_at)}</td>
      <td
        className={cx(
          'py-10 pl-8',
          client.no_show_count > 0
            ? 'text-danger'
            : client.attendance_rate === null
              ? 'text-text-muted'
              : 'text-success',
        )}
      >
        {formatAttendance(client)}
      </td>
    </tr>
  )
}

function ClientDetail({ id }: { id: string }) {
  const detail = useAdminClient(id)
  const save = useSaveClientNotes()
  const [draft, setDraft] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (detail.isPending) {
    return (
      <aside
        aria-label="Detalle del cliente"
        aria-busy="true"
        className="flex min-w-0 max-w-[380px] flex-[1_1_300px] flex-col gap-10 rounded-summary border border-gold-edge bg-surface p-20"
      >
        <span className="sr-only">Cargando el detalle…</span>
        <Skeleton className="h-[48px] w-full" />
        <Skeleton className="h-[120px] w-full" />
      </aside>
    )
  }
  if (detail.isError) {
    return (
      <aside
        aria-label="Detalle del cliente"
        className="min-w-0 max-w-[380px] flex-[1_1_300px] rounded-summary border border-gold-edge bg-surface p-20"
      >
        <RetryNotice onRetry={() => void detail.refetch()} loading={detail.isFetching}>
          No pudimos cargar el detalle. {NETWORK_MESSAGE}
        </RetryNotice>
      </aside>
    )
  }

  const c = detail.data
  const notes = draft ?? c.notes ?? ''
  const today = bogotaDay(new Date())

  async function submit() {
    setError(null)
    setSaved(false)
    try {
      await save.mutateAsync({ id, notes })
      setDraft(null)
      setSaved(true)
    } catch (e) {
      setError(e instanceof ApiError && e.status < 500 ? e.message : NETWORK_MESSAGE)
    }
  }

  return (
    <aside
      aria-label="Detalle del cliente"
      className="flex min-w-0 max-w-[380px] flex-[1_1_300px] flex-col gap-14 rounded-summary border border-gold-edge bg-surface p-20"
    >
      <div className="flex items-center gap-14">
        <span
          aria-hidden="true"
          className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-round bg-surface-muted text-body-strong text-gold"
        >
          {initials(c.name)}
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 className="m-0 font-display text-h2 text-text">{c.name}</h2>
          <span className="text-caption text-text-muted">{formatSince(c.since)}</span>
        </div>
      </div>

      {c.phone ? (
        <>
          <p className="m-0 text-small text-text">
            <span className="text-text-muted">Celular: </span>
            {formatFullPhone(c.phone)}
          </p>
          <Button
            variant="secondary"
            size="md"
            icon={<WhatsappIcon size={18} />}
            href={clientWhatsappUrl(c.phone, c.name)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Escribir por WhatsApp a ${c.name} (se abre en otra pestaña)`}
          >
            Escribir por WhatsApp
          </Button>
        </>
      ) : (
        <p className="m-0 text-small text-text-muted">Este cliente no dejó celular.</p>
      )}

      <dl className="m-0 grid grid-cols-3 gap-10 text-small">
        <div>
          <dt className="text-caption text-text-muted">Visitas</dt>
          <dd className="m-0 text-body-strong text-text">{c.visits}</dd>
        </div>
        <div>
          <dt className="text-caption text-text-muted">Inasistencias</dt>
          <dd className="m-0 text-body-strong text-text">{c.no_show_count}</dd>
        </div>
        <div>
          <dt className="text-caption text-text-muted">Favorito</dt>
          <dd className="m-0 text-small text-text">{c.favorite_service ?? '—'}</dd>
        </div>
      </dl>

      <section aria-label="Últimas visitas" className="flex flex-col gap-8">
        <h3 className="m-0 text-small font-semibold text-text">Últimas visitas</h3>
        {c.recent_appointments.length === 0 ? (
          <p className="m-0 text-caption text-text-muted">Todavía no tiene citas.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-8 p-0">
            {c.recent_appointments.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-10 text-small">
                <span className="flex min-w-0 flex-col">
                  <span className="text-text">{a.service_name}</span>
                  <span className="text-caption text-text-muted">
                    {formatDayLong(a.starts_at)}
                    {bogotaDay(a.starts_at) === today ? ' · hoy' : ''} · {formatTime(a.starts_at)} ·{' '}
                    {a.barber_name}
                  </span>
                  <StatusBadge status={a.status} />
                </span>
                <span className="shrink-0 text-text-muted">{formatCOP(a.price_cop)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-[6px] font-body">
        <label htmlFor="cl-notas" className="text-label text-text-muted">
          Notas del barbero
        </label>
        <textarea
          id="cl-notas"
          value={notes}
          maxLength={MAX_NOTES}
          rows={3}
          aria-describedby="cl-notas-ayuda"
          onChange={(e) => {
            setDraft(e.target.value)
            setSaved(false)
          }}
          className={cx(
            'box-border w-full resize-y rounded-field border border-line-strong bg-bg p-14 text-button text-text',
            FOCUS_RING,
          )}
        />
        <p id="cl-notas-ayuda" className="m-0 text-caption text-text-muted">
          {notes.length} de {MAX_NOTES} caracteres.
        </p>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {saved && <Notice tone="success">Notas guardadas.</Notice>}
      <Button
        block
        loading={save.isPending}
        disabled={draft === null}
        onClick={() => void submit()}
      >
        Guardar notas
      </Button>
    </aside>
  )
}
