import { describe, expect, it } from 'vitest'
import { canRemind, reminderMessage, reminderUrl, whatsappUrl } from './whatsapp'

describe('whatsappUrl', () => {
  it('usa solo dígitos del número y el primer nombre', () => {
    const url = new URL(
      whatsappUrl('+573001234567', 'Carlos Gómez', '2026-11-13T11:00:00-05:00', '2026-11-13'),
    )
    expect(url.origin + url.pathname).toBe('https://wa.me/573001234567')
    expect(url.searchParams.get('text')).toBe(
      'Hola Carlos, te escribo de Imperio Barber por tu cita hoy a las 11:00 am.',
    )
  })

  it('nombra el día cuando la cita no es hoy', () => {
    const url = new URL(
      whatsappUrl('+573001234567', 'Ana', '2026-11-14T15:30:00-05:00', '2026-11-13'),
    )
    expect(url.searchParams.get('text')).toBe(
      'Hola Ana, te escribo de Imperio Barber por tu cita el sábado 14 nov a las 3:30 pm.',
    )
  })

  it('codifica el mensaje para la URL', () => {
    expect(
      whatsappUrl('+573001234567', 'Ana', '2026-11-13T11:00:00-05:00', '2026-11-13'),
    ).toContain('text=Hola%20Ana%2C')
  })
})

const INPUT = {
  clientName: 'Carlos Andrés Gómez',
  serviceName: 'Corte + barba',
  startsAt: '2026-11-14T15:30:00-05:00',
  toleranceMin: 5,
}

describe('reminderMessage', () => {
  it('redacta el recordatorio exacto, con el primer nombre y sin enlace de gestión', () => {
    const text = reminderMessage(INPUT)
    expect(text).toBe(
      'Hola Carlos, te recordamos tu cita en Imperio Barber: Corte + barba, sábado 14 nov a las 3:30 pm. ' +
        'Te esperamos; tenemos 5 minutos de tolerancia. Si no puedes venir, respóndenos por aquí.',
    )
    expect(text).not.toMatch(/https?:|\/cita\//)
  })

  it('usa la tolerancia del negocio y recorta espacios del nombre', () => {
    expect(reminderMessage({ ...INPUT, clientName: '  Ana  ', toleranceMin: 10 })).toContain(
      'Hola Ana, te recordamos',
    )
    expect(reminderMessage({ ...INPUT, toleranceMin: 10 })).toContain('tenemos 10 minutos')
  })

  it('no deja "Hola ," si el nombre llega vacío', () => {
    expect(reminderMessage({ ...INPUT, clientName: '   ' }).startsWith('Hola, te recordamos')).toBe(
      true,
    )
  })
})

describe('reminderUrl', () => {
  it('apunta a wa.me con el número sin "+" y el texto codificado', () => {
    const url = reminderUrl('+573001234567', INPUT)
    expect(url).not.toBeNull()
    const parsed = new URL(url ?? '')
    expect(parsed.origin + parsed.pathname).toBe('https://wa.me/573001234567')
    expect(parsed.searchParams.get('text')).toBe(reminderMessage(INPUT))
    // Codificado: ni espacios ni saltos ni tildes sueltas en la URL.
    expect(url).toMatch(/^https:\/\/wa\.me\/573001234567\?text=Hola%20Carlos%2C%20te%20recordamos/)
    expect(url).not.toMatch(/\s|á|ó/)
  })

  it('no hay enlace sin celular', () => {
    expect(reminderUrl(null, INPUT)).toBeNull()
    expect(reminderUrl('', INPUT)).toBeNull()
  })
})

describe('canRemind', () => {
  const now = new Date('2026-11-13T15:00:00-05:00')
  const appt = (over: Record<string, unknown> = {}) => ({
    status: 'booked',
    starts_at: '2026-11-14T09:00:00-05:00',
    client: { phone_e164: '+573001234567' },
    ...over,
  })

  it('solo citas pendientes con celular que empiezan en las próximas 24 horas', () => {
    expect(canRemind(appt(), now)).toBe(true)
    expect(canRemind(appt({ starts_at: '2026-11-14T15:00:00-05:00' }), now)).toBe(true) // justo 24 h
    expect(canRemind(appt({ starts_at: '2026-11-14T15:01:00-05:00' }), now)).toBe(false)
    expect(canRemind(appt({ starts_at: '2026-11-13T14:59:00-05:00' }), now)).toBe(false) // ya empezó
    expect(canRemind(appt({ status: 'attended' }), now)).toBe(false)
    expect(canRemind(appt({ status: 'cancelled' }), now)).toBe(false)
    expect(canRemind(appt({ client: { phone_e164: null } }), now)).toBe(false)
  })
})
