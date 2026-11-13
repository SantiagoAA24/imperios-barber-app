import { Link } from 'react-router-dom'
import { Notice } from '../../components/Notice'
import type { Conflict } from '../../lib/api/types'
import { bogotaDay, formatDayLong, formatTime } from '../../lib/format'

/**
 * Citas que quedaron fuera del horario o dentro de una ausencia. El servidor NO las cancela:
 * aquí se dice con claridad y cada una lleva a su cita para que el barbero decida.
 */
export function ConflictList({ conflicts, title }: { conflicts: Conflict[]; title: string }) {
  if (conflicts.length === 0) return null
  return (
    <div className="flex flex-col gap-10 rounded-card border border-line-strong bg-surface p-14">
      <Notice tone="danger">
        <strong className="font-semibold">{title}</strong> No se cancelaron: siguen reservadas hasta
        que tú las muevas o canceles.
      </Notice>
      <ul className="m-0 flex list-none flex-col gap-8 p-0">
        {conflicts.map((c) => (
          <li
            key={c.appointment_id}
            className="flex items-center justify-between gap-10 text-small text-text"
          >
            <span className="min-w-0">
              <span className="font-semibold">{c.client_name}</span> · {formatDayLong(c.starts_at)}{' '}
              · {formatTime(c.starts_at)}
            </span>
            <Link
              to={`/barbero?fecha=${bogotaDay(c.starts_at)}&cita=${c.appointment_id}`}
              aria-label={`Ver la cita de ${c.client_name}, ${formatDayLong(c.starts_at)} ${formatTime(c.starts_at)}`}
              className="box-border flex min-h-touch shrink-0 items-center px-8 text-small font-semibold text-gold underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Ver cita
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
