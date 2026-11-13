import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AGENDA_REFRESH_MS } from '../../lib/api/barber'
import { addDays } from '../../lib/format'
import { apiError, json, stubApi } from '../../test/api'
import type { Handler } from '../../test/api'
import { agendaOf, meAppt, meHandler, renderWithApp, TODAY } from '../../test/barber'
import { AgendaPage } from './AgendaPage'

const A = '55555555-0000-4000-8000-00000000000a'
const B = '55555555-0000-4000-8000-00000000000b'
const C = '55555555-0000-4000-8000-00000000000c'

const DAY = [
  meAppt({
    id: A,
    time: '09:00',
    status: 'attended',
    client: { ...meAppt().client, name: 'Mateo G.', phone_e164: null },
  }),
  meAppt({
    id: B,
    time: '10:00',
    is_overdue: true,
    client: { ...meAppt().client, name: 'Juan P.' },
  }),
  meAppt({
    id: C,
    time: '11:00',
    client: { ...meAppt().client, name: 'Carlos M.', phone_e164: null, phone_masked: null },
  }),
]

function renderAgenda(extra: Record<string, Handler> = {}) {
  const calls = stubApi({
    ...meHandler,
    'GET /api/v1/me/appointments': () => json(200, agendaOf(DAY)),
    ...(extra as Record<string, Handler>),
  })
  const view = renderWithApp(
    <Routes>
      <Route path="/barbero" element={<AgendaPage />} />
      <Route path="/barbero/nueva" element={<p>Pantalla nueva cita</p>} />
    </Routes>,
    '/barbero',
  )
  return { calls, ...view }
}

afterEach(() => vi.unstubAllGlobals())

describe('Agenda del día', () => {
  it('muestra resumen, citas ordenadas y cada estado con palabra', async () => {
    renderAgenda()
    expect(await screen.findByRole('heading', { name: 'Mi agenda', level: 1 })).toBeTruthy()
    expect(await screen.findByText('Hola, Barbero 1')).toBeTruthy()

    const summary = screen.getByLabelText('Resumen del día')
    expect(within(summary).getByText('Atendidas').previousSibling?.textContent).toBe('1')
    expect(within(summary).getByText('Pendientes').previousSibling?.textContent).toBe('2')
    expect(within(summary).getByText('Ingresos').previousSibling?.textContent).toBe('$22.000')

    const cards = screen.getAllByRole('article')
    expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual([
      'Mateo G.',
      'Juan P.',
      'Carlos M.',
    ])
    expect(within(cards[0]!).getByText('Atendida')).toBeTruthy()
    expect(within(cards[1]!).getByText('Vencida')).toBeTruthy()
    expect(within(cards[2]!).getByText('Pendiente')).toBeTruthy()
    expect(within(cards[0]!).getByText('9:00 am')).toBeTruthy()
    expect(within(cards[2]!).getByText(/Corte básico · 30 min · \$22\.000/)).toBeTruthy()
  })

  it('resalta como "Siguiente" la primera pendiente que no está vencida', async () => {
    renderAgenda()
    await screen.findAllByRole('article')
    const cards = screen.getAllByRole('article')
    expect(within(cards[2]!).getByText('Siguiente')).toBeTruthy()
    expect(within(cards[1]!).queryByText('Siguiente')).toBeNull()
    expect(screen.getAllByText('Siguiente')).toHaveLength(1)
  })

  it('"No asistió" solo aparece si el servidor marca la cita como vencida', async () => {
    renderAgenda()
    await screen.findAllByRole('article')
    const [attended, overdue, pending] = screen.getAllByRole('article') as HTMLElement[]
    expect(within(overdue!).getByRole('button', { name: 'No asistió' })).toBeTruthy()
    expect(within(pending!).queryByRole('button', { name: 'No asistió' })).toBeNull()
    expect(within(attended!).queryByRole('button')).toBeNull() // atendida: sin acciones
  })

  it('WhatsApp: enlace wa.me con mensaje y oculto si no hay celular', async () => {
    renderAgenda()
    await screen.findAllByRole('article')
    const [, overdue, pending] = screen.getAllByRole('article') as HTMLElement[]
    const link = within(overdue!).getByRole('link', { name: /WhatsApp a Juan P\./ })
    const url = new URL(link.getAttribute('href') ?? '')
    expect(url.origin + url.pathname).toBe('https://wa.me/573001234567')
    expect(url.searchParams.get('text')).toMatch(/^Hola Juan, .*hoy a las 10:00 am\.$/)
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(within(pending!).queryByRole('link', { name: /WhatsApp/ })).toBeNull()
    // El número completo solo vive en el enlace, nunca como texto.
    expect(document.body.textContent).not.toContain('3001234567')
  })

  it('marca "Atendida" de inmediato (optimista) y envía el PATCH', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const { calls } = renderAgenda({
      [`PATCH /api/v1/me/appointments/${B}`]: async () => {
        await gate
        return json(200, { ...DAY[1], status: 'attended', is_overdue: false })
      },
    })
    await screen.findAllByRole('article')
    const card = screen.getAllByRole('article')[1]!
    fireEvent.click(within(card).getByRole('button', { name: 'Atendida' }))

    // Antes de que responda el servidor la pantalla ya cambió.
    await waitFor(() =>
      expect(within(screen.getAllByRole('article')[1]!).getByText('Atendida')).toBeTruthy(),
    )
    const summary = screen.getByLabelText('Resumen del día')
    expect(within(summary).getByText('Atendidas').previousSibling?.textContent).toBe('2')
    expect(within(summary).getByText('Ingresos').previousSibling?.textContent).toBe('$44.000')

    release()
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true))
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'attended' })
  })

  it('si el API falla, revierte el cambio y muestra el motivo en la cita', async () => {
    renderAgenda({
      [`PATCH /api/v1/me/appointments/${C}`]: () =>
        apiError(
          409,
          'too_early_for_attended',
          'Solo puedes marcarla como atendida desde 15 minutos antes.',
        ),
    })
    await screen.findAllByRole('article')
    const card = screen.getAllByRole('article')[2]!
    fireEvent.click(within(card).getByRole('button', { name: 'Atendida' }))
    expect(
      await within(screen.getAllByRole('article')[2]!).findByText(
        'Solo puedes marcarla como atendida desde 15 minutos antes.',
      ),
    ).toBeTruthy()
    const after = screen.getAllByRole('article')[2]!
    expect(within(after).getByText('Pendiente')).toBeTruthy()
    const summary = screen.getByLabelText('Resumen del día')
    expect(within(summary).getByText('Atendidas').previousSibling?.textContent).toBe('1')
  })

  it('cancelar pide confirmación y solo entonces envía el PATCH', async () => {
    let cancelled = false
    const { calls } = renderAgenda({
      'GET /api/v1/me/appointments': () =>
        json(200, agendaOf(cancelled ? DAY.filter((a) => a.id !== C) : DAY)),
      [`PATCH /api/v1/me/appointments/${C}`]: () => {
        cancelled = true
        return json(200, { ...DAY[2], status: 'cancelled' })
      },
    })
    await screen.findAllByRole('article')
    const card = screen.getAllByRole('article')[2]!
    fireEvent.click(within(card).getByRole('button', { name: 'Cancelar' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Cancelar esta cita?' })
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Mantener cita' }))
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)

    fireEvent.click(within(card).getByRole('button', { name: 'Cancelar' }))
    const again = await screen.findByRole('dialog', { name: '¿Cancelar esta cita?' })
    fireEvent.click(within(again).getByRole('button', { name: 'Sí, cancelar cita' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'cancelled' }),
    )
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
  })

  it('navega entre días con anterior, hoy y siguiente', async () => {
    const { calls } = renderAgenda()
    await screen.findAllByRole('article')
    fireEvent.click(screen.getByRole('button', { name: 'Día siguiente' }))
    await waitFor(() =>
      expect(calls.some((c) => c.query.get('date') === addDays(TODAY, 1))).toBe(true),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Día anterior' }))
    fireEvent.click(screen.getByRole('button', { name: 'Día anterior' }))
    await waitFor(() =>
      expect(calls.some((c) => c.query.get('date') === addDays(TODAY, -1))).toBe(true),
    )
    fireEvent.click(screen.getByRole('button', { name: /Ir a hoy/ }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Hoy/ }).getAttribute('aria-current')).toBe('date'),
    )
  })

  it('sondea cada 30 s y se pausa con la pestaña oculta', async () => {
    const { client } = renderAgenda()
    await screen.findAllByRole('article')
    const query = client
      .getQueryCache()
      .getAll()
      .find((q) => q.queryKey[1] === 'agenda')
    expect(AGENDA_REFRESH_MS).toBe(30_000)
    const options = query?.options as
      { refetchInterval?: number; refetchIntervalInBackground?: boolean } | undefined
    expect(options?.refetchInterval).toBe(30_000)
    expect(options?.refetchIntervalInBackground).toBe(false)
  })

  it('indica cuándo se actualizó y permite actualizar a mano', async () => {
    const { calls } = renderAgenda()
    await screen.findAllByRole('article')
    expect(screen.getByText('Actualizado ahora')).toBeTruthy()
    const before = calls.filter((c) => c.path === '/api/v1/me/appointments').length
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() =>
      expect(calls.filter((c) => c.path === '/api/v1/me/appointments').length).toBeGreaterThan(
        before,
      ),
    )
  })

  it('día sin citas: aviso y atajo a registrar un turno sin cita', async () => {
    renderAgenda({ 'GET /api/v1/me/appointments': () => json(200, agendaOf([])) })
    expect(await screen.findByText('No tienes citas este día.')).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'Registrar un turno sin cita' }))
    expect(await screen.findByText('Pantalla nueva cita')).toBeTruthy()
  })

  it('error de carga: avisa y deja reintentar', async () => {
    renderAgenda({ 'GET /api/v1/me/appointments': () => apiError(500, 'internal_error', 'Falló') })
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })
})
