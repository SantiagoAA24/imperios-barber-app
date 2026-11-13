import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT, isDirty, moveId, parsePesos, toBody, validateDraft } from './serviceForm'

const valid = { ...EMPTY_DRAFT, name: 'Corte', price: '$22.000', duration: '30' }

describe('serviceForm', () => {
  it('parsea pesos con símbolo y puntos', () => {
    expect(parsePesos('$22.000')).toBe(22000)
    expect(parsePesos('')).toBeNull()
    expect(parsePesos('abc')).toBeNull()
  })

  it('valida nombre, precio y duración', () => {
    expect(validateDraft(valid)).toEqual({})
    expect(validateDraft({ ...valid, name: 'A' }).name).toBeDefined()
    expect(validateDraft({ ...valid, price: '' }).price).toBeDefined()
    expect(validateDraft({ ...valid, price: '1000001' }).price).toBeDefined()
    expect(validateDraft({ ...valid, duration: '7' }).duration).toBeDefined()
    expect(validateDraft({ ...valid, duration: '245' }).duration).toBeDefined()
    expect(validateDraft({ ...valid, duration: '5' })).toEqual({})
    expect(validateDraft({ ...valid, description: 'x'.repeat(201) }).description).toBeDefined()
  })

  it('arma el cuerpo y limpia la descripción vacía', () => {
    expect(toBody({ ...valid, usesResource: true }, 'r1')).toEqual({
      name: 'Corte',
      description: null,
      price_cop: 22000,
      duration_min: 30,
      resource_id: 'r1',
      active: true,
    })
    expect(toBody(valid, 'r1').resource_id).toBeNull()
  })

  it('detecta cambios sin guardar ignorando el formato del precio', () => {
    expect(isDirty(valid, { ...valid, price: '22000' })).toBe(false)
    expect(isDirty(valid, { ...valid, price: '$23.000' })).toBe(true)
  })

  it('mueve un id sin salirse de los bordes', () => {
    expect(moveId(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveId(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(moveId(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
  })
})
