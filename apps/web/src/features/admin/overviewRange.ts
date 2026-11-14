import type { RevenueDay } from '../../lib/api/types'
import { addDays, dayOfMonth, formatWeekdayShort } from '../../lib/format'

export const MAX_RANGE_DAYS = 366

export type RangeMode = 'week' | 'month' | 'custom'

const monthFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  month: 'long',
  year: 'numeric',
})

/** Primer y último día del mes de `today` (AAAA-MM-DD). */
export function monthRange(today: string): { from: string; to: string } {
  const from = `${today.slice(0, 8)}01`
  const next = addDays(from, 32).slice(0, 8) + '01'
  return { from, to: addDays(next, -1) }
}

/** Días del rango, ambos inclusive. */
export function daysInRange(from: string, to: string): number {
  const ms =
    new Date(`${to}T12:00:00-05:00`).getTime() - new Date(`${from}T12:00:00-05:00`).getTime()
  return Math.round(ms / 86_400_000) + 1
}

/** Mensaje de error si el rango personalizado no es válido; `null` si lo es. */
export function validateCustomRange(from: string, to: string): string | null {
  if (!from || !to) return 'Elige la fecha inicial y la final.'
  if (to < from) return 'La fecha final no puede ser anterior a la inicial.'
  if (daysInRange(from, to) > MAX_RANGE_DAYS) return `El rango máximo es de ${MAX_RANGE_DAYS} días.`
  return null
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const longDay = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'long',
})

/** Título del periodo que se ve: 'Semana del 9 al 15 de noviembre', 'Noviembre de 2026'. */
export function periodTitle(mode: RangeMode, from: string, to: string): string {
  const a = new Date(`${from}T12:00:00-05:00`)
  const b = new Date(`${to}T12:00:00-05:00`)
  if (mode === 'month') return cap(monthFormat.format(a))
  const sameMonth = longDay.format(a).split(' ').at(-1) === longDay.format(b).split(' ').at(-1)
  const range = sameMonth
    ? `${dayOfMonth(from)} al ${longDay.format(b)}`
    : `${longDay.format(a)} al ${longDay.format(b)}`
  return mode === 'week' ? `Semana del ${range}` : `Del ${range}`
}

const weekdayLong = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  weekday: 'long',
})

/** Día con más ingresos (el primero si hay empate); `null` si no hubo ingresos. */
export function peakDay(days: RevenueDay[]): { date: string; label: string } | null {
  let best: RevenueDay | null = null
  for (const d of days)
    if (d.revenue_cop > 0 && (!best || d.revenue_cop > best.revenue_cop)) best = d
  return best
    ? { date: best.date, label: weekdayLong.format(new Date(`${best.date}T12:00:00-05:00`)) }
    : null
}

/** Rótulo bajo cada barra: 'Lun' en la semana, el número del día (cada tanto) en rangos largos. */
export function barLabel(days: RevenueDay[], index: number): string {
  const day = days[index]
  if (!day) return ''
  if (days.length <= 7) return formatWeekdayShort(day.date)
  const step = Math.ceil(days.length / 10)
  return index % step === 0 ? String(dayOfMonth(day.date)) : ''
}
