import { useId } from 'react'
import type { ReactNode } from 'react'
import { formatCOP } from '../../lib/format'
import { cx } from '../classes'

export type SummaryCardProps = {
  /**
   * `card`: tarjeta completa con una fila por dato (en el flujo de la página).
   * `bar`: barra compacta fija abajo, "Servicio · fecha · hora" en una línea más el total.
   */
  variant?: 'card' | 'bar'
  title?: string
  service: string
  barber: string
  /** Fecha y hora ya formateadas; `null` mientras no haya hora elegida. */
  dateTime: string | null
  /** Duración ya formateada, p. ej. "~45 min". */
  duration: string
  /** `null` mientras no haya servicio elegido: se muestra un guion. */
  totalCop: number | null
  /** Botón principal, aviso de puntualidad, mensaje de éxito… */
  children?: ReactNode
  className?: string
}

export function SummaryCard({
  variant = 'card',
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
  if (variant === 'bar') {
    return (
      <section
        aria-label={title}
        className={cx(
          'fixed right-[0px] bottom-[0px] left-[0px] z-10 mx-auto box-border flex w-full max-w-[480px] flex-col gap-10 rounded-t-summary border border-b-0 border-gold-edge bg-surface px-20 pt-14 pb-[max(var(--space-14),env(safe-area-inset-bottom))] font-body',
          className,
        )}
      >
        <div className="flex items-baseline justify-between gap-[12px]">
          <p className="m-0 min-w-0 text-small font-semibold text-text">
            {service} · {dateTime ?? 'Elige una hora'}
          </p>
          <p className="m-0 flex shrink-0 flex-col items-end">
            <span className="text-overline text-text-muted">Total (se paga en el local)</span>
            <span className="font-display text-price text-gold">
              {totalCop === null ? '—' : formatCOP(totalCop)}
            </span>
          </p>
        </div>
        {children}
      </section>
    )
  }
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
        <span className="font-display text-total text-gold">
          {totalCop === null ? '—' : formatCOP(totalCop)}
        </span>
      </div>
      {children}
    </section>
  )
}
