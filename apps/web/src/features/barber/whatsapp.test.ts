import { describe, expect, it } from 'vitest'
import { whatsappUrl } from './whatsapp'

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
