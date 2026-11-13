import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

const PASSWORD = 'cambiar-esto'
const ADMIN = '/api/v1/admin'

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

async function productId(request: APIRequestContext, name: string) {
  const r = await request.get(`${ADMIN}/products`)
  const items = ((await r.json()) as { items: Array<{ id: string; name: string }> }).items
  return items.find((p) => p.name === name)?.id
}

test.describe('Admin: productos', () => {
  test.beforeEach(async ({ request }) => {
    const r = await request.post('/api/v1/auth/login', {
      data: { email: 'admin@imperio.test', password: PASSWORD },
    })
    expect(r.ok()).toBe(true)
  })

  test('crear, marcar agotado y eliminar un producto se refleja en /productos', async ({
    page,
    request,
    browser,
    baseURL,
  }) => {
    try {
      await loginUi(page, 'admin@imperio.test', /\/admin$/)
      await page.goto('/admin/productos')
      await expect(
        page.getByRole('navigation', { name: 'Sección' }).getByRole('link', { name: 'Productos' }),
      ).toHaveAttribute('aria-current', 'page')
      await page.getByRole('button', { name: 'Agregar producto' }).click()
      const panel = page.getByRole('complementary', { name: 'Agregar producto' })
      await panel.getByLabel('Nombre').fill('Producto de prueba')
      await panel.getByLabel('Precio').fill('31000')
      await panel.getByRole('switch', { name: 'Hay en inventario' }).click()
      await panel.getByRole('button', { name: 'Crear producto' }).click()
      const row = page
        .getByRole('row')
        .filter({ has: page.getByRole('rowheader', { name: 'Producto de prueba' }) })
      await expect(row).toContainText('Agotado')
      await expect(row).toContainText('$31.000')

      const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } })
      const pub = await ctx.newPage()
      await pub.goto('/productos')
      const card = pub.getByRole('article').filter({ hasText: 'Producto de prueba' })
      await expect(card).toContainText('Agotado')
      await ctx.close()

      await row.getByRole('button', { name: /^Editar/ }).click()
      await page.getByRole('button', { name: 'Eliminar producto' }).click()
      await page.getByRole('button', { name: 'Sí, eliminar' }).click()
      await expect(page.getByRole('rowheader', { name: 'Producto de prueba' })).toHaveCount(0)
    } finally {
      const id = await productId(request, 'Producto de prueba')
      if (id) await request.delete(`${ADMIN}/products/${id}`)
    }
  })

  test('sin violaciones serious ni critical en /admin/productos (con el panel abierto)', async ({
    page,
  }) => {
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await page.goto('/admin/productos')
    await expect(page.getByRole('table')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page
      .getByRole('button', { name: /^Editar/ })
      .first()
      .click()
    await expect(page.getByRole('complementary', { name: 'Editar producto' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('un barbero que abre /admin/productos es redirigido a /barbero', async ({
    page,
    request,
  }) => {
    await request.post('/api/v1/auth/logout')
    await loginUi(page, 'barbero1@imperio.test', /\/barbero$/)
    await page.goto('/admin/productos')
    await expect(page).toHaveURL(/\/barbero$/)
  })
})
