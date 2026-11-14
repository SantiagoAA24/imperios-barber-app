import type { AdminClientListItem } from '../../lib/api/types'

/** 0.8333 -> '83%'; nulo -> 'Sin datos'. */
export function formatRate(rate: number | null): string {
  return rate === null ? 'Sin datos' : `${Math.round(rate * 100)}%`
}

/** '83% · 1 falta', '67% · 2 faltas', '100%'. */
export function formatAttendance(
  item: Pick<AdminClientListItem, 'attendance_rate' | 'no_show_count'>,
): string {
  const rate = formatRate(item.attendance_rate)
  if (item.no_show_count === 0) return rate
  return `${rate} · ${item.no_show_count} ${item.no_show_count === 1 ? 'falta' : 'faltas'}`
}

/** 'Carlos Martínez' -> 'CM'. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
}

const sinceFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  month: 'long',
  year: 'numeric',
})

/** '2026-03-12T...' -> 'Cliente desde marzo de 2026'. */
export function formatSince(iso: string): string {
  return `Cliente desde ${sinceFormat.format(new Date(iso))}`
}

/** '+573004824821' -> '300 482 4821' (se muestra completo solo en el detalle). */
export function formatFullPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '').replace(/^57/, '')
  return digits.length === 10
    ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
    : e164
}

/** 'https://wa.me/573004824821?text=...' */
export function clientWhatsappUrl(e164: string, name: string): string {
  const number = e164.replace(/\D/g, '')
  const first = name.trim().split(/\s+/)[0] ?? ''
  return `https://wa.me/${number}?text=${encodeURIComponent(`Hola ${first}, te escribo de Imperio Barber.`)}`
}
