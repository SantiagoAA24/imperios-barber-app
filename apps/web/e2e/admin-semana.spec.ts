import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { bogotaDay, bookViaApi } from './helpers'

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

test.describe('Admin: agenda semanal', () => {
  test('las citas caen en el día y el carril de su barbero; hoy se resalta con la palabra "hoy"', async ({
    page,
    request,
  }) => {
    const booked = await bookViaApi(request, {
      service: 'Corte básico',
      barber: 'Barbero 2',
      dayOffset: 3,
      slotIndex: 4,
    })
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await page.goto(`/admin/semana?fecha=${booked.date}`)
    await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible()
    await expect(page.getByRole('group', { name: /^Citas del / })).toHaveCount(7)

    const column = page.getByRole('group', { name: `Citas del ${booked.date}` })
    const block = column.locator('div', { hasText: 'Cliente de prueba' }).first()
    await expect(block).toContainText('B2')
    await expect(block).not.toContainText('B1')
    // Carril 2: mitad derecha de la columna del día.
    const col = await column.boundingBox()
    const box = await block.boundingBox()
    expect(box!.x).toBeGreaterThan(col!.x + col!.width / 2 - 2)

    // Conteo del día y enlace al día.
    const link = page
      .getByRole('region', { name: 'Agenda de la semana' })
      .locator(`a[href="/admin/agenda?fecha=${booked.date}"]`)
    await expect(link).toContainText(/\d+ citas?/)

    // Con la semana de hoy, el día actual lleva la palabra "hoy".
    await page.goto(`/admin/semana?fecha=${bogotaDay(0)}`)
    await expect(page.locator('[aria-current="date"]')).toContainText('hoy')
    await expect(page.getByText('· hoy')).toHaveCount(1)
    const view = page.getByRole('navigation', { name: 'Vista' })
    await expect(view.getByRole('link', { name: 'Semana' })).toHaveAttribute('aria-current', 'page')
    await view.getByRole('link', { name: 'Día' }).click()
    await expect(page).toHaveURL(/\/admin\/agenda\?fecha=/)
  })

  test('si las siete columnas no caben, se desplaza horizontalmente con el teclado', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 800 })
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await page.goto(`/admin/semana?fecha=${bogotaDay(0)}`)
    const region = page.getByRole('region', { name: 'Agenda de la semana' })
    await expect(page.getByRole('group', { name: /^Citas del / })).toHaveCount(7)
    const overflow = await region.evaluate((el) => el.scrollWidth > el.clientWidth)
    expect(overflow).toBe(true)
    await region.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
  })

  test('sin violaciones serious ni critical en /admin/semana', async ({ page }) => {
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await page.goto(`/admin/semana?fecha=${bogotaDay(3)}`)
    await expect(page.getByRole('group', { name: /^Citas del / })).toHaveCount(7)
    expect(await seriousViolations(page)).toEqual([])
    await page.getByRole('button', { name: 'Nueva cita' }).click()
    await expect(page.getByRole('complementary', { name: 'Nueva cita' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('un barbero que abre /admin/semana es redirigido a /barbero', async ({ page }) => {
    await loginUi(page, 'barbero1@imperio.test', /\/barbero$/)
    await page.goto('/admin/semana')
    await expect(page).toHaveURL(/\/barbero$/)
  })
})
