import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { apiError, json, stubApi } from '../../test/api'
import type { Handler } from '../../test/api'
import { renderWithApp } from '../../test/barber'
import ServicesPage from './ServicesPage'

const VAP = { id: 'r1', name: 'Vaporizador' }
const svc = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  description: null,
  price_cop: 22_000,
  duration_min: 30,
  resource_id: null,
  active: true,
  sort: 0,
  ...extra,
})
const LIST = {
  items: [
    svc('s1', 'Corte básico'),
    svc('s2', 'Corte + limpieza facial', {
      price_cop: 50_000,
      duration_min: 60,
      resource_id: 'r1',
    }),
    svc('s3', 'Barba', { active: false }),
  ],
  resources: [VAP],
}

function renderPage(extra: Record<string, Handler> = {}) {
  const calls = stubApi({
    'GET /api/v1/admin/services': () => json(200, LIST),
    ...extra,
  })
  const view = renderWithApp(<ServicesPage />)
  return { calls, ...view }
}

afterEach(() => vi.unstubAllGlobals())

describe('Servicios (admin)', () => {
  it('lista nombre, duración, precio y estado con palabras', async () => {
    const { container } = renderPage()
    await screen.findByRole('rowheader', { name: /Corte básico/ })
    const row = screen.getByRole('rowheader', { name: /Corte \+ limpieza facial/ }).closest('tr')!
    expect(within(row).getByText('60 min')).toBeTruthy()
    expect(within(row).getByText('$50.000')).toBeTruthy()
    expect(within(row).getByText('Nota: con vaporizador')).toBeTruthy()
    const hidden = screen.getByRole('rowheader', { name: /Barba/ }).closest('tr')!
    expect(within(hidden).getByText('Oculto para los clientes')).toBeTruthy()
    expect(
      within(hidden)
        .getByRole('switch', { name: /Visible para los clientes: Barba/ })
        .getAttribute('aria-checked'),
    ).toBe('false')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('las pestañas son enlaces y la actual lleva aria-current', async () => {
    renderPage()
    await screen.findByRole('rowheader', { name: /Corte básico/ })
    const tabs = screen.getByRole('navigation', { name: 'Sección' })
    expect(within(tabs).getByRole('link', { name: 'Productos' }).getAttribute('href')).toBe(
      '/admin/productos',
    )
  })

  it('sube y baja con botones y guarda el orden completo con PUT', async () => {
    const { calls } = renderPage({
      'PUT /api/v1/admin/services/order': () => json(200, LIST),
    })
    await screen.findByRole('rowheader', { name: /Corte básico/ })
    expect(
      (screen.getByRole('button', { name: 'Subir Corte básico' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Bajar Corte básico' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true))
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ ids: ['s2', 's1', 's3'] })
  })

  it('edita con el panel y envía solo lo escrito con PATCH', async () => {
    const { calls } = renderPage({
      'PATCH /api/v1/admin/services/s1': () =>
        json(200, svc('s1', 'Corte básico', { price_cop: 25_000 })),
    })
    await screen.findByRole('rowheader', { name: /Corte básico/ })
    fireEvent.click(screen.getByRole('button', { name: 'Editar Corte básico' }))
    const panel = await screen.findByRole('complementary', { name: 'Editar servicio' })
    fireEvent.change(within(panel).getByLabelText('Precio'), { target: { value: '25000' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Cambios guardados.')).toBeTruthy()
    expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({
      price_cop: 25_000,
      duration_min: 30,
    })
  })

  it('valida antes de enviar', async () => {
    const { calls } = renderPage()
    await screen.findByRole('rowheader', { name: /Corte básico/ })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar servicio' }))
    const panel = await screen.findByRole('complementary', { name: 'Agregar servicio' })
    fireEvent.change(within(panel).getByLabelText('Duración (min)'), { target: { value: '7' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Crear servicio' }))
    expect(await within(panel).findByText(/múltiplo de 5/)).toBeTruthy()
    expect(within(panel).getByText(/entre 2 y 60/)).toBeTruthy()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('ocultar pide confirmación; mostrar no', async () => {
    const { calls } = renderPage({
      'PATCH /api/v1/admin/services/s1': () =>
        json(200, svc('s1', 'Corte básico', { active: false })),
      'PATCH /api/v1/admin/services/s3': () => json(200, svc('s3', 'Barba')),
    })
    await screen.findByRole('rowheader', { name: /Corte básico/ })
    fireEvent.click(screen.getByRole('switch', { name: /Visible para los clientes: Corte básico/ }))
    const dialog = await screen.findByRole('dialog', { name: '¿Ocultar este servicio?' })
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ocultar servicio' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ active: false }),
    )
    fireEvent.click(screen.getByRole('switch', { name: /Visible para los clientes: Barba/ }))
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(2))
  })

  it('has_history se muestra tal cual con la acción Desactivar', async () => {
    const message = 'Este servicio tiene citas en el historial. Desactívalo en lugar de eliminarlo.'
    const { calls } = renderPage({
      'DELETE /api/v1/admin/services/s1': () => apiError(409, 'has_history', message),
      'PATCH /api/v1/admin/services/s1': () =>
        json(200, svc('s1', 'Corte básico', { active: false })),
    })
    await screen.findByRole('rowheader', { name: /Corte básico/ })
    fireEvent.click(screen.getByRole('button', { name: 'Editar Corte básico' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar servicio' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Eliminar este servicio?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, eliminar' }))
    expect((await screen.findByRole('alert')).textContent).toContain(message)
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ active: false }),
    )
  })

  it('avisa si hay cambios sin guardar al cambiar de pantalla', async () => {
    renderPage()
    await screen.findByRole('rowheader', { name: /Corte básico/ })
    fireEvent.click(screen.getByRole('button', { name: 'Editar Corte básico' }))
    const panel = await screen.findByRole('complementary', { name: 'Editar servicio' })
    fireEvent.change(within(panel).getByLabelText('Nombre'), { target: { value: 'Otro nombre' } })
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Sección' })).getByRole('link', {
        name: 'Productos',
      }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Tienes cambios sin guardar' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Seguir editando' }))
    expect(screen.queryByRole('dialog', { name: 'Tienes cambios sin guardar' })).toBeNull()
    // También al pulsar Cancelar con cambios.
    fireEvent.click(within(panel).getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByRole('dialog', { name: 'Tienes cambios sin guardar' })).toBeTruthy()
  })
})
