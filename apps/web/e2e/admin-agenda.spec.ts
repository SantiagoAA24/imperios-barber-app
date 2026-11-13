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

test.describe('Admin: agenda del día', () => {
  test('una cita hecha desde la web pública aparece en la columna del barbero correcto', async ({
    page,
    request,
  }) => {
    const booked = await bookViaApi(request, {
      service: 'Corte básico',
      barber: 'Barbero 2',
      dayOffset: 3,
      slotIndex: 2,
    })
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await page.goto(`/admin/agenda?fecha=${booked.date}`)
    await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible()
    const col2 = page.getByRole('group', { name: 'Citas de Barbero 2' })
    await expect(col2.getByRole('button', { name: /Cliente de prueba.*Corte básico/ })).toHaveCount(
      1,
    )
    await expect(
      page.getByRole('group', { name: 'Citas de Barbero 1' }).getByRole('button', {
        name: /Cliente de prueba.*Corte básico/,
      }),
    ).toHaveCount(0)
    // Cabeceras y alternador de vista como enlaces.
    await expect(page.getByRole('heading', { name: 'Barbero 1', level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Vaporizador', level: 2 })).toBeVisible()
    const view = page.getByRole('navigation', { name: 'Vista' })
    await expect(view.getByRole('link', { name: 'Día' })).toHaveAttribute('aria-current', 'page')
    await expect(view.getByRole('link', { name: 'Semana' })).toHaveAttribute(
      'href',
      `/admin/semana?fecha=${booked.date}`,
    )
    // El bloque está posicionado por minutos reales: 44 px por 30 min.
    const box = await col2.getByRole('button', { name: /Cliente de prueba/ }).boundingBox()
    const column = await col2.boundingBox()
    expect(box && column).toBeTruthy()
    expect(Math.round(box!.height)).toBe(40)
    expect(((box!.y - column!.y - 2) / 44) % 1).toBe(0) // múltiplo exacto de 30 min
    await expect(page.getByText('300 ***')).toHaveCount(0) // sin detalle abierto no hay celular
  })

  test('un servicio con vaporizador ocupa también la columna Vaporizador', async ({
    page,
    request,
  }) => {
    const booked = await bookViaApi(request, {
      service: 'Corte + limpieza facial',
      barber: 'Barbero 1',
      dayOffset: 4,
    })
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await page.goto(`/admin/agenda?fecha=${booked.date}`)
    await expect(
      page
        .getByRole('group', { name: 'Citas de Barbero 1' })
        .getByRole('button', { name: /Corte \+ limpieza facial/ }),
    ).toHaveCount(1)
    const vapor = page.getByRole('group', { name: 'Uso de Vaporizador' })
    await expect(vapor.getByText('En uso · Barbero 1')).toHaveCount(1)
    const block = await vapor.locator('div').first().boundingBox()
    // 60 minutos: 88 px - 4 de separación.
    expect(Math.round(block!.height)).toBe(84)
  })

  test('el detalle muestra el celular parcial y "Nueva cita" crea, y cancelar libera el horario', async ({
    page,
  }) => {
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    const day = bogotaDay(5)
    await page.goto(`/admin/agenda?fecha=${day}`)
    await page.getByRole('button', { name: 'Nueva cita' }).click()
    const form = page.getByRole('complementary', { name: 'Nueva cita' })
    await form.getByLabel('Barbero').selectOption({ label: 'Barbero 2' })
    await form.getByLabel('Servicio').selectOption({ label: 'Corte básico' })
    await expect(form.getByLabel('Hora').locator('option')).not.toHaveCount(1)
    await form.getByLabel('Hora').selectOption({ index: 1 })
    await form.getByLabel('Nombre del cliente').fill('Pedro Manual')
    await form.getByLabel('Celular (opcional)').fill('3009994821')
    await form.getByRole('button', { name: 'Crear cita' }).click()

    const block = page
      .getByRole('group', { name: 'Citas de Barbero 2' })
      .getByRole('button', { name: /Pedro Manual/ })
    await expect(block).toBeVisible()
    const detail = page.getByRole('complementary', { name: 'Detalle de la cita' })
    await expect(detail.getByText('300 *** 4821')).toBeVisible()
    await expect(detail.getByText('Manual', { exact: true })).toBeVisible()
    await expect(page.locator('body')).not.toContainText('3009994821')

    await detail.getByRole('button', { name: 'Cancelar cita' }).click()
    await page.getByRole('button', { name: 'Sí, cancelar cita' }).click()
    await expect(page.getByRole('button', { name: /Pedro Manual/ })).toHaveCount(0)
  })

  test('hoy se ve la línea de "Ahora" y otro día no', async ({ page }) => {
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await page.goto(`/admin/agenda?fecha=${bogotaDay(2)}`)
    await expect(page.getByRole('heading', { name: 'Barbero 1', level: 2 })).toBeVisible()
    await expect(page.getByText('Ahora', { exact: true })).toHaveCount(0)
  })

  test('sin violaciones serious ni critical en /admin/agenda (con un panel abierto)', async ({
    page,
  }) => {
    await loginUi(page, 'admin@imperio.test', /\/admin$/)
    await page.goto(`/admin/agenda?fecha=${bogotaDay(3)}`)
    await expect(page.getByRole('heading', { name: 'Barbero 1', level: 2 })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.getByRole('button', { name: 'Nueva cita' }).click()
    await expect(page.getByRole('complementary', { name: 'Nueva cita' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('un barbero que abre /admin/agenda es redirigido a /barbero', async ({ page }) => {
    await loginUi(page, 'barbero1@imperio.test', /\/barbero$/)
    await page.goto('/admin/agenda')
    await expect(page).toHaveURL(/\/barbero$/)
  })
})
