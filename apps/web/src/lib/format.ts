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
