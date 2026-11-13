import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { apiError, json, stubApi } from '../../test/api'
import type { Handler } from '../../test/api'
import { renderWithApp } from '../../test/barber'
import ProductsPage from './ProductsPage'

const prod = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  description: null,
  price_cop: 18_000,
  availability: 'in_stock',
  image_url: null,
  active: true,
  sort: 0,
  ...extra,
})
const LIST = {
  items: [
    prod('p1', 'Pomada'),
    prod('p2', 'Cera mate', { availability: 'out_of_stock' }),
    prod('p3', 'Aceite', { active: false }),
  ],
}

function renderPage(extra: Record<string, Handler> = {}) {
  const calls = stubApi({ 'GET /api/v1/admin/products': () => json(200, LIST), ...extra })
  const view = renderWithApp(<ProductsPage />)
  return { calls, ...view }
}

afterEach(() => vi.unstubAllGlobals())

describe('Productos (admin)', () => {
  it('muestra la disponibilidad con palabra e ícono y no tiene violaciones axe', async () => {
    const { container } = renderPage()
    await screen.findByRole('rowheader', { name: /Pomada/ })
    expect(screen.getByText('Agotado')).toBeTruthy()
    expect(screen.getAllByText('Disponible').length).toBeGreaterThan(0)
    expect(screen.getByText('Oculto para los clientes')).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('crea un producto con el panel', async () => {
    const { calls } = renderPage({
      'POST /api/v1/admin/products': () => json(201, prod('p4', 'Shampoo')),
    })
    await screen.findByRole('rowheader', { name: /Pomada/ })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar producto' }))
    const panel = await screen.findByRole('complementary', { name: 'Agregar producto' })
    fireEvent.change(within(panel).getByLabelText('Nombre'), { target: { value: 'Shampoo' } })
    fireEvent.change(within(panel).getByLabelText('Precio'), { target: { value: '25000' } })
    fireEvent.click(within(panel).getByRole('switch', { name: 'Hay en inventario' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Crear producto' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true))
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({
      name: 'Shampoo',
      price_cop: 25_000,
      availability: 'out_of_stock',
      image_url: null,
    })
  })

  it('rechaza una imagen que no es https antes de enviar', async () => {
    const { calls } = renderPage()
    await screen.findByRole('rowheader', { name: /Pomada/ })
    fireEvent.click(screen.getByRole('button', { name: 'Editar Pomada' }))
    const panel = await screen.findByRole('complementary', { name: 'Editar producto' })
    fireEvent.change(within(panel).getByLabelText('Enlace de la foto'), {
      target: { value: 'http://x.co/a.jpg' },
    })
    fireEvent.click(within(panel).getByRole('button', { name: 'Guardar cambios' }))
    expect(await within(panel).findByText(/https:\/\//, { selector: 'span' })).toBeTruthy()
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
  })

  it('ocultar pide confirmación y eliminar también', async () => {
    const { calls } = renderPage({
      'PATCH /api/v1/admin/products/p1': () => json(200, prod('p1', 'Pomada', { active: false })),
      'DELETE /api/v1/admin/products/p2': () => new Response(null, { status: 204 }),
    })
    await screen.findByRole('rowheader', { name: /Pomada/ })
    fireEvent.click(screen.getByRole('switch', { name: /Visible para los clientes: Pomada/ }))
    const dialog = await screen.findByRole('dialog', { name: '¿Ocultar este producto?' })
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ocultar producto' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ active: false }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar Cera mate' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar producto' }))
    const confirm = await screen.findByRole('dialog', { name: '¿Eliminar este producto?' })
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
    fireEvent.click(within(confirm).getByRole('button', { name: 'Sí, eliminar' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true))
  })

  it('sube y baja con botones y guarda el orden completo', async () => {
    const { calls } = renderPage({ 'PUT /api/v1/admin/products/order': () => json(200, LIST) })
    await screen.findByRole('rowheader', { name: /Pomada/ })
    fireEvent.click(screen.getByRole('button', { name: 'Subir Cera mate' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true))
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ ids: ['p2', 'p1', 'p3'] })
  })

  it('muestra el error del servidor al guardar', async () => {
    renderPage({
      'PATCH /api/v1/admin/products/p1': () =>
        apiError(422, 'validation_error', 'Revisa los datos enviados.'),
    })
    await screen.findByRole('rowheader', { name: /Pomada/ })
    fireEvent.click(screen.getByRole('button', { name: 'Editar Pomada' }))
    const panel = await screen.findByRole('complementary', { name: 'Editar producto' })
    fireEvent.change(within(panel).getByLabelText('Nombre'), { target: { value: 'Pomada fuerte' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Guardar cambios' }))
    expect((await within(panel).findByRole('alert')).textContent).toContain('Revisa los datos')
  })
})
