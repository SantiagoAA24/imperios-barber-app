import { bogotaDay, formatDayLong, formatTime } from '../../lib/format'

/**
 * Enlace `wa.me` con el mensaje prellenado. `phoneE164` viene del API ("+573001234567") y solo
 * existe en la agenda propia del barbero; `today` (AAAA-MM-DD) solo decide si se dice "hoy".
 */
export function whatsappUrl(
  phoneE164: string,
  clientName: string,
  startsAt: string,
  today: string,
): string {
  const number = phoneE164.replace(/\D/g, '')
  const first = clientName.trim().split(/\s+/)[0] ?? ''
  const when =
    bogotaDay(startsAt) === today
      ? `hoy a las ${formatTime(startsAt)}`
      : `el ${formatDayLong(startsAt)} a las ${formatTime(startsAt)}`
  const text = `Hola ${first}, te escribo de Imperio Barber por tu cita ${when}.`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}
