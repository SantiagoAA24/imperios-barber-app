import { afterEach, describe, expect, it } from 'vitest'
import { formatCOP, formatDayLong, formatDuration, formatTime } from './format'

declare const process: { env: Record<string, string | undefined> }

const originalTz = process.env.TZ
afterEach(() => {
  process.env.TZ = originalTz
})

describe('formatCOP', () => {
  it('usa punto de miles y sin decimales', () => {
    expect(formatCOP(22000)).toBe('$22.000')
    expect(formatCOP(1250000)).toBe('$1.250.000')
    expect(formatCOP(900)).toBe('$900')
    expect(formatCOP(0)).toBe('$0')
  })
})

describe('formatTime', () => {
  it('da la hora de Bogotá en 12 h, minúscula y sin puntos', () => {
    expect(formatTime('2026-11-13T15:30:00Z')).toBe('10:30 am')
    expect(formatTime('2026-11-13T20:00:00Z')).toBe('3:00 pm')
    expect(formatTime('2026-11-13T17:00:00Z')).toBe('12:00 pm')
    expect(formatTime('2026-11-13T05:00:00Z')).toBe('12:00 am')
  })

  it('no depende de la zona del navegador', () => {
    for (const tz of ['Asia/Tokyo', 'Pacific/Auckland', 'America/Los_Angeles']) {
      process.env.TZ = tz
      expect(formatTime('2026-11-13T15:30:00Z')).toBe('10:30 am')
    }
  })
})

describe('formatDayLong', () => {
  it('escribe el día en español sin punto en el mes', () => {
    expect(formatDayLong('2026-11-13T15:30:00Z')).toBe('viernes 13 nov')
    expect(formatDayLong('2026-09-05T15:00:00Z')).toBe('sábado 5 sept')
  })

  it('usa el día de Bogotá aunque el navegador esté en otra zona', () => {
    process.env.TZ = 'Asia/Tokyo'
    // 03:00 UTC del 14 ya es 10:00 pm del 13 en Bogotá.
    expect(formatDayLong('2026-11-14T03:00:00Z')).toBe('viernes 13 nov')
  })

  it('acepta una fecha de calendario sin hora', () => {
    process.env.TZ = 'Pacific/Auckland'
    expect(formatDayLong('2026-11-13')).toBe('viernes 13 nov')
  })
})

describe('formatDuration', () => {
  it('muestra minutos, horas y mezclas', () => {
    expect(formatDuration(30)).toBe('30 min')
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1 hora')
    expect(formatDuration(90)).toBe('1 h 30 min')
    expect(formatDuration(120)).toBe('2 horas')
  })
})
