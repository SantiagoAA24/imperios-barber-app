import { describe, expect, it } from 'vitest'
import { ApiError } from './client'
import { isSlotConflict, MAX_ALTERNATIVES, slotAlternatives } from './conflict'

const conflict = (details: Record<string, unknown>) =>
  new ApiError(409, { code: 'slot_unavailable', message: 'x', details })

describe('conflicto de horario', () => {
  it('isSlotConflict solo reconoce el 409 slot_unavailable', () => {
    expect(isSlotConflict(conflict({}))).toBe(true)
    expect(
      isSlotConflict(new ApiError(409, { code: 'too_late_to_cancel', message: 'x', details: {} })),
    ).toBe(false)
    expect(
      isSlotConflict(new ApiError(500, { code: 'slot_unavailable', message: 'x', details: {} })),
    ).toBe(false)
    expect(isSlotConflict(new Error('x'))).toBe(false)
  })

  it('slotAlternatives devuelve a lo sumo 3 horarios válidos', () => {
    const items = [1, 2, 3, 4, 5].map((n) => ({
      starts_at: `2026-11-13T1${n}:00:00-05:00`,
      barber_ids: [],
    }))
    const result = slotAlternatives(conflict({ alternatives: items }))
    expect(result).toHaveLength(MAX_ALTERNATIVES)
    expect(result[0]).toEqual({ starts_at: '2026-11-13T11:00:00-05:00' })
  })

  it('ignora entradas mal formadas y la ausencia de alternativas', () => {
    expect(slotAlternatives(conflict({}))).toEqual([])
    expect(slotAlternatives(conflict({ alternatives: 'no' }))).toEqual([])
    expect(
      slotAlternatives(
        conflict({ alternatives: [null, 3, {}, { starts_at: 5 }, { starts_at: 'a' }] }),
      ),
    ).toEqual([{ starts_at: 'a' }])
  })
})
