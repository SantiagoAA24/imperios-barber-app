import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { apiError, json, stubApi } from '../../test/api'
import type { Handler } from '../../test/api'
import { renderWithApp } from '../../test/barber'
import BarbersPage from './BarbersPage'

const barber = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  display_name: name,
  email: `${name.toLowerCase()}@imperio.test`,
  visible_in_booking: true,
  active: true,
  must_change_password: false,
  ...extra,
})
const LIST = { items: [barber('b1', 'Ana'), barber('b2', 'Beto', { visible_in_booking: false })] }

function renderPage(extra: Record<string, Handler> = {}) {
  const calls = stubApi({ 'GET /api/v1/admin/barbers': () => json(200, LIST), ...extra })
  const view = renderWithApp(<BarbersPage />)
  return { calls, ...view }
}

afterEach(() => vi.unstubAllGlobals())

describe('Barberos (admin)', () => {
  it('lista con interruptores y no tiene violaciones axe', async () => {
    const { container } = renderPage()
    await screen.findByRole('rowheader', { name: /Ana/ })
    expect(
      screen.getByRole('switch', { name: 'Aparece al agendar: Beto' }).getAttribute('aria-checked'),
    ).toBe('false')
    expect(screen.getByRole('switch', { name: 'Activo: Ana' }).getAttribute('aria-checked')).toBe(
      'true',
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('al crear muestra la clave una sola vez con Copiar y la advertencia', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { calls } = renderPage({
      'POST /api/v1/admin/barbers': () =>
        json(201, { barber: barber('b3', 'Carlos'), temporary_password: 'Abcd2345efgh' }),
    })
    await screen.findByRole('rowheader', { name: /Ana/ })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar barbero' }))
    const form = await screen.findByRole('form', { name: 'Agregar barbero' })
    fireEvent.change(within(form).getByLabelText('Nombre'), { target: { value: 'Carlos' } })
    fireEvent.change(within(form).getByLabelText('Correo'), {
      target: { value: 'carlos@imperio.test' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Crear barbero' }))
    expect(await screen.findByText('Abcd2345efgh')).toBeTruthy()
    expect(screen.getByText('No volverás a ver esta clave.')).toBeTruthy()
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({
      display_name: 'Carlos',
      email: 'carlos@imperio.test',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Abcd2345efgh'))
    expect(await screen.findByText('Clave copiada.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ya la copié' }))
    expect(screen.queryByText('Abcd2345efgh')).toBeNull()
  })

  it('valida nombre y correo antes de enviar', async () => {
    const { calls } = renderPage()
    await screen.findByRole('rowheader', { name: /Ana/ })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar barbero' }))
    const form = await screen.findByRole('form', { name: 'Agregar barbero' })
    fireEvent.change(within(form).getByLabelText('Correo'), { target: { value: 'sin-arroba' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Crear barbero' }))
    expect(await within(form).findByText('Escribe un correo válido.')).toBeTruthy()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('un correo repetido muestra el mensaje del servidor', async () => {
    renderPage({
      'POST /api/v1/admin/barbers': () =>
        apiError(409, 'email_taken', 'Ya existe una cuenta con ese correo.'),
    })
    await screen.findByRole('rowheader', { name: /Ana/ })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar barbero' }))
    const form = await screen.findByRole('form', { name: 'Agregar barbero' })
    fireEvent.change(within(form).getByLabelText('Nombre'), { target: { value: 'Ana' } })
    fireEvent.change(within(form).getByLabelText('Correo'), { target: { value: 'a@b.co' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Crear barbero' }))
    expect((await within(form).findByRole('alert')).textContent).toContain('Ya existe una cuenta')
  })

  it('desactivar pide confirmación y muestra los conflicts[]', async () => {
    const { calls } = renderPage({
      'PATCH /api/v1/admin/barbers/b1': () =>
        json(200, {
          barber: barber('b1', 'Ana', { active: false }),
          conflicts: [
            {
              appointment_id: 'a1',
              starts_at: '2026-11-16T10:00:00-05:00',
              ends_at: '2026-11-16T10:30:00-05:00',
              client_name: 'Juan Pérez',
              service_name: 'Corte básico',
            },
          ],
        }),
    })
    await screen.findByRole('rowheader', { name: /Ana/ })
    fireEvent.click(screen.getByRole('switch', { name: 'Activo: Ana' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Desactivar a este barbero?' })
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desactivar barbero' }))
    const region = await screen.findByRole('region', { name: 'Citas pendientes de Ana' })
    expect(within(region).getByText(/1 cita futura reservada/)).toBeTruthy()
    expect(within(region).getByText('Juan Pérez')).toBeTruthy()
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ active: false })
  })

  it('reiniciar la clave pide confirmación y muestra la clave nueva una vez', async () => {
    renderPage({
      'POST /api/v1/admin/barbers/b2/reset-password': () =>
        json(200, { temporary_password: 'Zxcv6789mnbq' }),
    })
    await screen.findByRole('rowheader', { name: /Beto/ })
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar clave de Beto' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Reiniciar la clave?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, reiniciar clave' }))
    expect(await screen.findByText('Zxcv6789mnbq')).toBeTruthy()
  })

  it('"Aparece al agendar" se guarda sin confirmación', async () => {
    const { calls } = renderPage({
      'PATCH /api/v1/admin/barbers/b2': () =>
        json(200, { barber: barber('b2', 'Beto'), conflicts: [] }),
    })
    await screen.findByRole('rowheader', { name: /Beto/ })
    fireEvent.click(screen.getByRole('switch', { name: 'Aparece al agendar: Beto' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ visible_in_booking: true }),
    )
  })
})
