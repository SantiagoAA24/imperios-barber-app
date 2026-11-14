import type { RevenueDay } from '../../lib/api/types'
import { formatCOP } from '../../lib/format'
import { barLabel, peakDay } from './overviewRange'

const W = 640
const H = 220
const TOP = 26
const BOTTOM = 28
const SIDE = 8
const SHOW_VALUES_UP_TO = 10

/**
 * Barras de ingresos por día hechas con SVG propio (sin librerías). El gráfico es una imagen con
 * texto alternativo; la misma información va en una tabla visualmente oculta para lectores de
 * pantalla, con todos los días del rango, también los de cero.
 */
export function RevenueChart({ days }: { days: RevenueDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.revenue_cop))
  const slot = (W - SIDE * 2) / Math.max(days.length, 1)
  const barW = Math.max(2, slot * 0.58)
  const plot = H - TOP - BOTTOM
  const total = days.reduce((sum, d) => sum + d.revenue_cop, 0)
  const peak = peakDay(days)
  const alt = peak
    ? `Ingresos por día, ${days.length} días, total ${formatCOP(total)}. El día con más ingresos fue el ${peak.label} ${peak.date}.`
    : `Ingresos por día, ${days.length} días: sin ingresos en este periodo.`

  return (
    <div className="flex flex-col gap-10">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={alt}
        className="block h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <line
          x1={SIDE}
          x2={W - SIDE}
          y1={H - BOTTOM}
          y2={H - BOTTOM}
          className="stroke-line-strong"
          strokeWidth={1}
        />
        {days.map((d, i) => {
          const h = Math.round((d.revenue_cop / max) * plot)
          const x = SIDE + i * slot + (slot - barW) / 2
          const isPeak = peak?.date === d.date
          return (
            <g key={d.date}>
              {d.revenue_cop > 0 && (
                <rect
                  x={x}
                  y={H - BOTTOM - h}
                  width={barW}
                  height={h}
                  rx={3}
                  className={isPeak ? 'fill-gold' : 'fill-gold-edge'}
                />
              )}
              {days.length <= SHOW_VALUES_UP_TO && (
                <text
                  x={x + barW / 2}
                  y={H - BOTTOM - h - 6}
                  textAnchor="middle"
                  fontSize={11}
                  className="fill-text"
                >
                  {formatCOP(d.revenue_cop)}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={H - 8}
                textAnchor="middle"
                fontSize={12}
                className="fill-text-muted"
              >
                {barLabel(days, i)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="sr-only">
        <table>
          <caption>Ingresos y citas por día</caption>
          <thead>
            <tr>
              <th scope="col">Día</th>
              <th scope="col">Ingresos</th>
              <th scope="col">Citas</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <th scope="row">{d.date}</th>
                <td>{formatCOP(d.revenue_cop)}</td>
                <td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
