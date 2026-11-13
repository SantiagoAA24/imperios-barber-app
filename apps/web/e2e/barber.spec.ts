import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import {
  API,
  bogotaDay,
  bookViaApi,
  daysGroup,
  pickFirstSlot,
  randomPhone,
  slotsGroup,
} from './helpers'

const PASSWORD = 'cambiar-esto'
const ME = '/api/v1/me'

/** Jornada de 00:00 a 23:30 todos los días: las pruebas no dependen de la hora a la que corren. */
const ALL_DAY = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  start_time: '00:00',
  end_time: '23:30',
}))

async function loginApi(request: APIRequestContext, email = 'barbero1@imperio.test') {
  const r = await request.post('/api/v1/auth/login', { data: { email, password: PASSWORD } })
  expect(r.ok()).toBe(true)
}

async function resetSchedule(request: APIRequestContext) {
  const r = await request.put(`${ME}/schedule`, { data: { schedule: ALL_DAY } })
  expect(r.ok()).toBe(true)
}

async function loginUi(page: Page, email = 'barbero1@imperio.test') {
  await page.goto('/ingresar')
  await page.getByLabel('Correo').fill(email)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/barbero$/)
}

async function serviceId(request: APIRequestContext, name: string): Promise<string> {
  const services = (await (await request.get(`${API}/services`)).json()) as Array<{
    id: string
    name: string
  }>
  return services.find((s) => s.name === name)!.id
}

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
}

const stat = (page: Page, label: string) =>
  page
    .getByLabel('Resumen del día')
    .getByText(label, { exact: true })
    .locator('xpath=preceding-sibling::span')

test.describe('Panel del barbero', () => {
  test.beforeEach(async ({ request }) => {
    await loginApi(request)
    await resetSchedule(request)
  })

  test('inicia sesión como barbero1 y ve su agenda con la navegación de tres pestañas', async ({
    page,
  }) => {
    await loginUi(page)
    await expect(page).toHaveURL(/\/barbero$/)
    await expect(page.getByRole('heading', { name: 'Mi agenda', level: 1 })).toBeVisible()
    await expect(page.getByText('Hola, Barbero 1')).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Principal' })
    await expect(nav.getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page')
    await nav.getByRole('link', { name: 'Nueva cita' }).click()
    await expect(nav.getByRole('link', { name: 'Nueva cita' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await nav.getByRole('link', { name: 'Mi horario' }).click()
    await expect(nav.getByRole('link', { name: 'Mi horario' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('un cliente reserva en la web pública y la cita aparece sola en la agenda en menos de 35 s', async ({
    page,
    browser,
    baseURL,
    request,
  }) => {
    // Día del primer horario libre de Barbero 1: la agenda se abre en ese día.
    const barbers = (await (await request.get(`${API}/barbers`)).json()) as Array<{
      id: string
      display_name: string
    }>
    const barber = barbers.find((b) => b.display_name === 'Barbero 1')!
    const svc = await serviceId(request, 'Corte básico')
    let day = bogotaDay(0)
    for (let i = 0; i < 3; i++) {
      day = bogotaDay(i)
      const r = await request.get(`${API}/availability`, {
        params: { service_id: svc, barber_id: barber.id, date: day },
      })
      if (((await r.json()) as { slots: unknown[] }).slots.length > 0) break
    }

    await loginUi(page)
    await page.goto(`/barbero?fecha=${day}`)
    await expect(page.getByRole('heading', { name: 'Mi agenda' })).toBeVisible()
    const before = await page.getByRole('article').count()

    const anon = await (
      await browser.newContext({
        baseURL,
        viewport: { width: 390, height: 844 },
        locale: 'es-CO',
        timezoneId: 'America/Bogota',
        reducedMotion: 'reduce',
      })
    ).newPage()
    await anon.goto('/')
    await anon.getByRole('button', { name: /^Corte básico (\d|~)/ }).click()
    await anon.getByRole('button', { name: 'Barbero 1', exact: true }).click()
    const dayButton = daysGroup(anon).locator('button:not([disabled])').first()
    await dayButton.waitFor()
    await pickFirstSlot(anon, 'Corte básico', 'Barbero 1')
    await anon.getByLabel('Nombre').fill('Cliente Web E2E')
    await anon.getByLabel('Celular (WhatsApp)').fill(randomPhone())
    await anon.getByRole('checkbox', { name: /Acepto el tratamiento/ }).check()
    await anon.getByRole('button', { name: 'Confirmar cita' }).click()
    await expect(anon).toHaveURL(/\/cita\//)
    await anon.close()

    await expect(page.getByRole('article')).toHaveCount(before + 1, { timeout: 35_000 })
    await expect(page.getByRole('heading', { name: 'Cliente Web E2E' })).toBeVisible()
  })

  test('marcar "Atendida" actualiza el resumen', async ({ page, request }) => {
    const svc = await serviceId(request, 'Corte básico')
    const created = await request.post(`${ME}/appointments`, {
      data: {
        service_id: svc,
        walk_in: true,
        source: 'walk_in',
        client: { name: 'Atender E2E', phone: null },
      },
    })
    expect(created.status(), await created.text()).toBe(201)

    await loginUi(page)
    await expect(page.getByRole('heading', { name: 'Atender E2E' })).toBeVisible()
    const attendedBefore = Number(await stat(page, 'Atendidas').textContent())
    await page
      .getByRole('article', { name: 'Atender E2E' })
      .getByRole('button', { name: 'Atendida' })
      .click()
    await expect(stat(page, 'Atendidas')).toHaveText(String(attendedBefore + 1))
    await expect(
      page.getByRole('article', { name: 'Atender E2E' }).getByText('Atendida', { exact: true }),
    ).toBeVisible()
    await expect(stat(page, 'Ingresos')).not.toHaveText('$0')
  })

  test('un turno sin cita se crea desde la pantalla y ese hueco desaparece de /public/availability', async ({
    page,
    request,
  }) => {
    const svc = await serviceId(request, 'Corte + limpieza facial')
    const barbers = (await (await request.get(`${API}/barbers`)).json()) as Array<{
      id: string
      display_name: string
    }>
    const barber = barbers.find((b) => b.display_name === 'Barbero 1')!
    const today = bogotaDay(0)
    const slots = async () =>
      (
        (await (
          await request.get(`${API}/availability`, {
            params: { service_id: svc, barber_id: barber.id, date: today },
          })
        ).json()) as { slots: Array<{ starts_at: string }> }
      ).slots.map((s) => s.starts_at)
    const before = await slots()

    await loginUi(page)
    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'Nueva cita' })
      .click()
    await page.getByRole('switch', { name: 'Turno sin cita' }).click()
    await page.getByRole('button', { name: /^Corte \+ limpieza facial/ }).click()
    await expect(page.getByText(/^Empiezas a las \d{1,2}:\d{2} (am|pm)$/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Día y hora' })).toHaveCount(0)
    await page.getByLabel('Nombre').fill('Sin Cita E2E')
    await page.getByRole('button', { name: 'Guardar cita' }).click()

    await expect(page).toHaveURL(/\/barbero\?fecha=/)
    await expect(page.getByText(/Cita guardada: Sin Cita E2E/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sin Cita E2E' })).toBeVisible()

    const after = await slots()
    expect(after.length).toBeLessThan(before.length)
    // Ningún horario público puede solaparse con el turno recién creado (60 min desde ahora).
    const now = Date.now()
    for (const s of after) {
      const t = new Date(s).getTime()
      expect(t >= now + 60 * 60_000 || t + 60 * 60_000 <= now - 5 * 60_000).toBe(true)
    }
  })

  test('cambiar el horario con una cita afectada muestra el aviso de conflicto sin cancelarla', async ({
    page,
    request,
  }) => {
    const booked = await bookViaApi(request, {
      service: 'Corte básico',
      barber: 'Barbero 1',
      dayOffset: 3,
    })
    const weekday = (new Date(`${booked.date}T12:00:00-05:00`).getUTCDay() + 6) % 7
    const names = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

    await loginUi(page)
    await page.goto('/barbero/horario')
    await expect(page.getByRole('heading', { name: 'Mi horario', level: 1 })).toBeVisible()
    await page.getByRole('switch', { name: `Trabajo el ${names[weekday]}` }).click()
    await page.getByRole('button', { name: 'Guardar horario' }).click()

    await expect(page.getByText('Horario guardado.')).toBeVisible()
    await expect(page.getByText(/No se cancelaron/).first()).toBeVisible()
    await expect(page.getByText('Cliente de prueba').first()).toBeVisible()
    const link = page.getByRole('link', { name: /Ver la cita de Cliente de prueba/ }).first()
    await link.click()
    await expect(page).toHaveURL(/\/barbero\?fecha=.*&cita=/)
    await expect(page.getByRole('article').first()).toBeVisible()
    // Sigue reservada: la web pública todavía la encuentra.
    const still = await request.get(`${API}/appointments/${booked.token}`)
    expect(((await still.json()) as { status: string }).status).toBe('booked')
  })

  test('un barbero no puede abrir /admin: lo redirige a /barbero', async ({ page }) => {
    await loginUi(page)
    await expect(page).toHaveURL(/\/barbero$/)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/barbero$/)
  })

  test('axe: sin violaciones serious ni critical en las tres pantallas', async ({ page }) => {
    await loginUi(page)
    await expect(page.getByRole('heading', { name: 'Mi agenda' })).toBeVisible()
    await expect(page.getByText(/Actualizado/)).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])

    await page.goto('/barbero/nueva')
    await page.getByRole('button', { name: /^Corte básico/ }).click()
    await slotsGroup(page).getByRole('button').first().waitFor()
    expect(await seriousViolations(page)).toEqual([])
    await page.getByRole('switch', { name: 'Turno sin cita' }).click()
    await expect(page.getByText(/^Empiezas a las/)).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])

    await page.goto('/barbero/horario')
    await expect(page.getByRole('switch', { name: 'Trabajo el lunes' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })
})
