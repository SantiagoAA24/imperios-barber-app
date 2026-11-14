import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../lib/api/queryClient'
import { BARBERS, BUSINESS, json, SERVICES, stubApi } from '../test/api'
import { headingLevels, skippedHeadings } from '../test/headings'
import { AppRoutes } from './App'

afterEach(() => vi.unstubAllGlobals())

function renderAt(path: string) {
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const PRODUCTS = [
  {
    id: 'p1',
    name: 'Cera mate',
    description: null,
    price_cop: 28000,
    availability: 'in_stock',
    image_url: null,
  },
  {
    id: 'p2',
    name: 'Bálsamo',
    description: null,
    price_cop: 30000,
    availability: 'out_of_stock',
    image_url: null,
  },
]

describe('jerarquía de encabezados', () => {
  it('skippedHeadings detecta los saltos', () => {
    expect(skippedHeadings([1, 2, 3, 2, 3])).toEqual([])
    expect(skippedHeadings([1, 3])).toEqual(['h1 -> h3'])
    expect(skippedHeadings([2, 3])).toEqual(['empieza en h2'])
  })

  it('/productos: los nombres de producto cuelgan del h1 sin saltarse un nivel', async () => {
    stubApi({ 'GET /api/v1/public/products': () => json(200, PRODUCTS) })
    const { container } = renderAt('/productos')
    await waitFor(() => expect(screen.getAllByRole('article').length).toBeGreaterThan(0))
    const levels = headingLevels(container)
    expect(levels.filter((l) => l === 1)).toHaveLength(1)
    expect(skippedHeadings(levels)).toEqual([])
  })

  it('/: pasos y secciones sin saltos', async () => {
    stubApi({
      'GET /api/v1/public/services': () => json(200, SERVICES),
      'GET /api/v1/public/barbers': () => json(200, BARBERS),
      'GET /api/v1/public/business': () => json(200, BUSINESS),
    })
    const { container } = renderAt('/')
    await screen.findByRole('group', { name: 'Servicios' })
    expect(skippedHeadings(headingLevels(container))).toEqual([])
  })

  it('/privacidad y /offline', () => {
    for (const path of ['/privacidad', '/offline', '/no-existe']) {
      const { container, unmount } = renderAt(path)
      expect(skippedHeadings(headingLevels(container)), path).toEqual([])
      unmount()
    }
  })
})
