import { describe, expect, it } from 'vitest'
import { updatedAgo } from './updatedAgo'

const T = 1_700_000_000_000

describe('updatedAgo', () => {
  it.each([
    [0, 'Actualizado ahora'],
    [9_000, 'Actualizado ahora'],
    [12_000, 'Actualizado hace 10 s'],
    [47_000, 'Actualizado hace 45 s'],
    [60_000, 'Actualizado hace 1 min'],
    [185_000, 'Actualizado hace 3 min'],
    [3_700_000, 'Actualizado hace 1 h'],
  ])('%i ms -> %s', (elapsed, expected) => {
    expect(updatedAgo(T, T + elapsed)).toBe(expected)
  })

  it('sin dato todavía', () => {
    expect(updatedAgo(0, T)).toBe('Sin actualizar')
  })

  it('un reloj adelantado no da tiempos negativos', () => {
    expect(updatedAgo(T + 5_000, T)).toBe('Actualizado ahora')
  })
})
