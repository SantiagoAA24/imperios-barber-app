import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiError, json, SERVICES, stubApi } from '../../test/api'
import type { Handler } from '../../test/api'
import { meAppt, meHandler, renderWithApp, TODAY } from '../../test/barber'
import { NewAppointmentPage } from './NewAppointmentPage'

function Agenda() {
  const location = useLocation()
  const state = location.state as { flash?: string } | null
  return (
    <p>
      Agenda {location.search} {state?.flash}
    </p>
  )
}

const created = meAppt({ time: '12:30', client: { ...meAppt().client, name: 'Carlos Gómez' } })

function renderNew(extra: Record<string, Handler> = {}) {
  const calls = stubApi({
    ...meHandler,
    'GET /api/v1/public/services': () => json(200, SERVICES),
    'GET /api/v1/me/next-free': () => json(200, { starts_at: `${TODAY}T12:30:00-05:00` }),
    'GET /api/v1/me/availability': ({ query }) =>
      json(200, {
        date: query.get('date'),
        slots: [
          { starts_at: `${query.get('date')}T14:00:00-05:00` },
          { starts_at: `${query.get('date')}T14:30:00-05:00` },
        ],
      }),
    'POST /api/v1/me/appointments': () => json(201, created),
    ...extra,
  })
  renderWithApp(
    <Routes>
      <Route path="/barbero/nueva" element={<NewAppointmentPage />} />
      <Route path="/barbero" element={<Agenda />} />
    </Routes>,
    '/barbero/nueva',
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

const service = (name: string) =>
  screen.findByRole('button', { name: new RegExp(`^${name.replace('+', '\\+')}`) })

describe('Nueva cita del barbero', () => {
  it('el interruptor "Turno sin cita" es un switch que oculta día y hora y muestra la hora de inicio', async () => {
    const calls = renderNew()
    fireEvent.click(await service('Corte básico'))
    expect(await screen.findByRole('group', { name: 'Horarios disponibles' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Día y hora' })).toBeTruthy()

    const toggle = screen.getByRole('switch', { name: 'Turno sin cita' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('true')

    expect(await screen.findByText('Empiezas a las 12:30 pm')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Día y hora' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Días disponibles' })).toBeNull()
    expect(calls.some((c) => c.path === '/api/v1/me/next-free')).toBe(true)
  })

  it('guarda un turno sin cita (walk_in, sin hora) y vuelve a la agenda con aviso', async () => {
    const calls = renderNew()
    fireEvent.click(screen.getByRole('switch', { name: 'Turno sin cita' }))
    fireEvent.click(await service('Corte + barba'))
    await screen.findByText('Empiezas a las 12:30 pm')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  Carlos   Gómez ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cita' }))

    expect(await screen.findByText(/^Agenda \?fecha=/)).toBeTruthy()
    const post = calls.find((c) => c.method === 'POST')
    expect(post?.body).toEqual({
      service_id: SERVICES[1]!.id,
      client: { name: 'Carlos Gómez', phone: null },
      walk_in: true,
      source: 'walk_in',
    })
    expect(screen.getByText(/Cita guardada: Carlos Gómez · 12:30 pm\./)).toBeTruthy()
    expect(screen.getByText(new RegExp(`fecha=${TODAY}`))).toBeTruthy()
  })

  it('con el interruptor apagado se elige día y hora del propio barbero', async () => {
    const calls = renderNew()
    fireEvent.click(await service('Corte básico'))
    const slots = await screen.findByRole('group', { name: 'Horarios disponibles' })
    fireEvent.click(within(slots).getByRole('button', { name: '2:30 pm' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Pedro Ruiz' } })
    fireEvent.change(screen.getByLabelText('Celular (WhatsApp, opcional)'), {
      target: { value: '300 555 1212' },
    })
    expect(
      screen.getByText('Con celular, el cliente recibe el recordatorio por WhatsApp.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cita' }))

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true))
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      service_id: SERVICES[0]!.id,
      client: { name: 'Pedro Ruiz', phone: '3005551212' },
      walk_in: false,
      source: 'manual',
      starts_at: `${TODAY}T14:30:00-05:00`,
    })
    // Disponibilidad del propio barbero, no la pública.
    expect(calls.some((c) => c.path === '/api/v1/public/availability')).toBe(false)
  })

  it('exige el nombre y el servicio, y valida el celular si se escribe', async () => {
    const calls = renderNew()
    await service('Corte básico')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cita' }))
    expect(await screen.findByText(/Escribe el nombre del cliente/)).toBeTruthy()
    expect(screen.getByText('Elige el servicio.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Celular (WhatsApp, opcional)'), {
      target: { value: '123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cita' }))
    expect(await screen.findByText('Escribe un celular colombiano de 10 dígitos.')).toBeTruthy()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('si el horario se ocupó, avisa y ofrece alternativas', async () => {
    renderNew({
      'POST /api/v1/me/appointments': () =>
        apiError(409, 'slot_unavailable', 'Ese horario ya no está disponible.', {
          alternatives: [{ starts_at: `${TODAY}T15:00:00-05:00`, barber_ids: [] }],
        }),
    })
    fireEvent.click(await service('Corte básico'))
    const slots = await screen.findByRole('group', { name: 'Horarios disponibles' })
    fireEvent.click(within(slots).getByRole('button', { name: '2:00 pm' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Pedro Ruiz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cita' }))
    expect(await screen.findByText('Ese horario ya no está disponible.')).toBeTruthy()
    const alternatives = screen.getByRole('group', { name: 'Horarios cercanos disponibles' })
    expect(within(alternatives).getByRole('button', { name: '3:00 pm' })).toBeTruthy()
  })

  it('turno sin cita sin tiempo libre muestra el mensaje del servidor', async () => {
    renderNew({
      'GET /api/v1/me/next-free': () =>
        apiError(409, 'no_free_time', 'Hoy ya no tienes tiempo libre para este servicio.'),
    })
    fireEvent.click(screen.getByRole('switch', { name: 'Turno sin cita' }))
    fireEvent.click(await service('Corte básico'))
    expect(
      await screen.findByText('Hoy ya no tienes tiempo libre para este servicio.'),
    ).toBeTruthy()
  })
})
