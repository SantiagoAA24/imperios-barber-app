import { formatCOP } from '../../lib/format'
import { cx } from '../classes'

export type AppointmentCardProps = {
  /** Fecha ya formateada, p. ej. "viernes 13 nov". */
  date: string
  /** Hora ya formateada, p. ej. "11:00 am". */
  time: string
  service: string
  barber: string
  /** Duración ya formateada, p. ej. "~45 min". */
  duration: string
  totalCop: number
  /** Cita cancelada o ya pasada: el total y la hora pierden el dorado. */
  muted?: boolean
  className?: string
}

/** Resumen de una cita ya creada (cita-confirmada.dc.html): fecha, hora grande y filas de detalle. */
export function AppointmentCard({
  date,
  time,
  service,
  barber,
  duration,
  totalCop,
  muted = false,
  className,
}: AppointmentCardProps) {
  const rows: Array<[string, string]> = [
    ['Servicio', service],
    ['Barbero', barber],
    ['Duración', duration],
  ]
  return (
    <section
      aria-label="Resumen de tu cita"
      className={cx(
        'box-border flex flex-col gap-14 rounded-summary border border-gold-edge bg-surface px-20 py-[22px] font-body',
        className,
      )}
    >
      <div className="flex items-end justify-between gap-[12px]">
        <div className="flex flex-col gap-[2px]">
          <span className="text-label text-text-muted">Fecha</span>
          <span className={cx('text-body-strong', muted && 'line-through')}>{date}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-label text-text-muted">Hora</span>
          <span
            className={cx(
              'font-display text-[44px] leading-[44px] font-bold',
              muted ? 'text-text-muted line-through' : 'text-gold',
            )}
          >
            {time}
          </span>
        </div>
      </div>
      <div role="separator" className="h-[1px] bg-line" />
      <dl className="m-0 flex flex-col gap-14">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-[12px] text-small">
            <dt className="text-text-muted">{label}</dt>
            <dd className="m-0 text-right font-semibold text-text">{value}</dd>
          </div>
        ))}
      </dl>
      <div role="separator" className="border-t border-dashed border-line-strong" />
      <div className="flex items-baseline justify-between gap-[12px] text-small text-text-muted">
        <span>Total (se paga en el local)</span>
        <span className={cx('font-display text-total', muted ? 'text-text-muted' : 'text-gold')}>
          {formatCOP(totalCop)}
        </span>
      </div>
    </section>
  )
}
