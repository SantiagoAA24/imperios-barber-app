import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../lib/api/queryClient'
import { addDays, bogotaDay } from '../../lib/format'
import { apiError, appointment, BUSINESS, json, stubApi } from '../../test/api'
import type { Call, Handler } from '../../test/api'
import { AppointmentPage } from './AppointmentPage'

const TOKEN = 'tok123'
const TOMORROW = addDays(bogotaDay(new Date()), 1)
const slot = (time: string) => ({
  starts_at: `${TOMORROW}T${time}-05:00`,
  barber_ids: [],
})

function renderPage(get: Handler, extra: Record<string, Handler> = {}) {
  const calls = stubApi({
    [`GET /api/v1/public/appointments/${TOKEN}`]: get,
    'GET /api/v1/public/business': () => json(200, BUSINESS),
    'GET /api/v1/public/availability': ({ query }) =>
      json(200, {
        date: query.get('date'),
        slots: query.get('date') === TOMORROW ? [slot('09:00:00'), slot('09:30:00')] : [],
      }),
    ...extra,
  })
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/cita/${TOKEN}`]}>
        <Routes>
          <Route path="/cita/:token" element={<AppointmentPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return calls
}

const booked = () => json(200, appointment())

afterEach(() => vi.unstubAllGlobals())

describe('cita reservada', () => {
  it('muestra el resumen, la tolerancia del negocio y nunca el celular', async () => {
    renderPage(booked)
    expect(
      await screen.findByRole('heading', { name: 'Tu cita está lista', level: 1 }),
    ).toBeTruthy()
    const card = screen.getByLabelText('Resumen de tu cita')
    expect(within(card).getByText('viernes 13 nov')).toBeTruthy()
    expect(within(card).getByText('11:00 am')).toBeTruthy()
    expect(within(card).getByText('Corte + barba')).toBeTruthy()
    expect(within(card).getByText('Barbero 1')).toBeTruthy()
    expect(within(card).getByText('$27.000')).toBeTruthy()
    expect(
      await screen.findByText('Llega a tu hora: esperamos hasta 5 minutos después.'),
    ).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/\+57|celular/i)
  })

  it('usa la tolerancia que trae el negocio, no un número fijo', async () => {
    renderPage(booked, {
      'GET /api/v1/public/business': () => json(200, { ...BUSINESS, tolerance_min: 10 }),
    })
    expect(
      await screen.findByText('Llega a tu hora: esperamos hasta 10 minutos después.'),
    ).toBeTruthy()
  })

  it('habilita las acciones según can_cancel y can_reschedule', async () => {
    renderPage(() => json(200, appointment({ can_cancel: false, can_reschedule: false })))
    await screen.findByRole('heading', { name: 'Tu cita está lista' })
    expect(
      (screen.getByRole('button', { name: 'Reprogramar' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Cancelar cita' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Agregar al calendario' }) as HTMLButtonElement).disabled,
    ).toBe(false)
    expect(screen.getByText(/escríbele al local/)).toBeTruthy()
  })

  it('cancelar: abre el diálogo, llama a /cancel y muestra "Cita cancelada"', async () => {
    let status = 'booked'
    const calls = renderPage(() => json(200, appointment({ status })), {
      [`POST /api/v1/public/appointments/${TOKEN}/cancel`]: () => {
        status = 'cancelled'
        return json(200, appointment({ status, can_cancel: false, can_reschedule: false }))
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar cita' }))
    const dialog = screen.getByRole('dialog', { name: '¿Cancelar tu cita?' })
    expect(
      within(dialog).getByText('Si cancelas, ese horario queda libre para otros clientes.'),
    ).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, cancelar cita' }))
    expect(await screen.findByRole('heading', { name: 'Cita cancelada', level: 1 })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Agendar otra cita' }).getAttribute('href')).toBe('/')
    expect(screen.queryByRole('button', { name: 'Cancelar cita' })).toBeNull()
    expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/cancel'))).toBe(true)
    // El foco pasa al título porque el botón que lo tenía ya no existe.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })),
    )
  })

  it('"Mantener mi cita" cierra el diálogo y devuelve el foco al botón', async () => {
    const calls = renderPage(booked)
    const trigger = await screen.findByRole('button', { name: 'Cancelar cita' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Mantener mi cita' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('409 too_late_to_cancel: muestra el mensaje de la API en un Notice y cierra el diálogo', async () => {
    const message = 'Para cancelar con menos de 1 hora de anticipación, escríbele al local.'
    renderPage(booked, {
      [`POST /api/v1/public/appointments/${TOKEN}/cancel`]: () =>
        apiError(409, 'too_late_to_cancel', message),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar cita' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, cancelar cita' }),
    )
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(message)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Tu cita está lista' })).toBeTruthy()
  })

  it('error de red al cancelar: avisa dentro del diálogo y permite reintentar', async () => {
    let attempt = 0
    renderPage(booked, {
      [`POST /api/v1/public/appointments/${TOKEN}/cancel`]: () => {
        attempt += 1
        if (attempt === 1) throw new TypeError('Failed to fetch')
        return json(200, appointment({ status: 'cancelled' }))
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar cita' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, cancelar cita' }),
    )
    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos cancelar tu cita.')
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, cancelar cita' }),
    )
    expect(await screen.findByRole('heading', { name: 'Cita cancelada' })).toBeTruthy()
  })
})

describe('reprogramar', () => {
  it('usa el servicio y el barbero de la cita, y confirma con /reschedule', async () => {
    let current = appointment()
    const calls = renderPage(() => json(200, current), {
      [`POST /api/v1/public/appointments/${TOKEN}/reschedule`]: ({ body }) => {
        current = appointment({ starts_at: (body as { starts_at: string }).starts_at })
        return json(200, current)
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Reprogramar' }))
    expect(screen.getByRole('heading', { name: 'Elige un nuevo horario' })).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: '9:30 am' }))
    const availability = calls.filter((c) => c.path.endsWith('/availability')) as Call[]
    expect(availability.length).toBe(7)
    for (const call of availability) {
      expect(call.query.get('service_id')).toBe(current.service.id)
      expect(call.query.get('barber_id')).toBe(current.barber!.id)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar nuevo horario' }))
    expect(await screen.findByText('Listo: cambiamos tu cita al nuevo horario.')).toBeTruthy()
    expect(within(screen.getByLabelText('Resumen de tu cita')).getByText('9:30 am')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Elige un nuevo horario' })).toBeNull()
  })

  it('409 slot_unavailable: aviso y alternativas, como al agendar', async () => {
    renderPage(booked, {
      [`POST /api/v1/public/appointments/${TOKEN}/reschedule`]: () =>
        apiError(409, 'slot_unavailable', 'Ese horario ya no está disponible.', {
          alternatives: [slot('10:00:00'), slot('10:30:00')],
        }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Reprogramar' }))
    fireEvent.click(await screen.findByRole('button', { name: '9:00 am' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar nuevo horario' }))
    expect(await screen.findByText('Ese horario se acaba de ocupar. Elige otro.')).toBeTruthy()
    const group = screen.getByRole('group', { name: 'Horarios cercanos disponibles' })
    expect(within(group).getAllByRole('button')).toHaveLength(2)
  })

  it('409 too_late_to_reschedule: muestra el mensaje de la API y cierra el panel', async () => {
    renderPage(booked, {
      [`POST /api/v1/public/appointments/${TOKEN}/reschedule`]: () =>
        apiError(
          409,
          'too_late_to_reschedule',
          'Para reprogramar con menos de 1 hora de anticipación, escríbele al local.',
        ),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Reprogramar' }))
    fireEvent.click(await screen.findByRole('button', { name: '9:00 am' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar nuevo horario' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Para reprogramar con menos de 1 hora',
    )
    expect(screen.queryByRole('heading', { name: 'Elige un nuevo horario' })).toBeNull()
  })
})

describe('otros estados', () => {
  it('cancelada: solo lectura, con enlace para agendar otra', async () => {
    renderPage(() =>
      json(200, appointment({ status: 'cancelled', can_cancel: false, can_reschedule: false })),
    )
    expect(await screen.findByRole('heading', { name: 'Cita cancelada' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reprogramar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agregar al calendario' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Agendar otra cita' })).toBeTruthy()
  })

  it.each([
    ['attended', 'Gracias por venir'],
    ['no_show', 'No pudimos atenderte'],
  ])('%s: solo lectura con mensaje amable', async (status, title) => {
    renderPage(() => json(200, appointment({ status, can_cancel: false, can_reschedule: false })))
    expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cancelar cita' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reprogramar' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Agendar otra cita' })).toBeTruthy()
  })

  it('token inválido (404): aviso y enlace a "/"', async () => {
    renderPage(() => apiError(404, 'appointment_not_found', 'No encontramos esta cita.'))
    expect(await screen.findByRole('heading', { name: 'No encontramos tu cita' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Agendar una cita' }).getAttribute('href')).toBe('/')
  })

  it('error de red al cargar: aviso con "Reintentar"', async () => {
    let attempt = 0
    renderPage(() => {
      attempt += 1
      if (attempt === 1) throw new TypeError('Failed to fetch')
      return booked()
    })
    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos cargar tu cita.')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Tu cita está lista' })).toBeTruthy()
  })
})
