import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { createQueryClient } from '../lib/api/queryClient'
import { json, stubApi } from '../test/api'
import { AppRoutes } from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { SkipLink } from './SkipLink'

function renderAt(path: string) {
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <SkipLink />
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('título de página por ruta', () => {
  const empty = () => json(200, [])
  const cases: Array<[string, string]> = [
    ['/', 'Agendar cita · Imperio Barber'],
    ['/productos', 'Productos · Imperio Barber'],
    ['/privacidad', 'Política de privacidad · Imperio Barber'],
    ['/offline', 'Sin conexión · Imperio Barber'],
    ['/ingresar', 'Ingresar · Imperio Barber'],
    ['/no-existe', 'Página no encontrada · Imperio Barber'],
  ]
  it.each(cases)('%s -> %s', async (path, title) => {
    stubApi({
      'GET /api/v1/public/services': empty,
      'GET /api/v1/public/barbers': empty,
      'GET /api/v1/public/products': empty,
      'GET /api/v1/public/business': () => json(200, {}),
      'GET /api/v1/auth/me': () => json(401, { code: 'x', message: 'x', details: {} }),
    })
    renderAt(path)
    await waitFor(() => expect(document.title).toBe(title))
  })

  it('cada título es distinto', () => {
    expect(new Set(cases.map(([, title]) => title)).size).toBe(cases.length)
  })
})

describe('Saltar al contenido', () => {
  it('es el primer enlace y lleva el foco al contenido principal', async () => {
    stubApi({ 'GET /api/v1/public/products': () => json(200, []) })
    renderAt('/productos')
    const skip = screen.getByRole('link', { name: 'Saltar al contenido' })
    expect(document.body.querySelector('a, button, input')).toBe(skip)
    expect(skip.getAttribute('href')).toBe('#contenido')
    fireEvent.click(skip)
    const main = screen.getByRole('main')
    expect(main.id).toBe('contenido')
    expect(document.activeElement).toBe(main)
  })

  it('pasa axe', async () => {
    stubApi({ 'GET /api/v1/public/products': () => json(200, []) })
    const { container } = renderAt('/productos')
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('ErrorBoundary global', () => {
  it('muestra un mensaje amable y «Reintentar» vuelve a pintar la app', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    let broken = true
    function Child() {
      if (broken) throw new Error('boom')
      return <p>Todo bien</p>
    }
    render(
      <ErrorBoundary>
        <Child />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('heading', { name: 'Algo salió mal', level: 1 })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/No es tu culpa/)
    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/')
    expect(document.title).toBe('Algo salió mal · Imperio Barber')

    broken = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(screen.getByText('Todo bien')).toBeTruthy()
    error.mockRestore()
  })

  it('no estorba cuando no hay errores', () => {
    render(
      <ErrorBoundary>
        <p>Contenido</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Contenido')).toBeTruthy()
  })
})
