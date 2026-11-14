import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { apiError, json, stubApi } from '../../test/api'
import type { Handler } from '../../test/api'
import { renderWithApp } from '../../test/barber'
import OverviewPage from './OverviewPage'

const DAYS = [
  ['2026-11-16', 49_000, 3],
  ['2026-11-17', 27_000, 2],
  ['2026-11-18', 0, 0],
  ['2026-11-19', 0, 2],
  ['2026-11-20', 0, 0],
  ['2026-11-21', 120_000, 0],
  ['2026-11-22', 0, 1],
].map(([date, revenue_cop, count]) => ({ date, revenue_cop, count }))

const OVERVIEW = {
  date_from: '2026-11-16',
  date_to: '2026-11-22',
  revenue_cop: 1_392_000,
  projected_cop: 81_000,
  appointments: { total: 52, attended: 48, no_show: 4, cancelled: 3, booked: 0 },
  attendance_rate: 0.9231,
  revenue_by_day: DAYS,
  top_services: [
    { service_id: 's1', name: 'Corte básico', count: 21, revenue_cop: 462_000 },
    { service_id: 's2', name: 'Corte + barba', count: 15, revenue_cop: 405_000 },
  ],
  by_barber: [
    { barber_id: 'b1', display_name: 'Barbero 1', count: 27, revenue_cop: 712_000, no_show: 2 },
    { barber_id: 'b2', display_name: 'Barbero 2', count: 25, revenue_cop: 680_000, no_show: 2 },
  ],
  new_clients: 12,
}

function renderPage(extra: Record<string, Handler> = {}) {
  const calls = stubApi({ 'GET /api/v1/admin/overview': () => json(200, OVERVIEW), ...extra })
  const view = renderWithApp(<OverviewPage />)
  return { calls, ...view }
}

const overviewCalls = (calls: { path: string; query: URLSearchParams }[]) =>
  calls.filter((c) => c.path === '/api/v1/admin/overview')

afterEach(() => vi.unstubAllGlobals())

describe('Resumen (admin)', () => {
  it('pide la semana actual sin fechas y muestra las tarjetas con formatCOP', async () => {
    const { calls, container } = renderPage()
    await screen.findByRole('heading', { name: 'Servicios más pedidos' })
    const first = overviewCalls(calls)[0]
    expect(first?.query.has('from')).toBe(false)
    const cards = screen.getByRole('region', { name: 'Indicadores' })
    expect(within(cards).getByText('$1.392.000')).toBeTruthy()
    expect(within(cards).getByText(/Pendientes por cobrar: \$81\.000/)).toBeTruthy()
    expect(within(cards).getByText('52')).toBeTruthy()
    expect(within(cards).getByText(/48 atendidas · 4 no asistieron/)).toBeTruthy()
    expect(within(cards).getByText('92%')).toBeTruthy()
    expect(within(cards).getByText('4 inasistencias de 52 citas')).toBeTruthy()
    expect(within(cards).getByText('12')).toBeTruthy()
    expect(screen.getByText('Semana del 16 al 22 de noviembre')).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('el gráfico es SVG propio con una barra por día con ingresos y una tabla equivalente oculta', async () => {
    const { container } = renderPage()
    const chart = await screen.findByRole('img', {
      name: /Ingresos por día, 7 días, total \$196\.000/,
    })
    expect(chart.tagName.toLowerCase()).toBe('svg')
    expect(chart.querySelectorAll('rect')).toHaveLength(3) // los días en cero no dibujan barra
    expect(chart.textContent).toContain('$120.000')
    expect(screen.getByText('Pico: sábado')).toBeTruthy()
    // Tabla equivalente: visualmente oculta pero con los siete días, incluso los de cero.
    const table = container.querySelector('.sr-only table') as HTMLElement
    expect(within(table).getAllByRole('row')).toHaveLength(8) // encabezado + 7 días
    expect(within(table).getByRole('columnheader', { name: 'Ingresos' })).toBeTruthy()
    expect(within(table).getByText('2026-11-18')).toBeTruthy()
    expect(within(table).getAllByText('$0')).toHaveLength(4)
  })

  it('ranking de servicios y tabla por barbero', async () => {
    renderPage()
    const ranking = await screen.findByRole('list')
    expect(within(ranking).getByText('Corte básico')).toBeTruthy()
    expect(within(ranking).getByText('21 citas')).toBeTruthy()
    const row = screen.getByRole('rowheader', { name: 'Barbero 1' }).closest('tr') as HTMLElement
    expect(within(row).getByText('27')).toBeTruthy()
    expect(within(row).getByText('$712.000')).toBeTruthy()
  })

  it('Este mes pide el mes completo; Personalizado espera dos fechas válidas', async () => {
    const { calls } = renderPage()
    await screen.findByRole('heading', { name: 'Servicios más pedidos' })
    const group = screen.getByRole('group', { name: 'Periodo' })
    expect(
      within(group).getByRole('button', { name: 'Esta semana' }).getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.click(within(group).getByRole('button', { name: 'Este mes' }))
    await waitFor(() =>
      expect(overviewCalls(calls).some((c) => c.query.get('from')?.endsWith('-01'))).toBe(true),
    )
    const month = overviewCalls(calls).find((c) => c.query.has('from'))
    expect(Number(month?.query.get('to')?.slice(8))).toBeGreaterThanOrEqual(28)

    fireEvent.click(within(group).getByRole('button', { name: 'Personalizado' }))
    expect(await screen.findByText('Elige las dos fechas para ver el resumen.')).toBeTruthy()
    const before = overviewCalls(calls).length
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-20' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-10' } })
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(overviewCalls(calls)).toHaveLength(before) // el rango inválido no llega al servidor
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-25' } })
    await waitFor(() =>
      expect(
        overviewCalls(calls).some(
          (c) => c.query.get('from') === '2026-11-20' && c.query.get('to') === '2026-11-25',
        ),
      ).toBe(true),
    )
  })

  it('muestra el error del servidor y los periodos sin datos', async () => {
    renderPage({
      'GET /api/v1/admin/overview': () =>
        apiError(422, 'range_too_large', 'El rango máximo es de 366 días.'),
    })
    expect((await screen.findByRole('alert')).textContent).toContain(
      'El rango máximo es de 366 días.',
    )
  })

  it('un periodo vacío dice "Sin datos" en asistencia y no inventa ingresos', async () => {
    renderPage({
      'GET /api/v1/admin/overview': () =>
        json(200, {
          ...OVERVIEW,
          revenue_cop: 0,
          projected_cop: 0,
          appointments: { total: 0, attended: 0, no_show: 0, cancelled: 0, booked: 0 },
          attendance_rate: null,
          revenue_by_day: DAYS.map((d) => ({ ...d, revenue_cop: 0, count: 0 })),
          top_services: [],
          by_barber: [],
          new_clients: 0,
        }),
    })
    expect(await screen.findByText('Sin datos')).toBeTruthy()
    expect(screen.getByText('Sin ingresos en el periodo')).toBeTruthy()
    expect(screen.getAllByText('Todavía no hay citas en este periodo.')).toHaveLength(2)
  })
})
