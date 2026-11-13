import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { bookViaApi, serviceCard, slotsGroup } from './helpers'

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
}

test.describe('Accesibilidad (axe, sin violaciones serious ni critical)', () => {
  test('/', async ({ page }) => {
    await page.goto('/')
    await expect(serviceCard(page, 'Corte básico')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    // También con un servicio elegido, horarios cargados y errores de campo visibles.
    await serviceCard(page, 'Corte básico').click()
    await slotsGroup(page).getByRole('button').first().waitFor()
    await page.getByLabel('Celular (WhatsApp)').fill('12')
    await page.getByLabel('Nombre').click()
    await expect(page.getByText('Escribe un celular colombiano de 10 dígitos.')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('/cita/<token>', async ({ page, request }) => {
    const booked = await bookViaApi(request, {
      service: 'Corte básico',
      barber: 'Barbero 1',
      dayOffset: 2,
    })
    await page.goto(`/cita/${booked.token}`)
    await expect(page.getByRole('heading', { name: 'Tu cita está lista' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    // Con el diálogo de cancelar abierto.
    await page.getByRole('button', { name: 'Cancelar cita' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('/productos', async ({ page }) => {
    await page.goto('/productos')
    await expect(page.getByRole('region', { name: 'Productos' }).locator('article')).toHaveCount(8)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('/privacidad', async ({ page }) => {
    await page.goto('/privacidad')
    await expect(page.getByText('PENDIENTE DE REVISIÓN LEGAL')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })
})
