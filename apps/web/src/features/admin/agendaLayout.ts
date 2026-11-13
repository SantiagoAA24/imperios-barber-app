import type { AdminAppointment } from '../../lib/api/types'
import { minutesOfDay, parseClock } from '../../lib/format'

/** 44 px por cada 30 minutos (design-system: área táctil mínima), posicionado por minutos reales. */
export const PX_PER_MINUTE = 44 / 30
export const SLOT_MIN = 30
const BLOCK_GAP_PX = 4

export type GridRange = { startMin: number; endMin: number }

/**
 * Rango visible: del inicio mínimo al cierre máximo de los horarios, ampliado (a múltiplos de
 * 30 min) si alguna cita queda fuera para que nunca se corte un bloque.
 */
export function gridRange(
  dayStart: string,
  dayEnd: string,
  items: Pick<AdminAppointment, 'starts_at' | 'ends_at'>[],
): GridRange {
  let startMin = parseClock(dayStart)
  let endMin = parseClock(dayEnd)
  for (const item of items) {
    startMin = Math.min(startMin, minutesOfDay(item.starts_at))
    endMin = Math.max(endMin, endOfDayMinutes(item))
  }
  startMin = Math.floor(startMin / SLOT_MIN) * SLOT_MIN
  endMin = Math.ceil(endMin / SLOT_MIN) * SLOT_MIN
  if (endMin <= startMin) endMin = startMin + SLOT_MIN
  return { startMin, endMin }
}

/** Minuto de fin; una cita que termina a medianoche cuenta como 24:00. */
function endOfDayMinutes(item: Pick<AdminAppointment, 'starts_at' | 'ends_at'>): number {
  const start = minutesOfDay(item.starts_at)
  const duration = Math.round(
    (new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()) / 60_000,
  )
  return start + duration
}

export function gridHeight(range: GridRange): number {
  return Math.round((range.endMin - range.startMin) * PX_PER_MINUTE)
}

/** Posición vertical de un bloque dentro de la columna. */
export function blockBox(
  item: Pick<AdminAppointment, 'starts_at' | 'ends_at'>,
  range: GridRange,
): { top: number; height: number } {
  const start = minutesOfDay(item.starts_at)
  const duration = endOfDayMinutes(item) - start
  return {
    top: Math.round((start - range.startMin) * PX_PER_MINUTE) + BLOCK_GAP_PX / 2,
    height: Math.round(duration * PX_PER_MINUTE) - BLOCK_GAP_PX,
  }
}

/** Minutos de inicio de cada fila de hora (una por hora en punto dentro del rango). */
export function hourMarks(range: GridRange): number[] {
  const marks: number[] = []
  for (let m = Math.ceil(range.startMin / 60) * 60; m < range.endMin; m += 60) marks.push(m)
  return marks
}

/** Línea de "ahora": solo si es el día de hoy y el minuto cae dentro de la rejilla. */
export function nowLineTop(isToday: boolean, nowMinutes: number, range: GridRange): number | null {
  if (!isToday || nowMinutes < range.startMin || nowMinutes > range.endMin) return null
  return Math.round((nowMinutes - range.startMin) * PX_PER_MINUTE)
}

export type Column = { id: string; label: string }

/** Barberos activos más cualquier barbero con citas en el rango (aunque ya esté inactivo). */
export function agendaColumns(
  barbers: { id: string; display_name: string; active: boolean }[],
  items: AdminAppointment[],
): Column[] {
  const columns = new Map<string, Column>()
  for (const b of barbers) {
    if (b.active) columns.set(b.id, { id: b.id, label: b.display_name })
  }
  for (const item of items) {
    if (!columns.has(item.barber.id)) {
      columns.set(item.barber.id, { id: item.barber.id, label: item.barber.display_name })
    }
  }
  return [...columns.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'))
}
