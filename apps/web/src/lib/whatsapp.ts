import { bogotaDay, formatDayLong, formatTime } from './format'

/** Primer nombre de "Carlos Andrés Gómez" -> "Carlos". */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}

/** Solo los dígitos del celular E.164 ("+573001234567" -> "573001234567"); null si no hay. */
function waNumber(phoneE164: string | null | undefined): string | null {
  const digits = (phoneE164 ?? '').replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

function link(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

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
  const first = firstName(clientName)
  const when =
    bogotaDay(startsAt) === today
      ? `hoy a las ${formatTime(startsAt)}`
      : `el ${formatDayLong(startsAt)} a las ${formatTime(startsAt)}`
  return link(
    waNumber(phoneE164) ?? '',
    `Hola ${first}, te escribo de Imperio Barber por tu cita ${when}.`,
  )
}

export type ReminderInput = {
  clientName: string
  serviceName: string
  /** Instante ISO de inicio de la cita. */
  startsAt: string
  toleranceMin: number
}

/**
 * Texto del recordatorio. Sin enlace de gestión a propósito: el token de la cita solo existe en
 * claro en el momento de reservar (en la base solo queda su hash).
 */
export function reminderMessage({
  clientName,
  serviceName,
  startsAt,
  toleranceMin,
}: ReminderInput): string {
  const name = firstName(clientName)
  return (
    `Hola${name ? ` ${name}` : ''}, te recordamos tu cita en Imperio Barber: ` +
    `${serviceName}, ${formatDayLong(startsAt)} a las ${formatTime(startsAt)}. ` +
    `Te esperamos; tenemos ${toleranceMin} minutos de tolerancia. ` +
    'Si no puedes venir, respóndenos por aquí.'
  )
}

/** https://wa.me/57XXXXXXXXXX?text=… con el recordatorio; null si la cita no tiene celular. */
export function reminderUrl(phoneE164: string | null | undefined, input: ReminderInput) {
  const number = waNumber(phoneE164)
  return number ? link(number, reminderMessage(input)) : null
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * ¿Se ofrece el botón "Recordar por WhatsApp"? Cita pendiente, con celular y que empieza dentro
 * de las próximas 24 horas (ni una que ya empezó, ni una de pasado mañana).
 */
export function canRemind(
  appointment: { status: string; starts_at: string; client: { phone_e164: string | null } },
  now: Date | number,
): boolean {
  if (appointment.status !== 'booked' || !appointment.client.phone_e164) return false
  const wait = new Date(appointment.starts_at).getTime() - new Date(now).getTime()
  return wait >= 0 && wait <= DAY_MS
}
