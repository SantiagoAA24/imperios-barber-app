// Recorrido de accesibilidad de TODAS las rutas de la app con axe-core. Cualquier violación
// `serious` o `critical` hace fallar la prueba. Cliente y barbero a 390 px; admin a 1280 px.
// Las pantallas con estados (diálogos, paneles, errores de campo) se revisan también abiertas.
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  bogotaDay,
  bookViaApi,
  daysGroup,
  seedOverdueAppointment,
  serviceCard,
  slotsGroup,
} from './helpers'

const PASSWORD = 'cambiar-esto'
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

/** Violaciones serious o critical, en una línea legible cada una. */
async function violations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  if (process.env.A11Y_VERBOSE) {
    // Informe de lo que NO rompe la prueba (moderate y minor): A11Y_VERBOSE=1 pnpm e2e a11y-rutas
    for (const v of result.violations.filter(
      (x) => x.impact !== 'serious' && x.impact !== 'critical',
    )) {
      console.log(`[a11y ${v.impact}] ${page.url()} ${v.id}: ${v.nodes.length} nodo(s) · ${v.help}`)
    }
  }
  return result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
}

async function expectAccessible(page: Page, label: string) {
  expect(await violations(page), `axe en ${label}`).toEqual([])
}

async function login(page: Page, email: string, password: string, url: RegExp) {
  await page.goto('/ingresar')
  await page.getByLabel('Correo').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(url)
}

test.describe('Cliente (390 px)', () => {
  test('/ en todos sus pasos', async ({ page }) => {
    await page.goto('/')
    await expect(serviceCard(page, 'Corte básico')).toBeVisible()
    await expectAccessible(page, '/ (servicios)')
    await serviceCard(page, 'Corte básico').click()
    await expectAccessible(page, '/ (barberos)')
    await page.getByRole('button', { name: 'Cualquiera', exact: true }).click()
    const day = daysGroup(page).locator('button:not([disabled])').first()
    await day.waitFor()
    await day.click()
    await slotsGroup(page).getByRole('button').first().click()
    await expectAccessible(page, '/ (horario elegido)')
    await page.getByLabel('Celular (WhatsApp)').fill('12')
    await page.getByLabel('Nombre').click()
    await expectAccessible(page, '/ (errores de campo)')
  })

  test('/cita/:token, con el diálogo de cancelar y el de reprogramar', async ({
    page,
    request,
  }) => {
    const booked = await bookViaApi(request, {
      service: 'Corte básico',
      barber: 'Barbero 1',
      dayOffset: 4,
    })
    await page.goto(`/cita/${booked.token}`)
    await expect(page.getByRole('heading', { name: 'Tu cita está lista' })).toBeVisible()
    await expectAccessible(page, '/cita/:token')
    await page.getByRole('button', { name: 'Reprogramar' }).click()
    await expect(page.getByRole('heading', { name: /Reprogramar|Elige/ }).first()).toBeVisible()
    await expectAccessible(page, '/cita/:token (reprogramar)')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Cancelar cita' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectAccessible(page, '/cita/:token (diálogo de cancelar)')
  })

  test('/cita/:token con un enlace que no existe', async ({ page }) => {
    await page.goto('/cita/enlace-que-no-existe')
    await expect(page.getByRole('heading', { name: 'No encontramos tu cita' })).toBeVisible()
    await expectAccessible(page, '/cita/:token (no existe)')
  })

  for (const [path, heading] of [
    ['/productos', 'Productos del local'],
    ['/privacidad', 'Política de tratamiento de datos'],
    ['/offline', 'Sin conexión'],
    ['/ingresar', 'Ingresar'],
    ['/ruta-que-no-existe', 'No encontramos esa página'],
  ] as const) {
    test(path, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      await expectAccessible(page, path)
    })
  }

  test('/ingresar con errores de formulario y de credenciales', async ({ page }) => {
    await page.goto('/ingresar')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByText('Escribe tu correo.')).toBeVisible()
    await expectAccessible(page, '/ingresar (campos vacíos)')
    await page.getByLabel('Correo').fill('nadie@imperio.test')
    await page.getByLabel('Contraseña').fill('no-es-la-clave')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expectAccessible(page, '/ingresar (credenciales incorrectas)')
  })

  test('/cambiar-clave (clave temporal pendiente)', async ({ page, request }) => {
    // Un barbero nuevo entra con clave temporal y la app lo manda a cambiarla.
    const admin = await request.post('/api/v1/auth/login', {
      data: { email: 'admin@imperio.test', password: PASSWORD },
    })
    expect(admin.ok()).toBe(true)
    const email = `a11y-${Date.now()}@imperio.test`
    const created = await request.post('/api/v1/admin/barbers', {
      data: { display_name: 'Barbero A11y', email, visible_in_booking: false },
    })
    expect(created.ok()).toBe(true)
    const { temporary_password: temporary, barber } = (await created.json()) as {
      temporary_password: string
      barber: { id: string }
    }
    try {
      await login(page, email, temporary, /\/cambiar-clave$/)
      await expect(page.getByRole('heading', { name: /clave/i, level: 1 })).toBeVisible()
      await expectAccessible(page, '/cambiar-clave')
    } finally {
      // Sin esto el barbero extra seguiría activo y cambiaría los carriles de la agenda semanal.
      await request.patch(`/api/v1/admin/barbers/${barber.id}`, { data: { active: false } })
    }
  })
})

test.describe('Barbero (390 px)', () => {
  test('/barbero, /barbero/nueva, /barbero/horario y una ruta que no existe', async ({ page }) => {
    const client = seedOverdueAppointment(3, 'Cliente por revisar A11y')
    await login(page, 'barbero1@imperio.test', PASSWORD, /\/barbero$/)
    await expect(page.getByRole('heading', { name: 'Mi agenda', level: 1 })).toBeVisible()
    // Con «Citas por revisar» visible y la insignia en la barra.
    await expect(page.getByRole('region', { name: 'Citas por revisar' })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Agenda \d+ citas? por revisar$/ })).toBeVisible()
    expect(client).toContain('A11y')
    await expectAccessible(page, '/barbero (con citas por revisar)')

    await page.goto('/barbero/nueva')
    await expect(page.getByRole('heading', { name: 'Nueva cita', level: 1 })).toBeVisible()
    await expectAccessible(page, '/barbero/nueva')

    await page.goto('/barbero/horario')
    await expect(page.getByRole('heading', { name: 'Mi horario', level: 1 })).toBeVisible()
    await expectAccessible(page, '/barbero/horario')

    await page.goto('/barbero/ruta-que-no-existe')
    await expect(page.getByRole('heading', { name: 'No encontramos esa página' })).toBeVisible()
    await expectAccessible(page, '/barbero/* (404)')
  })

  test('/barbero con una cita próxima y el botón de recordatorio', async ({ page, request }) => {
    // Cita hoy o mañana en las próximas 24 h es imposible de garantizar a cualquier hora: se
    // reserva para el día de mañana y se revisa la agenda de ese día.
    const booked = await bookViaApi(request, {
      service: 'Corte + barba',
      barber: 'Barbero 1',
      dayOffset: 1,
      clientName: 'Cliente Recordatorio',
    })
    await login(page, 'barbero1@imperio.test', PASSWORD, /\/barbero$/)
    await page.goto(`/barbero?fecha=${booked.date}`)
    await expect(page.getByText('Cliente Recordatorio')).toBeVisible()
    await expectAccessible(page, '/barbero?fecha= (con cita)')
  })
})

test.describe('Administración (1280 px)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('todas las pantallas del admin', async ({ page, request }) => {
    const booked = await bookViaApi(request, {
      service: 'Corte básico',
      barber: 'Barbero 2',
      dayOffset: 3,
      slotIndex: 3,
      clientName: 'Cliente Admin A11y',
    })
    seedOverdueAppointment(4, 'Pendiente Admin A11y')
    await login(page, 'admin@imperio.test', PASSWORD, /\/admin$/)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectAccessible(page, '/admin (Resumen)')

    await page.goto(`/admin/agenda?fecha=${booked.date}`)
    await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Citas por revisar' })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Agenda \d+ citas? por revisar$/ })).toBeVisible()
    await expectAccessible(page, '/admin/agenda')
    await page.getByRole('button', { name: /Cliente Admin A11y/ }).click()
    await expectAccessible(page, '/admin/agenda (cita abierta)')
    await page.getByRole('button', { name: 'Nueva cita' }).click()
    await expectAccessible(page, '/admin/agenda (nueva cita)')

    await page.goto(`/admin/semana?fecha=${bogotaDay(3)}`)
    await expect(page.getByRole('region', { name: 'Agenda de la semana' })).toBeVisible()
    await expectAccessible(page, '/admin/semana')

    for (const [path, heading] of [
      ['/admin/servicios', 'Servicios'],
      ['/admin/productos', 'Productos'],
      ['/admin/barberos', 'Barberos'],
      ['/admin/clientes', 'Clientes'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      await expectAccessible(page, path)
    }

    await page.goto('/admin/ruta-que-no-existe')
    await expect(page.getByRole('heading', { name: 'No encontramos esa página' })).toBeVisible()
    await expectAccessible(page, '/admin/* (404)')
  })
})

/** Controles visibles más pequeños que 44 x 44 px (regla del proyecto; WCAG 2.5.8 pide 24 px). */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector =
      'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=switch], [role=checkbox]'
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.matches('a[href="#contenido"]')) continue // enlace de salto: solo visible con el foco
      if (el.closest('[aria-hidden="true"]')) continue // p. ej. el campo trampa fuera de pantalla
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      // Campos y casillas se activan también por su etiqueta: cuenta el área de la etiqueta.
      const type = (el as HTMLInputElement).type
      const target =
        type === 'checkbox' || type === 'radio'
          ? ((el as HTMLInputElement).labels?.[0] ?? el.closest('label') ?? el)
          : el
      const box = target.getBoundingClientRect()
      // Excepción WCAG: un enlace dentro de un texto corrido no necesita medir 44 px.
      const inline =
        el.tagName === 'A' &&
        el.closest('p, label, li, span') !== null &&
        style.display === 'inline'
      if (inline) continue
      if (box.width < 44 - 0.5 || box.height < 44 - 0.5) {
        const name =
          el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? el.tagName
        out.push(
          `${el.tagName.toLowerCase()} «${name}» ${Math.round(box.width)}x${Math.round(box.height)}`,
        )
      }
    }
    return out
  })
}

test.describe('Áreas táctiles de 44 px', () => {
  test('cliente (390 px)', async ({ page }) => {
    for (const path of ['/', '/productos', '/privacidad', '/ingresar', '/offline']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await smallTargets(page), path).toEqual([])
    }
  })

  test('barbero (390 px)', async ({ page }) => {
    await login(page, 'barbero1@imperio.test', PASSWORD, /\/barbero$/)
    for (const path of ['/barbero', '/barbero/nueva', '/barbero/horario']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await smallTargets(page), path).toEqual([])
    }
  })
})
