// Único lugar donde se formatean precios, horas, fechas y duraciones.
// Zona del negocio: America/Bogota, sin importar la zona del navegador.

const ZONE = 'America/Bogota'
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Acepta un instante ISO (UTC) o una fecha de calendario "AAAA-MM-DD" (día del negocio). */
function toDate(value: string | Date): Date {
  if (value instanceof Date) return value
  // Bogotá es UTC-5 todo el año. A mediodía el día de calendario no cambia en ninguna zona.
  return new Date(DATE_ONLY.test(value) ? `${value}T12:00:00-05:00` : value)
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? ''
}

/** formatCOP(22000) -> '$22.000' */
export function formatCOP(pesos: number): string {
  const whole = Math.round(Math.abs(pesos))
  // Se agrupa a mano: es-CO no agrupa los miles de 4 cifras en todos los ICU.
  const digits = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${pesos < 0 ? '-' : ''}$${digits}`
}

const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/** formatTime('2026-11-13T15:30:00Z') -> '10:30 am' */
export function formatTime(iso: string | Date): string {
  const parts = timeFormat.formatToParts(toDate(iso))
  const period = part(parts, 'dayPeriod').toLowerCase().replace(/\./g, '')
  return `${part(parts, 'hour')}:${part(parts, 'minute')} ${period}`
}

const dayFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'short',
})

/** formatDayLong('2026-11-13T15:30:00Z') -> 'viernes 13 nov' */
export function formatDayLong(iso: string | Date): string {
  const parts = dayFormat.formatToParts(toDate(iso))
  const month = part(parts, 'month').replace(/\./g, '')
  return `${part(parts, 'weekday')} ${part(parts, 'day')} ${month}`
}

/** formatDuration(45) -> '45 min'; formatDuration(60) -> '1 hora'; formatDuration(90) -> '1 h 30 min' */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return hours === 1 ? '1 hora' : `${hours} horas`
  return `${hours} h ${rest} min`
}

const isoDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** bogotaDay('2026-11-14T03:00:00Z') -> '2026-11-13' (el día de calendario en Bogotá). */
export function bogotaDay(value: string | Date): string {
  const parts = isoDayFormat.formatToParts(toDate(value))
  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`
}

/** addDays('2026-11-30', 1) -> '2026-12-01' */
export function addDays(day: string, days: number): string {
  return bogotaDay(new Date(toDate(day).getTime() + days * 86_400_000))
}

const weekdayShortFormat = new Intl.DateTimeFormat('es-CO', { timeZone: ZONE, weekday: 'short' })

/** formatWeekdayShort('2026-11-13') -> 'Vie' */
export function formatWeekdayShort(value: string | Date): string {
  const text = part(weekdayShortFormat.formatToParts(toDate(value)), 'weekday').replace(/\./g, '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** dayOfMonth('2026-11-13') -> 13 */
export function dayOfMonth(value: string | Date): number {
  return Number(bogotaDay(value).slice(8, 10))
}

const minutesFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** minutesOfDay('2026-11-13T15:30:00Z') -> 630 (10:30 am en Bogotá). */
export function minutesOfDay(iso: string | Date): number {
  const parts = minutesFormat.formatToParts(toDate(iso))
  return Number(part(parts, 'hour')) * 60 + Number(part(parts, 'minute'))
}

/** 'HH:MM' o 'HH:MM:SS' -> minutos desde la medianoche. */
export function parseClock(text: string): number {
  const [h = '0', m = '0'] = text.split(':')
  return Number(h) * 60 + Number(m)
}

/** formatClock(570) -> '9:30 am' (hora del negocio, sin fecha). */
export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const period = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}
