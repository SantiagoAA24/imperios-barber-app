import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PublicAppointment } from '../../lib/api/types'
import {
  appointmentIcs,
  buildIcs,
  downloadIcs,
  ICS_FILENAME,
  icsEscape,
  icsFold,
  icsUtc,
} from './ics'

const appointment: PublicAppointment = {
  id: '3f2b8a52-0000-4000-8000-0000000000aa',
  status: 'booked',
  // 11:00 am en Bogotá (UTC-5) = 16:00 UTC.
  starts_at: '2026-11-13T11:00:00-05:00',
  ends_at: '2026-11-13T11:45:00-05:00',
  service: {
    id: '3f2b8a52-0000-4000-8000-0000000000bb',
    name: 'Corte + barba',
    price_cop: 27000,
    duration_min: 45,
  },
  barber: { id: '3f2b8a52-0000-4000-8000-0000000000cc', display_name: 'Barbero 1' },
  client: { first_name: 'Juan' },
  business: { name: 'Imperio Barber' },
  can_cancel: true,
  can_reschedule: true,
}
const stamp = new Date('2026-11-12T20:00:00Z')

describe('formato iCalendar', () => {
  it('icsUtc escribe el instante en UTC con Z y sin separadores', () => {
    expect(icsUtc('2026-11-13T11:00:00-05:00')).toBe('20261113T160000Z')
    expect(icsUtc(new Date('2026-12-31T23:59:59.999Z'))).toBe('20261231T235959Z')
  })

  it('icsEscape escapa barra, punto y coma, coma y saltos de línea', () => {
    expect(icsEscape('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne')
  })

  it('icsFold deja intactas las líneas cortas y pliega las largas a 75 octetos', () => {
    expect(icsFold('SUMMARY:corta')).toBe('SUMMARY:corta')
    const folded = icsFold(`DESCRIPTION:${'á'.repeat(100)}`)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true)
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(
      `DESCRIPTION:${'á'.repeat(100)}`,
    )
  })

  it('buildIcs produce un VCALENDAR 2.0 con un VEVENT y saltos CRLF', () => {
    const text = buildIcs({
      uid: 'x@y',
      start: '2026-11-13T16:00:00Z',
      end: '2026-11-13T16:45:00Z',
      summary: 'S',
      description: 'D',
      stamp,
    })
    expect(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(text.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true)
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(text).not.toMatch(/[^\r]\n/)
  })
})

describe('appointmentIcs', () => {
  const text = appointmentIcs(appointment, stamp)

  it('lleva UID, DTSTART y DTEND en UTC', () => {
    expect(text).toContain('UID:3f2b8a52-0000-4000-8000-0000000000aa@imperio-barber')
    expect(text).toContain('DTSTAMP:20261112T200000Z')
    expect(text).toContain('DTSTART:20261113T160000Z')
    expect(text).toContain('DTEND:20261113T164500Z')
  })

  it('SUMMARY fijo y DESCRIPTION con servicio y precio', () => {
    expect(text).toContain('SUMMARY:Cita en Imperio Barber')
    expect(text).toContain('DESCRIPTION:Corte + barba · $27.000 (se paga en el local)')
  })

  it('no incluye datos personales del cliente', () => {
    expect(text).not.toContain('Juan')
    expect(text).not.toMatch(/\+57|ATTENDEE/)
  })

  it('el UID cambia entre citas distintas', () => {
    const other = appointmentIcs(
      { ...appointment, id: '3f2b8a52-0000-4000-8000-0000000000dd' },
      stamp,
    )
    expect(other.match(/UID:.*/)?.[0]).not.toBe(text.match(/UID:.*/)?.[0])
  })
})

describe('downloadIcs', () => {
  afterEach(() => vi.restoreAllMocks())

  it('descarga un archivo imperio-cita.ics con tipo text/calendar', () => {
    const create = vi.fn(() => 'blob:prueba')
    const revoke = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
    let download = ''
    let href = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      download = this.download
      href = this.href
    })
    downloadIcs('BEGIN:VCALENDAR\r\n')
    expect(download).toBe(ICS_FILENAME)
    expect(ICS_FILENAME).toBe('imperio-cita.ics')
    expect(href).toBe('blob:prueba')
    const blob = (create.mock.calls[0] as unknown as [Blob])[0]
    expect(blob.type).toContain('text/calendar')
    vi.unstubAllGlobals()
  })
})
