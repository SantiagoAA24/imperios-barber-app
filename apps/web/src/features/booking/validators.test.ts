import { describe, expect, it } from 'vitest'
import {
  cleanName,
  NAME_ERROR,
  nationalPhone,
  PHONE_ERROR,
  validateName,
  validatePhone,
} from './validators'

describe('validateName', () => {
  it.each(['Ana', 'Jo', 'Juan Pérez', 'A'.repeat(60), '  María   José  '])('acepta %j', (name) => {
    expect(validateName(name)).toBeNull()
  })

  it.each(['', ' ', 'A', '  A  ', 'A'.repeat(61)])('rechaza %j', (name) => {
    expect(validateName(name)).toBe(NAME_ERROR)
  })

  it('cuenta caracteres, no bytes: una tilde cuenta uno', () => {
    expect(validateName('Ñé')).toBeNull()
  })

  it('cleanName colapsa espacios', () => {
    expect(cleanName('  Juan    Pérez ')).toBe('Juan Pérez')
  })
})

describe('nationalPhone / validatePhone', () => {
  it.each([
    ['3001234567', '3001234567'],
    ['300 123 4567', '3001234567'],
    ['300-123-4567', '3001234567'],
    ['(300) 123 4567', '3001234567'],
    ['+57 300 123 4567', '3001234567'],
    ['+573001234567', '3001234567'],
    ['573001234567', '3001234567'],
    ['57 300 123 4567', '3001234567'],
    ['3501234567', '3501234567'],
  ])('acepta %j', (input, expected) => {
    expect(nationalPhone(input)).toBe(expected)
    expect(validatePhone(input)).toBeNull()
  })

  it.each([
    '',
    '123',
    '300123456', // 9 dígitos
    '30012345678', // 11 dígitos
    '2001234567', // no empieza por 3
    '+1 300 123 4567', // otro país
    '+52 300 123 4567',
    '300 123 456a',
    '5700123456', // 57 con 10 dígitos que no empiezan por 3
  ])('rechaza %j', (input) => {
    expect(nationalPhone(input)).toBeNull()
    expect(validatePhone(input)).toBe(PHONE_ERROR)
  })
})
