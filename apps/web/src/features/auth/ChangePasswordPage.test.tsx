import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../lib/api/queryClient'
import { apiError, json, stubApi } from '../../test/api'
import type { Handler } from '../../test/api'
import { ChangePasswordPage } from './ChangePasswordPage'

const me = (must: boolean) => ({
  id: 'u1',
  name: 'Carlos',
  role: 'barber',
  must_change_password: must,
})

function renderPage(handlers: Record<string, Handler>) {
  const calls = stubApi(handlers)
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/cambiar-clave']}>
        <Routes>
          <Route path="cambiar-clave" element={<ChangePasswordPage />} />
          <Route path="barbero" element={<p>Panel del barbero</p>} />
          <Route path="ingresar" element={<p>Pantalla de ingreso</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

async function fill(current: string, next: string, repeat: string) {
  fireEvent.change(await screen.findByLabelText('Clave temporal'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('Clave nueva'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('Repite la clave nueva'), { target: { value: repeat } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar clave' }))
}

describe('Cambiar clave', () => {
  it('sin sesión va a /ingresar', async () => {
    renderPage({
      'GET /api/v1/auth/me': () => apiError(401, 'not_authenticated', 'Inicia sesión.'),
    })
    expect(await screen.findByText('Pantalla de ingreso')).toBeTruthy()
  })

  it('si no hay clave pendiente, va al panel', async () => {
    renderPage({ 'GET /api/v1/auth/me': () => json(200, me(false)) })
    expect(await screen.findByText('Panel del barbero')).toBeTruthy()
  })

  it('exige 10 caracteres y que coincidan, sin llamar al servidor', async () => {
    const calls = renderPage({ 'GET /api/v1/auth/me': () => json(200, me(true)) })
    await fill('temporal', 'corta', 'otra')
    expect(await screen.findByText(/al menos 10 caracteres/)).toBeTruthy()
    expect(screen.getByText('Las dos claves nuevas no coinciden.')).toBeTruthy()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('cambia la clave y entra al panel', async () => {
    const calls = renderPage({
      'GET /api/v1/auth/me': () => json(200, me(true)),
      'POST /api/v1/auth/change-password': () => json(200, me(false)),
    })
    await fill('temporal-123', 'una-clave-larga-1', 'una-clave-larga-1')
    await waitFor(() => expect(screen.getByText('Panel del barbero')).toBeTruthy())
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      current: 'temporal-123',
      new: 'una-clave-larga-1',
    })
  })

  it('muestra el error del servidor si la clave temporal no es correcta', async () => {
    renderPage({
      'GET /api/v1/auth/me': () => json(200, me(true)),
      'POST /api/v1/auth/change-password': () =>
        apiError(403, 'invalid_current_password', 'La clave actual no es correcta.'),
    })
    await fill('mala', 'una-clave-larga-1', 'una-clave-larga-1')
    expect((await screen.findByRole('alert')).textContent).toContain(
      'La clave actual no es correcta',
    )
  })
})
