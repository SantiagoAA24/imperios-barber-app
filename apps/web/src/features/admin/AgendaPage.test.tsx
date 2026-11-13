import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { addDays } from '../../lib/format'
import { apiError, json, stubApi } from '../../test/api'
import type { Handler } from '../../test/api'
import { renderWithApp, TODAY } from '../../test/barber'
import AgendaPage from './AgendaPage'

const ANA = { id: 'b1', display_name: 'Ana' }
const BETO = { id: 'b2', display_name: 'Beto' }

function appt(id: string, barber: typeof ANA, time: string, extra: Record<string, unknown> = {}) {
  const [h, m] = time.split(':').map(Number) as [number, number]
  const end = `${String(Math.floor((h * 60 + m + 30) / 60)).padStart(2, '0')}:${String((m + 30) % 60).padStart(2, '0')}`
  return {
    id,
    barber,
    service: { name: 'Corte básico', duration_min: 30, uses_resource: false },
    client: { id: `c-${id}`, name: `Cliente ${id}`, phone_masked: '300 *** 4821' },
    status: 'booked',
    source: 'online',
    starts_at: `${TODAY}T${time}:00-05:00`,
    ends_at: `${TODAY}T${end}:00-05:00`,
    price_cop: 22_000,
    is_overdue: false,
    ...extra,
  }
}

const AGENDA = {
  items: [
    appt('a1', ANA, '10:00', { status: 'attended' }),
    appt('a2', BETO, '10:30', {
      service: { name: 'Corte + limpieza facial', duration_min: 60, uses_resource: true },
      ends_at: `${TODAY}T11:30:00-05:00`,
    }),
    appt('a3', ANA, '11:00', { status: 'no_show' }),
  ],
  day_start: '09:00',
  day_end: '18:00',
}
const BARBERS = {
  items: [
    {
      ...ANA,
      email: 'a@x.co',
      visible_in_booking: true,
      active: true,
      must_change_password: false,
    },
    {
      ...BETO,
      email: 'b@x.co',
      visible_in_booking: true,
      active: true,
      must_change_password: false,
    },
  ],
}
const SERVICES = {
  items: [
    {
      id: 's1',
      name: 'Corte básico',
      description: null,
      price_cop: 22_000,
      duration_min: 30,
      resource_id: null,
      active: true,
      sort: 0,
    },
  ],
  resources: [{ id: 'r1', name: 'Vaporizador' }],
}

function renderPage(extra: Record<string, Handler> = {}, path = '/admin/agenda') {
  const calls = stubApi({
    'GET /api/v1/admin/appointments': () => json(200, AGENDA),
    'GET /api/v1/admin/barbers': () => json(200, BARBERS),
    'GET /api/v1/admin/services': () => json(200, SERVICES),
    ...extra,
  })
  const view = renderWithApp(<AgendaPage />, path)
  return { calls, ...view }
}

afterEach(() => vi.unstubAllGlobals())

describe('Agenda del día (admin)', () => {
  it('muestra una columna por barbero y la del Vaporizador con los bloques en su sitio', async () => {
    const { container } = renderPage()
    const ana = await screen.findByRole('group', { name: 'Citas de Ana' })
    expect(within(ana).getAllByRole('button')).toHaveLength(2)
    expect(
      within(screen.getByRole('group', { name: 'Citas de Beto' })).getAllByRole('button'),
    ).toHaveLength(1)
    const vap = screen.getByRole('group', { name: 'Uso de Vaporizador' })
    expect(within(vap).getByText('En uso · Beto')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Vaporizador', level: 2 })).toBeTruthy()
    // 44 px por 30 min: 10:00 con la rejilla desde las 9:00 -> 88 px (+2 de separación).
    const block = within(ana).getByRole('button', { name: /Cliente a1/ })
    expect(block.style.top).toBe('90px')
    expect(block.style.height).toBe('40px')
    // 60 min -> 88 px - 4.
    const long = screen.getByRole('button', { name: /Cliente a2/ })
    expect(long.style.height).toBe('84px')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('el estado se dice con palabra e ícono, no solo con el color', async () => {
    renderPage()
    await screen.findByRole('group', { name: 'Citas de Ana' })
    expect(screen.getByText('Atendida')).toBeTruthy()
    expect(screen.getByText('No asistió')).toBeTruthy()
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0)
  })

  it('la línea de "Ahora" aparece solo al ver el día de hoy', async () => {
    const { unmount } = renderPage({}, '/admin/agenda')
    await screen.findByRole('group', { name: 'Citas de Ana' })
    const hasLine = screen.queryByText('Ahora') !== null
    // Depende de la hora a la que corra la prueba: con la rejilla 9-18 solo existe dentro de ese rango.
    const minutes = new Date().toLocaleString('en-GB', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    const [h = 0, m = 0] = minutes.split(':').map(Number)
    const inside = h * 60 + m >= 9 * 60 && h * 60 + m <= 18 * 60
    expect(hasLine).toBe(inside)
    unmount()
    renderPage({}, `/admin/agenda?fecha=${addDays(TODAY, 1)}`)
    await screen.findByRole('group', { name: 'Citas de Ana' })
    expect(screen.queryByText('Ahora')).toBeNull()
  })

  it('el selector de día y el alternador Día/Semana son enlaces', async () => {
    renderPage({}, `/admin/agenda?fecha=${TODAY}`)
    await screen.findByRole('group', { name: 'Citas de Ana' })
    expect(screen.getByRole('link', { name: 'Día anterior' }).getAttribute('href')).toBe(
      `/admin/agenda?fecha=${addDays(TODAY, -1)}`,
    )
    expect(screen.getByRole('link', { name: 'Día siguiente' }).getAttribute('href')).toBe(
      `/admin/agenda?fecha=${addDays(TODAY, 1)}`,
    )
    const view = screen.getByRole('navigation', { name: 'Vista' })
    expect(within(view).getByRole('link', { name: 'Día' }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(within(view).getByRole('link', { name: 'Semana' }).getAttribute('href')).toBe(
      `/admin/semana?fecha=${TODAY}`,
    )
  })

  it('pulsar un bloque abre el detalle con celular parcial y acciones; cancelar pide confirmación', async () => {
    const { calls } = renderPage({
      'PATCH /api/v1/admin/appointments/a2': () =>
        json(200, { ...AGENDA.items[1], status: 'cancelled' }),
    })
    await screen.findByRole('group', { name: 'Citas de Beto' })
    fireEvent.click(screen.getByRole('button', { name: /Cliente a2/ }))
    const panel = await screen.findByRole('complementary', { name: 'Detalle de la cita' })
    expect(within(panel).getByText('300 *** 4821')).toBeTruthy()
    expect(within(panel).getByText('Usa el vaporizador')).toBeTruthy()
    expect(within(panel).getByRole('button', { name: 'Atendida' })).toBeTruthy()
    expect(within(panel).getByRole('button', { name: 'No asistió' })).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: 'Cancelar cita' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Cancelar esta cita?' })
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, cancelar cita' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'cancelled' }),
    )
  })

  it('muestra el error 409 del servidor al marcar una cita antes de tiempo', async () => {
    renderPage({
      'PATCH /api/v1/admin/appointments/a2': () =>
        apiError(
          409,
          'too_early_for_attended',
          'Solo puedes marcarla como atendida desde 15 minutos antes.',
        ),
    })
    await screen.findByRole('group', { name: 'Citas de Beto' })
    fireEvent.click(screen.getByRole('button', { name: /Cliente a2/ }))
    const panel = await screen.findByRole('complementary', { name: 'Detalle de la cita' })
    fireEvent.click(within(panel).getByRole('button', { name: 'Atendida' }))
    expect((await within(panel).findByRole('alert')).textContent).toContain('15 minutos antes')
  })

  it('una cita atendida no ofrece más acciones', async () => {
    renderPage()
    await screen.findByRole('group', { name: 'Citas de Ana' })
    fireEvent.click(screen.getByRole('button', { name: /Cliente a1/ }))
    const panel = await screen.findByRole('complementary', { name: 'Detalle de la cita' })
    expect(within(panel).queryByRole('button', { name: 'Atendida' })).toBeNull()
    expect(within(panel).getByText(/no hay más acciones/)).toBeTruthy()
  })

  it('Nueva cita: elige barbero, servicio, hora y cliente y envía POST', async () => {
    const start = `${TODAY}T14:00:00-05:00`
    const { calls } = renderPage({
      'GET /api/v1/admin/availability': () =>
        json(200, { date: TODAY, slots: [{ starts_at: start }] }),
      'POST /api/v1/admin/appointments': () => json(201, appt('n1', ANA, '14:00')),
    })
    await screen.findByRole('group', { name: 'Citas de Ana' })
    fireEvent.click(screen.getByRole('button', { name: 'Nueva cita' }))
    const form = await screen.findByRole('complementary', { name: 'Nueva cita' })
    fireEvent.change(within(form).getByLabelText('Barbero'), { target: { value: 'b1' } })
    fireEvent.change(within(form).getByLabelText('Servicio'), { target: { value: 's1' } })
    await waitFor(() => expect(within(form).getByRole('option', { name: '2:00 pm' })).toBeTruthy())
    fireEvent.change(within(form).getByLabelText('Hora'), { target: { value: start } })
    fireEvent.change(within(form).getByLabelText('Nombre del cliente'), {
      target: { value: 'Pedro Ruiz' },
    })
    fireEvent.change(within(form).getByLabelText('Celular (opcional)'), {
      target: { value: '3001234567' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Crear cita' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true))
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      barber_id: 'b1',
      service_id: 's1',
      starts_at: start,
      client: { name: 'Pedro Ruiz', phone: '3001234567' },
    })
  })

  it('Nueva cita valida los campos y muestra el 409 de horario ocupado', async () => {
    const start = `${TODAY}T14:00:00-05:00`
    renderPage({
      'GET /api/v1/admin/availability': () =>
        json(200, { date: TODAY, slots: [{ starts_at: start }] }),
      'POST /api/v1/admin/appointments': () =>
        apiError(
          409,
          'slot_unavailable',
          'Ese horario ya no está disponible. Elige otro de los que te mostramos.',
        ),
    })
    await screen.findByRole('group', { name: 'Citas de Ana' })
    fireEvent.click(screen.getByRole('button', { name: 'Nueva cita' }))
    const form = await screen.findByRole('complementary', { name: 'Nueva cita' })
    fireEvent.click(within(form).getByRole('button', { name: 'Crear cita' }))
    expect(await within(form).findByText('Elige un barbero.')).toBeTruthy()
    expect(within(form).getByText('Elige una hora.')).toBeTruthy()
    fireEvent.change(within(form).getByLabelText('Barbero'), { target: { value: 'b1' } })
    fireEvent.change(within(form).getByLabelText('Servicio'), { target: { value: 's1' } })
    await waitFor(() => expect(within(form).getByRole('option', { name: '2:00 pm' })).toBeTruthy())
    fireEvent.change(within(form).getByLabelText('Hora'), { target: { value: start } })
    fireEvent.change(within(form).getByLabelText('Nombre del cliente'), {
      target: { value: 'Pedro Ruiz' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Crear cita' }))
    expect((await within(form).findByRole('alert')).textContent).toContain('ya no está disponible')
  })
})
