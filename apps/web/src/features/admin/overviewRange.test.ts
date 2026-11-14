import { describe, expect, it } from 'vitest'
import {
  barLabel,
  daysInRange,
  monthRange,
  peakDay,
  periodTitle,
  validateCustomRange,
} from './overviewRange'

const day = (date: string, revenue: number) => ({ date, revenue_cop: revenue, count: 1 })

describe('overviewRange', () => {
  it('monthRange cubre el mes completo', () => {
    expect(monthRange('2026-11-14')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(monthRange('2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(monthRange('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
  it('daysInRange incluye ambos extremos', () => {
    expect(daysInRange('2026-11-09', '2026-11-15')).toBe(7)
    expect(daysInRange('2026-11-09', '2026-11-09')).toBe(1)
    expect(daysInRange('2028-01-01', '2028-12-31')).toBe(366)
  })
  it('valida el rango personalizado', () => {
    expect(validateCustomRange('2026-11-01', '2026-11-30')).toBeNull()
    expect(validateCustomRange('', '2026-11-30')).toMatch(/Elige/)
    expect(validateCustomRange('2026-11-30', '2026-11-01')).toMatch(/anterior/)
    expect(validateCustomRange('2026-01-01', '2027-01-02')).toMatch(/366/)
    expect(validateCustomRange('2028-01-01', '2028-12-31')).toBeNull()
  })
  it('títulos del periodo', () => {
    expect(periodTitle('week', '2026-11-09', '2026-11-15')).toBe('Semana del 9 al 15 de noviembre')
    expect(periodTitle('month', '2026-11-01', '2026-11-30')).toBe('Noviembre de 2026')
    expect(periodTitle('custom', '2026-11-25', '2026-12-03')).toBe(
      'Del 25 de noviembre al 3 de diciembre',
    )
  })
  it('día pico y rótulos', () => {
    const days = [day('2026-11-09', 100), day('2026-11-14', 300), day('2026-11-15', 300)]
    expect(peakDay(days)).toEqual({ date: '2026-11-14', label: 'sábado' })
    expect(peakDay([day('2026-11-09', 0)])).toBeNull()
    expect(barLabel(days, 0)).toBe('Lun')
    const long = Array.from({ length: 30 }, (_, i) =>
      day(`2026-11-${String(i + 1).padStart(2, '0')}`, 1),
    )
    expect(barLabel(long, 0)).toBe('1')
    expect(barLabel(long, 1)).toBe('')
    expect(barLabel(long, 3)).toBe('4')
  })
})
