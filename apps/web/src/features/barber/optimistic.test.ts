import { describe, expect, it } from 'vitest'
import { applyOptimistic } from '../../lib/api/barber'
import type { Agenda, MeAppointment } from '../../lib/api/types'

function appt(id: string, status: MeAppointment['status'], price = 22000): MeAppointment {
  return {
    id,
    status,
    source: 'online',
    starts_at: '2026-11-13T10:00:00-05:00',
    ends_at: '2026-11-13T10:30:00-05:00',
    service: { name: 'Corte básico', duration_min: 30, price_cop: price, uses_resource: false },
    client: { id: `c-${id}`, name: 'Carlos', phone_masked: null, phone_e164: null },
    is_overdue: status === 'booked',
  }
}

const agenda = (): Agenda => ({
  date: '2026-11-13',
  appointments: [appt('a', 'booked'), appt('b', 'booked', 27000), appt('c', 'no_show')],
  summary: { total: 3, attended: 0, pending: 2, no_show: 1, revenue_cop: 0 },
})

describe('applyOptimistic', () => {
  it('atendida: cuenta, suma ingresos y deja de estar vencida', () => {
    const next = applyOptimistic(agenda(), 'b', 'attended')
    expect(next.appointments[1]).toMatchObject({ status: 'attended', is_overdue: false })
    expect(next.summary).toEqual({
      total: 3,
      attended: 1,
      pending: 1,
      no_show: 1,
      revenue_cop: 27000,
    })
  })

  it('no asistió', () => {
    const next = applyOptimistic(agenda(), 'a', 'no_show')
    expect(next.summary).toMatchObject({ pending: 1, no_show: 2 })
  })

  it('de no asistió a atendida (llegó tarde)', () => {
    const next = applyOptimistic(agenda(), 'c', 'attended')
    expect(next.summary).toMatchObject({ attended: 1, no_show: 0, pending: 2, revenue_cop: 22000 })
  })

  it('cancelar la quita de la lista y baja el total', () => {
    const next = applyOptimistic(agenda(), 'a', 'cancelled')
    expect(next.appointments.map((a) => a.id)).toEqual(['b', 'c'])
    expect(next.summary).toMatchObject({ total: 2, pending: 1 })
  })

  it('una cita desconocida no cambia nada y no muta el original', () => {
    const original = agenda()
    expect(applyOptimistic(original, 'zzz', 'attended')).toBe(original)
    applyOptimistic(original, 'a', 'attended')
    expect(original.summary.attended).toBe(0)
  })
})
