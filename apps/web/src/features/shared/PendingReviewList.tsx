import { useState } from 'react'
import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'
import { CheckIcon, CrossCircleIcon } from '../../components/icons'
import { isTransientError } from '../../lib/api/hooks'
import { formatDayLong, formatTime } from '../../lib/format'
import { NETWORK_MESSAGE } from './RetryNotice'

export type ReviewItem = {
  id: string
  starts_at: string
  clientName: string
  serviceName: string
  /** Solo en el admin: de quién es la cita. */
  barberName?: string
}

type Props = {
  items: ReviewItem[]
  busyIds: string[]
  errors: Record<string, string>
  onResolve: (id: string, status: 'attended' | 'no_show') => void
  /** id del encabezado, para enlazarlo desde la barra (y devolver el foco). */
  headingId: string
}

/**
 * «Citas por revisar»: pendientes que terminaron hace más de 2 horas. El sistema nunca las cierra
 * solo (la decide el barbero), así que aquí se marca cada una como atendida o no asistió.
 */
export function PendingReviewList({ items, busyIds, errors, onResolve, headingId }: Props) {
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-10 rounded-card border border-gold-edge bg-surface-selected p-14"
    >
      <h2
        id={headingId}
        tabIndex={-1}
        className="m-0 font-display text-h2 text-text outline-none focus-visible:outline-2 focus-visible:outline-gold"
      >
        Citas por revisar
      </h2>
      <p className="m-0 text-small text-text-muted">
        Terminaron hace más de 2 horas y siguen pendientes. Márcalas para que las cifras queden al
        día.
      </p>
      <ul className="m-0 flex list-none flex-col gap-10 p-0">
        {items.map((item) => {
          const busy = busyIds.includes(item.id)
          const titleId = `revisar-${item.id}`
          return (
            <li
              key={item.id}
              aria-labelledby={titleId}
              className="flex flex-col gap-8 rounded-card border border-line bg-surface p-14"
            >
              <div className="flex flex-col gap-4">
                <p id={titleId} className="m-0 text-body-strong text-text">
                  {item.clientName}
                </p>
                <p className="m-0 text-small text-text-muted">
                  {formatDayLong(item.starts_at)} · {formatTime(item.starts_at)} ·{' '}
                  {item.serviceName}
                  {item.barberName ? ` · ${item.barberName}` : ''}
                </p>
              </div>
              {errors[item.id] && <Notice tone="danger">{errors[item.id]}</Notice>}
              <div className="flex flex-wrap gap-10">
                <Button
                  size="md"
                  icon={<CheckIcon size={18} />}
                  loading={busy}
                  className="min-w-[132px] flex-1"
                  aria-label={`Atendida: ${item.clientName}, ${formatDayLong(item.starts_at)} ${formatTime(item.starts_at)}`}
                  onClick={() => onResolve(item.id, 'attended')}
                >
                  Atendida
                </Button>
                <Button
                  size="md"
                  variant="secondary"
                  icon={<CrossCircleIcon size={18} />}
                  disabled={busy}
                  className="min-w-[132px] flex-1"
                  aria-label={`No asistió: ${item.clientName}, ${formatDayLong(item.starts_at)} ${formatTime(item.starts_at)}`}
                  onClick={() => onResolve(item.id, 'no_show')}
                >
                  No asistió
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

type Section = {
  items: ReviewItem[]
  headingId: string
  /** Guarda el estado; debe rechazar la promesa si el servidor responde con error. */
  resolve: (id: string, status: 'attended' | 'no_show') => Promise<unknown>
}

/** Lista + estado de cada botón, mensaje para lectores de pantalla y foco tras marcar. */
export function PendingReviewSection({ items, headingId, resolve }: Section) {
  const [busyIds, setBusyIds] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [announcement, setAnnouncement] = useState('')

  async function onResolve(id: string, status: 'attended' | 'no_show') {
    const name = items.find((i) => i.id === id)?.clientName ?? 'La cita'
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id)))
    setBusyIds((prev) => [...prev, id])
    try {
      await resolve(id, status)
      setAnnouncement(
        `Cita de ${name} marcada como ${status === 'attended' ? 'atendida' : 'no asistió'}.`,
      )
      // La fila desaparece: el foco no puede quedarse en un botón que ya no existe.
      window.requestAnimationFrame(() => {
        const target =
          document.getElementById(headingId) ?? document.querySelector<HTMLElement>('main h1')
        if (target && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
        target?.focus()
      })
    } catch (error) {
      const message = isTransientError(error)
        ? `No pudimos guardar el cambio. ${NETWORK_MESSAGE}`
        : (error as Error).message
      setErrors((prev) => ({ ...prev, [id]: message }))
    } finally {
      setBusyIds((prev) => prev.filter((x) => x !== id))
    }
  }

  return (
    <>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {items.length > 0 && (
        <PendingReviewList
          items={items}
          busyIds={busyIds}
          errors={errors}
          headingId={headingId}
          onResolve={(id, status) => void onResolve(id, status)}
        />
      )}
    </>
  )
}
