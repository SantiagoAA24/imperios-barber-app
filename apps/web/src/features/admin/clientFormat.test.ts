import { describe, expect, it } from 'vitest'
import {
  clientWhatsappUrl,
  formatAttendance,
  formatFullPhone,
  formatRate,
  formatSince,
  initials,
} from './clientFormat'

describe('clientFormat', () => {
  it('asistencia con faltas', () => {
    expect(formatRate(1)).toBe('100%')
    expect(formatRate(0.8333)).toBe('83%')
    expect(formatRate(null)).toBe('Sin datos')
    expect(formatAttendance({ attendance_rate: 0.75, no_show_count: 1 })).toBe('75% · 1 falta')
    expect(formatAttendance({ attendance_rate: 0.67, no_show_count: 2 })).toBe('67% · 2 faltas')
    expect(formatAttendance({ attendance_rate: 1, no_show_count: 0 })).toBe('100%')
  })
  it('iniciales, desde y celular completo', () => {
    expect(initials('Carlos Martínez')).toBe('CM')
    expect(initials('Ana')).toBe('A')
    expect(formatSince('2026-03-12T15:00:00Z')).toBe('Cliente desde marzo de 2026')
    expect(formatFullPhone('+573004824821')).toBe('300 482 4821')
  })
  it('enlace de WhatsApp con el número solo en dígitos', () => {
    const url = clientWhatsappUrl('+573004824821', 'Carlos Martínez')
    expect(url.startsWith('https://wa.me/573004824821?text=')).toBe(true)
    expect(decodeURIComponent(url)).toContain('Hola Carlos')
  })
})
