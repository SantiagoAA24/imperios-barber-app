import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const PASSWORD = 'cambiar-esto'

test.use({ viewport: { width: 1280, height: 800 } })

async function loginUi(page: Page, email: string, url: RegExp) {
  await page.goto('/ingresar')
  await page.getByLabel('Correo').fill(email)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(url)
}

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
}

/** Semana sembrada por app.seed_e2e: lunes 5 a domingo 11 de enero de 2026 (ver ese módulo). */
async function pickSeededWeek(page: Page) {
  await page
    .getByRole('group', { name: 'Periodo' })
    .getByRole('button', { name: 'Personalizado' })
    .click()
  await page.getByLabel('Desde').fill('2026-01-05')
  await page.getByLabel('Hasta').fill('2026-01-11')
  await expect(page.getByText('Del 5 al 11 de enero')).toBeVisible()
}

test.describe('Admin: resumen', () => {
  test('las cifras coinciden con las sembradas', async ({ page }) => {
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await expect(page.getByRole('heading', { name: 'Resumen', level: 1 })).toBeVisible()
    await pickSeededWeek(page)

    const cards = page.getByRole('region', { name: 'Indicadores' })
    // Ingresos: 49.000 + 22.000 + 27.000 + 57.000 = 155.000 (solo atendidas).
    await expect(cards).toContainText('$155.000')
    // Citas sin canceladas: 7 (6 atendidas, 1 no asistió); 1 cancelada.
    await expect(cards).toContainText('7')
    await expect(cards).toContainText('6 atendidas · 1 no asistió')
    await expect(cards).toContainText('1 cancelada')
    // Asistencia: 6 de (6 + 1) = 86 %.
    await expect(cards).toContainText('86%')
    await expect(cards).toContainText('1 inasistencia de 7 citas')
    // Clientes nuevos de esa semana: 3 (el cuarto cliente es de diciembre).
    await expect(
      cards.getByText('Clientes nuevos').locator('xpath=following-sibling::span[1]'),
    ).toHaveText('3')

    // Servicios más pedidos: básico 4 (ingresos 66.000), barba 2 (54.000), limpieza facial 1.
    const ranking = page
      .getByRole('region', { name: 'Servicios más pedidos' })
      .or(page.locator('ol').filter({ hasText: 'Corte básico' }))
    await expect(ranking).toContainText('Corte básico')
    await expect(ranking).toContainText('4 citas')
    await expect(ranking).toContainText('$66.000')
    await expect(ranking).toContainText('Corte + barba')
    await expect(ranking).toContainText('$54.000')

    // Por barbero: B1 3 citas $76.000, 0 faltas; B2 4 citas $79.000, 1 falta.
    const b1 = page
      .getByRole('row')
      .filter({ has: page.getByRole('rowheader', { name: 'Barbero 1' }) })
    await expect(b1).toContainText('3')
    await expect(b1).toContainText('$76.000')
    const b2 = page
      .getByRole('row')
      .filter({ has: page.getByRole('rowheader', { name: 'Barbero 2' }) })
    await expect(b2).toContainText('4')
    await expect(b2).toContainText('$79.000')
    await expect(b2.getByRole('cell').last()).toHaveText('1')
  })

  test('el gráfico tiene texto alternativo y una tabla equivalente con los siete días', async ({
    page,
  }) => {
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await pickSeededWeek(page)
    const chart = page.getByRole('img', { name: /Ingresos por día, 7 días, total \$155\.000/ })
    await expect(chart).toBeVisible()
    await expect(chart.locator('rect')).toHaveCount(4) // lun, mar, jue y sáb; los de cero sin barra
    await expect(page.getByText('Pico: sábado')).toBeVisible()
    const table = page.getByRole('table', { name: 'Ingresos y citas por día' })
    await expect(table.getByRole('row')).toHaveCount(8)
    await expect(table.getByRole('row').filter({ hasText: '2026-01-07' })).toContainText('$0')
    await expect(table.getByRole('row').filter({ hasText: '2026-01-10' })).toContainText('$57.000')
    // Visualmente oculta, pero disponible para lectores de pantalla (no display:none).
    const box = await table.locator('xpath=..').boundingBox()
    expect(box!.width).toBeLessThanOrEqual(2)
  })

  test('por defecto muestra la semana actual y Este mes cambia el periodo', async ({ page }) => {
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    const group = page.getByRole('group', { name: 'Periodo' })
    await expect(group.getByRole('button', { name: 'Esta semana' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByText(/^Semana del /)).toBeVisible()
    await group.getByRole('button', { name: 'Este mes' }).click()
    await expect(group.getByRole('button', { name: 'Este mes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByText(/ de \d{4}$/).first()).toBeVisible()
  })

  test('sin violaciones serious ni critical en /admin', async ({ page }) => {
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await pickSeededWeek(page)
    await expect(page.getByRole('img', { name: /Ingresos por día/ })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('un barbero que abre /admin es redirigido a /barbero', async ({ page }) => {
    await loginUi(page, 'barbero1@imperio.test', /\/barbero$/)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/barbero$/)
  })
})
