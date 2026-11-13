import { describe, expect, it } from 'vitest'
import {
  agendaColumns,
  blockBox,
  gridHeight,
  gridRange,
  hourMarks,
  nowLineTop,
  PX_PER_MINUTE,
} from './agendaLayout'

const appt = (start: string, end: string, barber = 'b1') =>
  ({
    starts_at: start,
    ends_at: end,
    barber: { id: barber, display_name: barber.toUpperCase() },
  }) as never

describe('agendaLayout', () => {
  it('la rejilla va del inicio mínimo al cierre máximo', () => {
    const range = gridRange('09:00', '18:00', [])
    expect(range).toEqual({ startMin: 540, endMin: 1080 })
    expect(gridHeight(range)).toBe(Math.round(540 * PX_PER_MINUTE)) // 18 filas de 30 min = 792
    expect(hourMarks(range)).toHaveLength(9)
  })

  it('se amplía si una cita queda fuera del horario, sin cortarla', () => {
    const early = appt('2026-11-16T08:15:00-05:00', '2026-11-16T08:45:00-05:00')
    const late = appt('2026-11-16T18:00:00-05:00', '2026-11-16T19:10:00-05:00')
    expect(gridRange('09:00', '18:00', [early, late])).toEqual({ startMin: 480, endMin: 1170 })
  })

  it('44 px por cada 30 minutos: posición y alto por minutos reales', () => {
    const range = gridRange('09:00', '18:00', [])
    const thirty = blockBox(appt('2026-11-16T09:30:00-05:00', '2026-11-16T10:00:00-05:00'), range)
    expect(thirty).toEqual({ top: 44 + 2, height: 44 - 4 })
    const fortyFive = blockBox(
      appt('2026-11-16T10:00:00-05:00', '2026-11-16T10:45:00-05:00'),
      range,
    )
    expect(fortyFive.top).toBe(Math.round(60 * PX_PER_MINUTE) + 2)
    expect(fortyFive.height).toBe(Math.round(45 * PX_PER_MINUTE) - 4)
    const odd = blockBox(appt('2026-11-16T09:05:00-05:00', '2026-11-16T09:35:00-05:00'), range)
    expect(odd.top).toBe(Math.round(5 * PX_PER_MINUTE) + 2)
  })

  it('la línea de ahora solo existe hoy y dentro de la rejilla', () => {
    const range = gridRange('09:00', '18:00', [])
    expect(nowLineTop(false, 600, range)).toBeNull()
    expect(nowLineTop(true, 480, range)).toBeNull()
    expect(nowLineTop(true, 1100, range)).toBeNull()
    expect(nowLineTop(true, 600, range)).toBe(Math.round(60 * PX_PER_MINUTE))
  })

  it('columnas: barberos activos y los inactivos con citas, ordenados por nombre', () => {
    const cols = agendaColumns(
      [
        { id: 'b2', display_name: 'Beto', active: true },
        { id: 'b1', display_name: 'Ana', active: true },
        { id: 'b3', display_name: 'Zeta', active: false },
      ],
      [appt('2026-11-16T10:00:00-05:00', '2026-11-16T10:30:00-05:00', 'b4')],
    )
    expect(cols.map((c) => c.id)).toEqual(['b1', 'b4', 'b2'])
  })
})
