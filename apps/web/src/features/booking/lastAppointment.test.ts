import { afterEach, describe, expect, it, vi } from 'vitest'
import { LAST_APPOINTMENT_KEY, readLastAppointment, saveLastAppointment } from './lastAppointment'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('última cita', () => {
  it('guarda el token con la clave imperio:ultima-cita', () => {
    saveLastAppointment('abc123')
    expect(LAST_APPOINTMENT_KEY).toBe('imperio:ultima-cita')
    expect(localStorage.getItem('imperio:ultima-cita')).toBe('abc123')
    expect(readLastAppointment()).toBe('abc123')
  })

  it('si el almacenamiento falla no lanza error', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    expect(() => saveLastAppointment('abc123')).not.toThrow()
    expect(readLastAppointment()).toBeNull()
  })
})
