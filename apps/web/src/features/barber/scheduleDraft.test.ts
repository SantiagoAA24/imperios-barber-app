import { describe, expect, it } from 'vitest'
import {
  addTramo,
  copyDay,
  removeTramo,
  setTramo,
  setWorking,
  timeLabel,
  TIME_OPTIONS,
  toBlocks,
  toDraft,
} from './scheduleDraft'

const SERVER = [
  { weekday: 0, start_time: '14:00:00', end_time: '18:00:00' },
  { weekday: 0, start_time: '09:00:00', end_time: '13:00:00' },
  { weekday: 2, start_time: '10:00:00', end_time: '16:00:00' },
]

describe('scheduleDraft', () => {
  it('agrupa por día y ordena los tramos', () => {
    const draft = toDraft(SERVER)
    expect(draft[0]).toEqual([
      { start: '09:00', end: '13:00' },
      { start: '14:00', end: '18:00' },
    ])
    expect(draft[1]).toEqual([])
    expect(draft[2]).toEqual([{ start: '10:00', end: '16:00' }])
  })

  it('toBlocks es la inversa de toDraft', () => {
    const blocks = toBlocks(toDraft(SERVER))
    expect(blocks).toEqual([
      { weekday: 0, start_time: '09:00', end_time: '13:00' },
      { weekday: 0, start_time: '14:00', end_time: '18:00' },
      { weekday: 2, start_time: '10:00', end_time: '16:00' },
    ])
  })

  it('encender un día libre pone una jornada; apagarlo lo vacía', () => {
    const on = setWorking(toDraft([]), 3, true)
    expect(on[3]).toEqual([{ start: '09:00', end: '18:00' }])
    expect(setWorking(on, 3, false)[3]).toEqual([])
  })

  it('encender un día que ya trabaja no pierde sus tramos', () => {
    const draft = toDraft(SERVER)
    expect(setWorking(draft, 0, true)[0]).toHaveLength(2)
  })

  it('edita una hora sin tocar los demás días', () => {
    const next = setTramo(toDraft(SERVER), 2, 0, 'end', '17:30')
    expect(next[2]).toEqual([{ start: '10:00', end: '17:30' }])
    expect(next[0]).toHaveLength(2)
  })

  it('agregar tramo deja el almuerzo de 1 a 2 pm', () => {
    const base = setWorking(toDraft([]), 1, true)
    expect(addTramo(base, 1)[1]).toEqual([
      { start: '09:00', end: '13:00' },
      { start: '14:00', end: '18:00' },
    ])
  })

  it('no pasa de dos tramos y quitar vuelve a uno', () => {
    const two = toDraft(SERVER)
    expect(addTramo(two, 0)[0]).toHaveLength(2)
    expect(removeTramo(two, 0, 1)[0]).toEqual([{ start: '09:00', end: '13:00' }])
  })

  it('copiar un día a otros reemplaza sus tramos con copias', () => {
    const draft = toDraft(SERVER)
    const next = copyDay(draft, 0, [4, 5])
    expect(next[4]).toEqual(draft[0])
    expect(next[5]).toEqual(draft[0])
    expect(next[4]).not.toBe(draft[0])
    expect(next[2]).toEqual(draft[2])
  })

  it('las opciones de hora son de 30 en 30 y se escriben como en la app', () => {
    expect(TIME_OPTIONS).toHaveLength(48)
    expect(TIME_OPTIONS[0]).toBe('00:00')
    expect(TIME_OPTIONS[47]).toBe('23:30')
    expect(timeLabel('09:00')).toBe('9:00 am')
    expect(timeLabel('13:30')).toBe('1:30 pm')
  })
})
