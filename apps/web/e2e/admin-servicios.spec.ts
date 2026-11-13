import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Browser, Page } from '@playwright/test'
import { bookViaApi, serviceCard } from './helpers'

const PASSWORD = 'cambiar-esto'
const ADMIN = '/api/v1/admin'

test.use({ viewport: { width: 1280, height: 800 } })

type AdminService = { id: string; name: string; price_cop: number; active: boolean }

async function loginApi(request: APIRequestContext, email: string) {
  const r = await request.post('/api/v1/auth/login', { data: { email, password: PASSWORD } })
  expect(r.ok()).toBe(true)
}

async function adminServices(request: APIRequestContext): Promise<AdminService[]> {
  const r = await request.get(`${ADMIN}/services`)
  expect(r.ok()).toBe(true)
  return ((await r.json()) as { items: AdminService[] }).items
}

async function loginUi(page: Page, email: string, url: RegExp) {
  await page.goto('/ingresar')
  await page.getByLabel('Correo').fill(email)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(url)
}

/** Un visitante sin sesión ni caché (el catálogo público se guarda 60 s en el navegador). */
async function visitor(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  })
  return { context, page: await context.newPage() }
}

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
}

const row = (page: Page, name: string) =>
  page.getByRole('row').filter({ has: page.getByRole('rowheader', { name }) })

test.describe('Admin: servicios', () => {
  test.beforeEach(async ({ request }) => {
    await loginApi(request, 'admin@imperio.test')
  })

  test('cambiar el precio de "Corte básico" se ve en la web pública y no toca una cita previa', async ({
    page,
    request,
    browser,
    baseURL,
  }) => {
    const before = await bookViaApi(request, {
      service: 'Corte básico',
      barber: 'Barbero 1',
      dayOffset: 3,
    })
    const original = (await adminServices(request)).find((s) => s.name === 'Corte básico')!
    try {
      await loginUi(page, 'admin@imperio.test', /\/admin$/)
      await page.goto('/admin/servicios')
      await expect(
        page.getByRole('heading', { name: 'Servicios y productos', level: 1 }),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Editar Corte básico' }).click()
      const panel = page.getByRole('complementary', { name: 'Editar servicio' })
      await panel.getByLabel('Precio').fill('25000')
      await panel.getByRole('button', { name: 'Guardar cambios' }).click()
      await expect(panel.getByText('Cambios guardados.')).toBeVisible()
      await expect(row(page, 'Corte básico')).toContainText('$25.000')

      const { context, page: pub } = await visitor(browser, baseURL)
      await pub.goto('/')
      await expect(serviceCard(pub, 'Corte básico')).toContainText('$25.000')
      // La cita reservada antes del cambio conserva su precio.
      await pub.goto(`/cita/${before.token}`)
      await expect(pub.getByText('$22.000').first()).toBeVisible()
      await expect(pub.getByText('$25.000')).toHaveCount(0)
      await context.close()
    } finally {
      await request.patch(`${ADMIN}/services/${original.id}`, {
        data: { price_cop: original.price_cop },
      })
    }
  })

  test('desactivar un servicio lo quita de la web pública, con confirmación', async ({
    page,
    request,
    browser,
    baseURL,
  }) => {
    const created = await request.post(`${ADMIN}/services`, {
      data: { name: 'Servicio de prueba', price_cop: 10_000, duration_min: 30 },
    })
    expect(created.status()).toBe(201)
    const { id } = (await created.json()) as { id: string }
    try {
      const first = await visitor(browser, baseURL)
      await first.page.goto('/')
      await expect(serviceCard(first.page, 'Servicio de prueba')).toBeVisible()
      await first.context.close()

      await loginUi(page, 'admin@imperio.test', /\/admin$/)
      await page.goto('/admin/servicios')
      await page
        .getByRole('switch', { name: 'Visible para los clientes: Servicio de prueba' })
        .click()
      const dialog = page.getByRole('dialog', { name: '¿Ocultar este servicio?' })
      await dialog.getByRole('button', { name: 'Ocultar servicio' }).click()
      await expect(row(page, 'Servicio de prueba')).toContainText('Oculto para los clientes')

      const second = await visitor(browser, baseURL)
      await second.page.goto('/')
      await expect(serviceCard(second.page, 'Corte básico')).toBeVisible()
      await expect(second.page.getByRole('button', { name: /^Servicio de prueba/ })).toHaveCount(0)
      await second.context.close()

      // Sin citas se puede eliminar de verdad.
      await page.getByRole('button', { name: 'Editar Servicio de prueba' }).click()
      await page.getByRole('button', { name: 'Eliminar servicio' }).click()
      await page.getByRole('button', { name: 'Sí, eliminar' }).click()
      await expect(page.getByRole('rowheader', { name: 'Servicio de prueba' })).toHaveCount(0)
    } finally {
      await request.delete(`${ADMIN}/services/${id}`)
    }
  })

  test('un servicio con historial no se elimina: muestra el aviso y ofrece Desactivar', async ({
    page,
    request,
  }) => {
    await bookViaApi(request, { service: 'Limpieza facial', barber: 'Barbero 2', dayOffset: 4 })
    const target = (await adminServices(request)).find((s) => s.name === 'Limpieza facial')!
    try {
      await loginUi(page, 'admin@imperio.test', /\/admin$/)
      await page.goto('/admin/servicios')
      await page.getByRole('button', { name: 'Editar Limpieza facial' }).click()
      await page.getByRole('button', { name: 'Eliminar servicio' }).click()
      await page.getByRole('button', { name: 'Sí, eliminar' }).click()
      await expect(
        page.getByText(
          'Este servicio tiene citas en el historial. Desactívalo en lugar de eliminarlo.',
        ),
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'Desactivar' })).toBeVisible()
    } finally {
      await request.patch(`${ADMIN}/services/${target.id}`, { data: { active: true } })
    }
  })

  test('sin violaciones serious ni critical en /admin/servicios (con el panel abierto)', async ({
    page,
  }) => {
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await page.goto('/admin/servicios')
    await expect(page.getByRole('rowheader', { name: /Corte básico/ })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.getByRole('button', { name: 'Editar Corte básico' }).click()
    await expect(page.getByRole('complementary', { name: 'Editar servicio' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('un barbero que abre /admin es redirigido a /barbero', async ({ page, request }) => {
    await request.post('/api/v1/auth/logout')
    await loginUi(page, 'barbero1@imperio.test', /\/barbero$/)
    await page.goto('/admin/servicios')
    await expect(page).toHaveURL(/\/barbero$/)
  })
})
