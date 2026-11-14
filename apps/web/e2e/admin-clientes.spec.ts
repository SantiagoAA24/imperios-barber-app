import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { bookViaApi } from './helpers'

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

const PHONE = '3174824821'

test.describe('Admin: clientes', () => {
  test.beforeAll(async ({ request }) => {
    await bookViaApi(request, {
      service: 'Corte básico',
      barber: 'Barbero 1',
      dayOffset: 5,
      slotIndex: 6,
      clientName: 'José Peña',
      phone: PHONE,
    })
  })

  test('la búsqueda encuentra por nombre con tilde (con o sin ella) y por últimos dígitos', async ({
    page,
  }) => {
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await page.goto('/admin/clientes')
    await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible()
    const search = page.getByLabel('Buscar cliente')
    const rows = page.getByRole('table').getByRole('row')

    await search.fill('jose')
    await expect(page.getByRole('button', { name: /José Peña/ })).toBeVisible()
    await expect(rows).toHaveCount(2) // encabezado + 1
    await search.fill('JOSÉ')
    await expect(page.getByRole('button', { name: /José Peña/ })).toBeVisible()
    await search.fill('peña')
    await expect(page.getByRole('button', { name: /José Peña/ })).toBeVisible()

    await search.fill('4824821')
    await expect(page.getByRole('button', { name: /José Peña/ })).toBeVisible()
    await expect(rows).toHaveCount(2)
    await search.fill('999999999')
    await expect(page.getByText('No encontramos clientes con esa búsqueda o filtro.')).toBeVisible()

    // En la lista el celular es parcial, nunca completo.
    await search.fill('')
    await expect(page.getByRole('button', { name: /José Peña/ })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(PHONE)
    await expect(page.getByText('317 *** 4821')).toBeVisible()
  })

  test('el detalle muestra el celular completo y WhatsApp; las notas se guardan y persisten', async ({
    page,
  }) => {
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await page.goto('/admin/clientes')
    await page.getByLabel('Buscar cliente').fill('jose')
    await page.getByRole('button', { name: /José Peña/ }).click()
    const detail = page.getByRole('complementary', { name: 'Detalle del cliente' })
    await expect(detail.getByText('317 482 4821')).toBeVisible()
    await expect(detail.getByRole('link', { name: /WhatsApp a José Peña/ })).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/57317482482/,
    )
    await expect(detail.getByRole('region', { name: 'Últimas visitas' })).toContainText(
      'Corte básico',
    )
    await detail.getByLabel('Notas del barbero').fill('Prefiere degradado bajo.')
    await detail.getByRole('button', { name: 'Guardar notas' }).click()
    await expect(detail.getByText('Notas guardadas.')).toBeVisible()

    await page.reload()
    await page.getByLabel('Buscar cliente').fill('jose')
    await page.getByRole('button', { name: /José Peña/ }).click()
    await expect(page.getByLabel('Notas del barbero')).toHaveValue('Prefiere degradado bajo.')
  })

  test('los chips de filtro usan aria-pressed', async ({ page }) => {
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await page.goto('/admin/clientes')
    const group = page.getByRole('group', { name: 'Filtro' })
    await expect(group.getByRole('button', { name: 'Todos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await group.getByRole('button', { name: 'Frecuentes' }).click()
    await expect(group.getByRole('button', { name: 'Frecuentes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(group.getByRole('button', { name: 'Todos' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // Nadie tiene 5 citas atendidas en los datos sembrados.
    await expect(page.getByText('No encontramos clientes con esa búsqueda o filtro.')).toBeVisible()
  })

  test('sin violaciones serious ni critical en /admin/clientes (con el detalle abierto)', async ({
    page,
  }) => {
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await page.goto('/admin/clientes')
    await expect(page.getByRole('table')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.getByRole('button', { name: /José Peña/ }).click()
    await expect(
      page.getByRole('complementary', { name: 'Detalle del cliente' }).getByText('317 482 4821'),
    ).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('un barbero que abre /admin/clientes es redirigido a /barbero', async ({ page }) => {
    await loginUi(page, 'barbero1@imperio.test', /\/barbero$/)
    await page.goto('/admin/clientes')
    await expect(page).toHaveURL(/\/barbero$/)
  })
})
