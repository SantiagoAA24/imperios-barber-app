import { formatCOP } from '../../lib/format'
import type { PublicAppointment } from '../../lib/api/types'

export const ICS_FILENAME = 'imperio-cita.ics'
const CRLF = '\r\n'

/** 20261113T160000Z: el instante en UTC, sin separadores (RFC 5545). */
export function icsUtc(value: string | Date): string {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

/** Escapa barra, punto y coma, coma y saltos de línea en un valor de texto. */
export function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Pliega líneas a 75 octetos como pide el RFC 5545 (continuación con un espacio). */
export function icsFold(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const chunks: string[] = []
  let current = ''
  let size = 0
  // La primera línea admite 75 octetos; las de continuación, 74 (el espacio inicial cuenta).
  let limit = 75
  for (const char of line) {
    const bytes = encoder.encode(char).length
    if (size + bytes > limit) {
      chunks.push(current)
      current = ''
      size = 0
      limit = 74
    }
    current += char
    size += bytes
  }
  chunks.push(current)
  return chunks.join(`${CRLF} `)
}

export type IcsEvent = {
  uid: string
  start: string | Date
  end: string | Date
  summary: string
  description: string
  /** Momento de creación del archivo; por defecto, ahora. */
  stamp?: Date
}

/** Un VCALENDAR 2.0 con un único VEVENT, con fechas en UTC y saltos de línea CRLF. */
export function buildIcs({ uid, start, end, summary, description, stamp = new Date() }: IcsEvent) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Imperio Barber//Cita//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsEscape(uid)}`,
    `DTSTAMP:${icsUtc(stamp)}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(icsFold).join(CRLF) + CRLF
}

/** El archivo .ics de una cita: servicio y precio en la descripción. */
export function appointmentIcs(appointment: PublicAppointment, stamp?: Date): string {
  return buildIcs({
    // El id de la cita es único y estable: reprogramar actualiza el mismo evento en el calendario.
    uid: `${appointment.id}@imperio-barber`,
    start: appointment.starts_at,
    end: appointment.ends_at,
    summary: 'Cita en Imperio Barber',
    description: `${appointment.service.name} · ${formatCOP(appointment.service.price_cop)} (se paga en el local)`,
    stamp,
  })
}

/** Descarga el texto como archivo en el navegador, sin pasar por el servidor. */
export function downloadIcs(content: string, filename = ICS_FILENAME): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
