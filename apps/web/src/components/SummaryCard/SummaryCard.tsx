import { useId } from 'react'
import type { ReactNode } from 'react'
import { formatCOP } from '../../lib/format'
import { cx } from '../classes'

export type SummaryCardProps = {
  title?: string
  service: string
  barber: string
  /** Fecha y hora ya formateadas; `null` mientras no haya hora elegida. */
  dateTime: string | null
  /** Duración ya formateada, p. ej. "~45 min". */
  duration: string
  totalCop: number
  /** Botón principal, aviso de puntualidad, mensaje de éxito… */
  children?: ReactNode
  className?: string
}

export function SummaryCard({
  title = 'Resumen',
  service,
  barber,
  dateTime,
  duration,
  totalCop,
  children,
  className,
}: SummaryCardProps) {
  const headingId = useId()
  const rows: Array<[string, string]> = [
    ['Servicio', service],
    ['Barbero', barber],
    ['Fecha y hora', dateTime ?? 'Elige una hora'],
    ['Duración', duration],
  ]
  return (
    <section
      aria-labelledby={headingId}
      className={cx(
        'box-border flex flex-col gap-14 rounded-summary border border-gold-edge bg-surface px-20 py-[22px] font-body',
        className,
      )}
    >
      <h2 id={headingId} className="m-0 font-display text-h2 text-text">
        {title}
      </h2>
      <dl className="m-0 flex flex-col gap-14">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-[12px] text-small">
            <dt className="text-text-muted">{label}</dt>
            <dd className="m-0 text-right font-semibold text-text">{value}</dd>
          </div>
        ))}
      </dl>
      <div role="separator" className="h-[1px] bg-line" />
      <div className="flex items-baseline justify-between gap-[12px] text-small text-text-muted">
        <span>Total (se paga en el local)</span>
        <span className="font-display text-total text-gold">{formatCOP(totalCop)}</span>
      </div>
      {children}
    </section>
  )
}
