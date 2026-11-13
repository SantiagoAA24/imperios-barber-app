import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { addDays } from '../../lib/format'
import { json, stubApi } from '../../test/api'
import { renderWithApp, TODAY } from '../../test/barber'
import { weekDays, weekStart } from './agendaLayout'
import WeekPage from './WeekPage'

const START = weekStart(TODAY)
const DAYS = weekDays(START)

function appt(id: string, barber: string, name: string, day: string, time: string) {
  return {
    id,
    barber: { id: barber, display_name: barber === 'b1' ? 'Barbero 1' : 'Barbero 2' },
    service: { name: 'Corte básico', duration_min: 30, uses_resource: false },
    client: { id: `c${id}`, name, phone_masked: '300 *** 4821' },
    status: 'booked',
    source: 'online',
    starts_at: `${day}T${time}:00-05:00`,
    ends_at: `${day}T${time.replace(':00', ':30')}:00-05:00`,
    price_cop: 22_000,
    is_overdue: false,
  }
}

const AGENDA = {
  items: [
    appt('1', 'b1', 'Hernán', DAYS[0]!, '10:00'),
    appt('2', 'b2', 'Iván', DAYS[0]!, '10:00'),
    appt('3', 'b1', 'Sergio', DAYS[2]!, '11:00'),
  ],
  day_start: '09:00',
  day_end: '18:00',
}
const barber = (id: string, name: string) => ({
  id,
  display_name: name,
  email: `${id}@x.co`,
  visible_in_booking: true,
  active: true,
  must_change_password: false,
})

function renderPage(path = '/admin/semana') {
  const calls = stubApi({
    'GET /api/v1/admin/appointments': () => json(200, AGENDA),
    'GET /api/v1/admin/barbers': () =>
      json(200, { items: [barber('b1', 'Barbero 1'), barber('b2', 'Barbero 2')] }),
  })
  const view = renderWithApp(<WeekPage />, path)
  return { calls, ...view }
}

afterEach(() => vi.unstubAllGlobals())

describe('Agenda semanal (admin)', () => {
  it('pide la semana de lunes a domingo y muestra siete columnas con su conteo', async () => {
    const { calls, container } = renderPage()
    await screen.findByRole('group', { name: `Citas del ${DAYS[0]}` })
    const query = calls.find((c) => c.path === '/api/v1/admin/appointments')?.query
    expect(query?.get('from')).toBe(START)
    expect(query?.get('to')).toBe(DAYS[6])
    expect(screen.getAllByRole('group', { name: /^Citas del / })).toHaveLength(7)
    expect(screen.getByRole('link', { name: /2 citas/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /1 cita$/ })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /0 citas/ })).toHaveLength(5)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('el día de hoy se resalta con la palabra "hoy" y aria-current', async () => {
    renderPage()
    await screen.findByRole('group', { name: `Citas del ${DAYS[0]}` })
    const current = document.querySelector('[aria-current="date"]') as HTMLElement
    expect(current.textContent).toContain('hoy')
    expect(current.getAttribute('href')).toBe(`/admin/agenda?fecha=${TODAY}`)
    expect(screen.getAllByText(/· hoy/)).toHaveLength(1)
  })

  it('dos carriles por barbero con su código, y cada bloque dice servicio y hora', async () => {
    renderPage()
    const monday = await screen.findByRole('group', { name: `Citas del ${DAYS[0]}` })
    expect(within(monday).getByText('Hernán')).toBeTruthy()
    expect(within(monday).getByText('B1')).toBeTruthy()
    expect(within(monday).getByText('B2')).toBeTruthy()
    expect(within(monday).getAllByText(/Corte básico, 10:00 am/)).toHaveLength(2)
    const legend = screen.getByRole('list', { name: 'Carriles por barbero' })
    expect(within(legend).getByText('Barbero 1 (B1)')).toBeTruthy()
    // Carril 1 a la izquierda y 2 a la derecha, 44 px por 30 min.
    const b1 = within(monday).getByText('Hernán').parentElement as HTMLElement
    const b2 = within(monday).getByText('Iván').parentElement as HTMLElement
    expect(b1.style.left).toBe('calc(0% + 2px)')
    expect(b2.style.left).toBe('calc(50% + 2px)')
    expect(b1.style.top).toBe('90px')
  })

  it('el desplazamiento horizontal es alcanzable con el teclado', async () => {
    renderPage()
    await screen.findByRole('group', { name: `Citas del ${DAYS[0]}` })
    const region = screen.getByRole('region', { name: 'Agenda de la semana' })
    expect(region.getAttribute('tabindex')).toBe('0')
    expect(region.className).toContain('overflow-x-auto')
  })

  it('navega por semanas y alterna con Día mediante enlaces', async () => {
    renderPage()
    await screen.findByRole('group', { name: `Citas del ${DAYS[0]}` })
    expect(screen.getByRole('link', { name: 'Semana anterior' }).getAttribute('href')).toBe(
      `/admin/semana?fecha=${addDays(START, -7)}`,
    )
    expect(screen.getByRole('link', { name: 'Semana siguiente' }).getAttribute('href')).toBe(
      `/admin/semana?fecha=${addDays(START, 7)}`,
    )
    const view = screen.getByRole('navigation', { name: 'Vista' })
    expect(within(view).getByRole('link', { name: 'Semana' }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(within(view).getByRole('link', { name: 'Día' }).getAttribute('href')).toBe(
      `/admin/agenda?fecha=${TODAY}`,
    )
    expect(screen.getByText(/semana del \d+ .* · 3 citas/)).toBeTruthy()
  })
})
