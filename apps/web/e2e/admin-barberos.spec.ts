import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

const PASSWORD = 'cambiar-esto'
const ADMIN = '/api/v1/admin'

test.use({ viewport: { width: 1280, height: 800 } })

async function loginUi(page: Page, email: string, password: string, url: RegExp) {
  await page.goto('/ingresar')
  await page.getByLabel('Correo').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(url)
}

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
}

async function hideBarber(request: APIRequestContext, email: string) {
  const r = await request.get(`${ADMIN}/barbers`)
  const items = ((await r.json()) as { items: Array<{ id: string; email: string }> }).items
  const found = items.find((b) => b.email === email)
  if (found) await request.patch(`${ADMIN}/barbers/${found.id}`, { data: { active: false } })
}

test.describe('Admin: barberos', () => {
  test.beforeEach(async ({ request }) => {
    const r = await request.post('/api/v1/auth/login', {
      data: { email: 'admin@imperio.test', password: PASSWORD },
    })
    expect(r.ok()).toBe(true)
  })

  test('crea un barbero, copia la clave temporal, ingresa con ella y se le obliga a cambiarla', async ({
    page,
    browser,
    baseURL,
    request,
    context,
  }) => {
    const email = `nuevo${Date.now()}@imperio.test`
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    try {
      await loginUi(page, 'admin@imperio.test', PASSWORD, /\/admin$/)
      await page.goto('/admin/barberos')
      await page.getByRole('button', { name: 'Agregar barbero' }).click()
      const form = page.getByRole('form', { name: 'Agregar barbero' })
      await form.getByLabel('Nombre').fill('Carlos Nuevo')
      await form.getByLabel('Correo').fill(email)
      await form.getByRole('button', { name: 'Crear barbero' }).click()

      const code = page.getByLabel('Clave temporal generada')
      await expect(code).toBeVisible()
      await expect(page.getByText('No volverás a ver esta clave.')).toBeVisible()
      const temporary = ((await code.textContent()) ?? '').trim()
      expect(temporary).toHaveLength(12)
      await page.getByRole('button', { name: 'Copiar' }).click()
      await expect(page.getByText('Clave copiada.')).toBeVisible()
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(temporary)

      // Una vez cerrado el aviso, la clave no vuelve a verse ni al recargar.
      await page.getByRole('button', { name: 'Ya la copié' }).click()
      await page.reload()
      await expect(page.getByRole('rowheader', { name: /Carlos Nuevo/ })).toBeVisible()
      await expect(page.getByText(temporary)).toHaveCount(0)

      // El barbero ingresa con la clave temporal y solo puede cambiarla.
      const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } })
      const barber = await ctx.newPage()
      await loginUi(barber, email, temporary, /\/(barbero|cambiar-clave)$/)
      await expect(barber).toHaveURL(/\/cambiar-clave$/)
      await expect(barber.getByRole('heading', { name: 'Crea tu clave' })).toBeVisible()
      expect(await seriousViolations(barber)).toEqual([])
      await barber.goto('/barbero')
      await expect(barber).toHaveURL(/\/cambiar-clave$/)
      await barber.getByLabel('Clave temporal').fill(temporary)
      await barber.getByLabel('Clave nueva', { exact: true }).fill('mi-clave-propia-123')
      await barber.getByLabel('Repite la clave nueva').fill('mi-clave-propia-123')
      await barber.getByRole('button', { name: 'Guardar clave' }).click()
      await expect(barber).toHaveURL(/\/barbero$/)
      await expect(barber.getByRole('heading', { name: 'Mi agenda', level: 1 })).toBeVisible()
      await ctx.close()
    } finally {
      await hideBarber(request, email)
    }
  })

  test('desactivar a un barbero pide confirmación y se puede reactivar', async ({ page }) => {
    await loginUi(page, 'admin@imperio.test', PASSWORD, /\/admin$/)
    await page.goto('/admin/barberos')
    await page.getByRole('switch', { name: 'Activo: Barbero 2' }).click()
    await expect(page.getByRole('dialog', { name: '¿Desactivar a este barbero?' })).toBeVisible()
    await page.getByRole('button', { name: 'Desactivar barbero' }).click()
    await expect(page.getByRole('switch', { name: 'Activo: Barbero 2' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    // Se vuelve a activar para no afectar las demás pruebas.
    await page.getByRole('switch', { name: 'Activo: Barbero 2' }).click()
    await expect(page.getByRole('switch', { name: 'Activo: Barbero 2' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  test('sin violaciones serious ni critical en /admin/barberos (con el formulario abierto)', async ({
    page,
  }) => {
    await loginUi(page, 'admin@imperio.test', PASSWORD, /\/admin$/)
    await page.goto('/admin/barberos')
    await expect(page.getByRole('table')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.getByRole('button', { name: 'Agregar barbero' }).click()
    await expect(page.getByRole('form', { name: 'Agregar barbero' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('un barbero que abre /admin/barberos es redirigido a /barbero', async ({
    page,
    request,
  }) => {
    await request.post('/api/v1/auth/logout')
    await loginUi(page, 'barbero1@imperio.test', PASSWORD, /\/barbero$/)
    await page.goto('/admin/barberos')
    await expect(page).toHaveURL(/\/barbero$/)
  })
})
