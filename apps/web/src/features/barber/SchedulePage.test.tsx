import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { json, stubApi } from '../../test/api'
import type { Handler } from '../../test/api'
import { renderWithApp } from '../../test/barber'
import { SchedulePage } from './SchedulePage'

const CONFLICT = {
  appointment_id: '77777777-0000-4000-8000-000000000001',
  starts_at: '2026-11-16T16:00:00-05:00',
  ends_at: '2026-11-16T16:30:00-05:00',
  client_name: 'Pedro Ruiz',
  service_name: 'Corte básico',
}

const WEEK = [0, 1, 2, 3, 4].flatMap((weekday) => [
  { weekday, start_time: '09:00:00', end_time: '13:00:00' },
  { weekday, start_time: '14:00:00', end_time: '18:00:00' },
])

function renderSchedule(extra: Record<string, Handler> = {}, conflicts: unknown[] = []) {
  const calls = stubApi({
    'GET /api/v1/me/schedule': () => json(200, { schedule: WEEK, conflicts }),
    'GET /api/v1/me/time-off': () => json(200, { items: [] }),
    ...extra,
  })
  renderWithApp(<SchedulePage />)
  return calls
}

afterEach(() => vi.unstubAllGlobals())

const row = (name: string) =>
  screen.getByRole('switch', { name: `Trabajo el ${name}` }).closest('li')!

describe('Mi horario', () => {
  it('muestra los siete días, con tramos o "Día libre"', async () => {
    renderSchedule()
    await screen.findByRole('switch', { name: 'Trabajo el lunes' })
    expect(screen.getAllByRole('switch')).toHaveLength(7)
    expect(
      screen.getByRole('switch', { name: 'Trabajo el lunes' }).getAttribute('aria-checked'),
    ).toBe('true')
    expect(
      screen.getByRole('switch', { name: 'Trabajo el sábado' }).getAttribute('aria-checked'),
    ).toBe('false')
    expect(within(row('sábado')).getByText('Día libre')).toBeTruthy()
    const monday = row('lunes')
    expect(
      (within(monday).getByLabelText('Lunes, tramo 1, desde') as HTMLSelectElement).value,
    ).toBe('09:00')
    expect(
      (within(monday).getByLabelText('Lunes, tramo 2, hasta') as HTMLSelectElement).value,
    ).toBe('18:00')
  })

  it('guarda el horario completo con PUT', async () => {
    const calls = renderSchedule({
      'PUT /api/v1/me/schedule': ({ body }) =>
        json(200, { schedule: (body as { schedule: unknown[] }).schedule, conflicts: [] }),
    })
    await screen.findByRole('switch', { name: 'Trabajo el lunes' })
    fireEvent.click(screen.getByRole('switch', { name: 'Trabajo el sábado' }))
    fireEvent.change(within(row('sábado')).getByLabelText('Sábado, tramo 1, hasta'), {
      target: { value: '14:00' },
    })
    fireEvent.click(screen.getByRole('switch', { name: 'Trabajo el viernes' })) // viernes libre
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horario' }))

    expect(await screen.findByText('Horario guardado.')).toBeTruthy()
    const body = calls.find((c) => c.method === 'PUT')?.body as {
      schedule: Array<{ weekday: number; start_time: string; end_time: string }>
    }
    expect(body.schedule.filter((b) => b.weekday === 4)).toEqual([])
    expect(body.schedule.filter((b) => b.weekday === 5)).toEqual([
      { weekday: 5, start_time: '09:00', end_time: '14:00' },
    ])
    expect(body.schedule).toHaveLength(8 + 2 + 1 - 0 - 2 + 0) // lun-jue (8) + sáb (1) = 9
  })

  it('un día con un solo tramo puede partirse en dos y copiarse a otros días', async () => {
    renderSchedule()
    await screen.findByRole('switch', { name: 'Trabajo el lunes' })
    fireEvent.click(screen.getByRole('switch', { name: 'Trabajo el sábado' }))
    const saturday = row('sábado')
    fireEvent.click(within(saturday).getByRole('button', { name: /Dejar almuerzo libre/ }))
    expect(within(saturday).getByLabelText('Sábado, tramo 2, desde')).toBeTruthy()

    fireEvent.click(within(saturday).getByRole('button', { name: /Copiar el sábado/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Copiar el sábado' })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Domingo' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copiar horario' }))
    await waitFor(() =>
      expect(within(row('domingo')).getByLabelText('Domingo, tramo 2, hasta')).toBeTruthy(),
    )
  })

  it('muestra los conflictos con cliente, hora y enlace a la cita, dejando claro que no se cancelaron', async () => {
    renderSchedule({}, [CONFLICT])
    const link = await screen.findByRole('link', { name: /Ver la cita de Pedro Ruiz/ })
    expect(link.getAttribute('href')).toBe(
      `/barbero?fecha=2026-11-16&cita=${CONFLICT.appointment_id}`,
    )
    expect(screen.getByText('Pedro Ruiz')).toBeTruthy()
    expect(screen.getByText(/lunes 16 nov\s+· 4:00 pm/)).toBeTruthy()
    expect(screen.getByText(/No se cancelaron/)).toBeTruthy()
  })

  it('al guardar, los conflictos que devuelve el PUT se muestran', async () => {
    renderSchedule({
      'PUT /api/v1/me/schedule': () => json(200, { schedule: [], conflicts: [CONFLICT] }),
    })
    await screen.findByRole('switch', { name: 'Trabajo el lunes' })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horario' }))
    expect(await screen.findByRole('link', { name: /Ver la cita de Pedro Ruiz/ })).toBeTruthy()
  })

  it('un horario inválido muestra el mensaje del servidor', async () => {
    renderSchedule({
      'PUT /api/v1/me/schedule': () =>
        json(422, {
          code: 'invalid_schedule',
          message: 'Hay tramos que se cruzan el mismo día.',
          details: {},
        }),
    })
    await screen.findByRole('switch', { name: 'Trabajo el lunes' })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horario' }))
    expect(await screen.findByText('Hay tramos que se cruzan el mismo día.')).toBeTruthy()
  })
})

describe('Ausencias', () => {
  const OFF = {
    id: '88888888-0000-4000-8000-000000000001',
    starts_at: '2026-11-20T13:00:00-05:00',
    ends_at: '2026-11-20T14:00:00-05:00',
    reason: 'Almuerzo largo',
  }

  it('lista, da de alta y de baja', async () => {
    let items = [OFF]
    const calls = renderSchedule({
      'GET /api/v1/me/time-off': () => json(200, { items }),
      'POST /api/v1/me/time-off': ({ body }) => {
        const b = body as { starts_at: string; ends_at: string; reason: string | null }
        items = [...items, { id: 'nuevo', ...b } as typeof OFF]
        return json(201, { time_off: items.at(-1), conflicts: [CONFLICT] })
      },
      [`DELETE /api/v1/me/time-off/${OFF.id}`]: () => {
        items = items.filter((i) => i.id !== OFF.id)
        return new Response(null, { status: 204 })
      },
    })
    expect(await screen.findByText('Almuerzo largo')).toBeTruthy()
    expect(screen.getByText(/viernes 20 nov · 1:00 pm – 2:00 pm/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Bloquear horas o días' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ausencia' }))
    expect(await screen.findByText('Elige cuándo empieza.')).toBeTruthy()
    expect(screen.getByText('Elige cuándo termina.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-23T08:00' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-24T18:00' } })
    fireEvent.change(screen.getByLabelText('Motivo (opcional)'), { target: { value: 'Viaje' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ausencia' }))

    expect(await screen.findByRole('link', { name: /Ver la cita de Pedro Ruiz/ })).toBeTruthy()
    expect(screen.getByText(/Estas citas caen dentro de tu ausencia/)).toBeTruthy()
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      starts_at: '2026-11-23T08:00:00-05:00',
      ends_at: '2026-11-24T18:00:00-05:00',
      reason: 'Viaje',
    })

    fireEvent.click(screen.getByRole('button', { name: /Quitar ausencia: viernes 20 nov/ }))
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true))
    await waitFor(() => expect(screen.queryByText('Almuerzo largo')).toBeNull())
  })
})
