// Pruebas de teclado, foco, movimiento reducido y reflujo (zoom): la parte automatizable de
// docs/qa-accesibilidad.md. Lo que exige oído o criterio humano queda en esa lista manual.
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { bookViaApi, randomPhone, serviceCard } from './helpers'

type Stop = { label: string; top: number; left: number; outline: string; inView: boolean }

/** Lo que tiene el elemento enfocado ahora: nombre, posición y si se le ve el anillo de foco. */
async function focused(page: Page): Promise<Stop> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    const name =
      el.getAttribute('aria-label') ??
      el.getAttribute('aria-labelledby') ??
      el.textContent?.trim().slice(0, 40) ??
      el.tagName
    return {
      label: `${el.tagName.toLowerCase()} «${name}»`,
      top: rect.top + window.scrollY,
      left: rect.left,
      // `outline: solid 2px`: el anillo de foco del sistema (FOCUS_RING). El elemento nativo
      // <input> usa además el borde; basta con que haya contorno o sombra visibles.
      outline: `${style.outlineStyle} ${style.outlineWidth}`,
      inView: rect.width > 0 && rect.height > 0,
    }
  })
}

/** Pulsa Tab hasta que el elemento enfocado sea `target` (máx. `limit` veces). */
async function tabTo(page: Page, target: Locator, limit = 80) {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((el) => el === document.activeElement)) return
  }
  throw new Error(`No se llegó con Tab a ${String(target)} en ${limit} pulsaciones`)
}

test.describe('Teclado', () => {
  test('el primer Tab llega a «Saltar al contenido» y Enter lleva el foco al contenido', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Agenda tu cita' })).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Saltar al contenido' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible() // aparece solo con el foco
    const box = await skip.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
    await page.keyboard.press('Enter')
    await expect(page.locator('main#contenido')).toBeFocused()
    // El siguiente Tab sigue desde el contenido, no vuelve al enlace.
    await page.keyboard.press('Tab')
    await expect(skip).not.toBeFocused()
  })

  test('orden de foco lógico y anillo de foco visible en cada parada de /', async ({ page }) => {
    await page.goto('/')
    await expect(serviceCard(page, 'Corte básico')).toBeVisible()
    await serviceCard(page, 'Corte básico').click()
    const first = page
      .getByRole('group', { name: 'Días disponibles' })
      .locator('button:not([disabled])')
    await first.first().waitFor()
    await first.first().click()
    await page
      .getByRole('group', { name: 'Horarios disponibles' })
      .getByRole('button')
      .first()
      .waitFor()
    // Se parte del inicio de la página: el foco entra desde el enlace «Saltar al contenido».
    await page.keyboard.press('Shift') // modalidad de teclado: :focus-visible aplica al enfocar
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      document.querySelector<HTMLElement>('a[href="#contenido"]')?.focus()
    })
    const start = await focused(page)

    const stops: Stop[] = [start]
    for (let i = 0; i < 70; i++) {
      await page.keyboard.press('Tab')
      const stop = await focused(page)
      // Al final del documento el foco pasa al navegador (body): se dio la vuelta.
      if (stop.label.startsWith('body') || stop.label === stops[0]?.label) break
      stops.push(stop)
    }
    expect(stops.length).toBeGreaterThan(10)
    expect(stops[0]?.label).toContain('Saltar al contenido')
    const lost = stops.filter((s) => !s.inView).map((s) => s.label)
    expect(lost, 'paradas de foco sin tamaño (ocultas)').toEqual([])
    const noRing = stops.filter((s) => !s.outline.startsWith('solid')).map((s) => s.label)
    expect(noRing, 'paradas sin anillo de foco').toEqual([])
    // Orden: nunca salta hacia arriba más de lo que mide una fila (los chips se envuelven).
    const backwards = stops
      .slice(1)
      .map((s, i) => ({ s, prev: stops[i]! }))
      .filter(({ s, prev }) => s.top < prev.top - 60)
      .map(({ s, prev }) => `${prev.label} -> ${s.label}`)
    expect(backwards, 'saltos de foco hacia arriba').toEqual([])
  })

  test('el agendamiento completo se hace solo con teclado', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Agenda tu cita' })).toBeVisible()

    await tabTo(page, serviceCard(page, 'Corte básico'))
    await page.keyboard.press('Enter')
    await expect(serviceCard(page, 'Corte básico')).toHaveAttribute('aria-pressed', 'true')

    await tabTo(page, page.getByRole('button', { name: 'Barbero 1', exact: true }))
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Barbero 1', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const day = page
      .getByRole('group', { name: 'Días disponibles' })
      .locator('button:not([disabled])')
      .first()
    await day.waitFor()
    await tabTo(page, day)
    await page.keyboard.press('Enter')

    // Con teclado, elegir un día mueve el foco al paso siguiente (los horarios).
    const slot = page
      .getByRole('group', { name: 'Horarios disponibles' })
      .getByRole('button')
      .first()
    await slot.waitFor()
    await tabTo(page, slot)
    await page.keyboard.press('Enter')

    await tabTo(page, page.getByLabel('Nombre'))
    await page.keyboard.type('Teclado Prueba')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Celular (WhatsApp)')).toBeFocused()
    await page.keyboard.type(randomPhone())
    await tabTo(page, page.getByRole('checkbox', { name: /Acepto el tratamiento/ }))
    await page.keyboard.press('Space')
    await tabTo(page, page.getByRole('button', { name: 'Confirmar cita' }))
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/cita\/[\w-]+$/)
    await expect(page.getByRole('heading', { name: 'Tu cita está lista' })).toBeVisible()
  })

  test('diálogo: el foco queda atrapado, Escape lo cierra y el foco vuelve al botón', async ({
    page,
    request,
  }) => {
    const booked = await bookViaApi(request, {
      service: 'Corte básico',
      barber: 'Barbero 1',
      dayOffset: 5,
    })
    await page.goto(`/cita/${booked.token}`)
    const opener = page.getByRole('button', { name: 'Cancelar cita' })
    await tabTo(page, opener)
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // El foco entra en el diálogo (en la opción segura: «Mantener mi cita»).
    await expect(dialog.getByRole('button', { name: 'Mantener mi cita' })).toBeFocused()
    // 12 Tab y 12 Shift+Tab: el foco nunca sale del diálogo.
    for (const key of [...Array(12).fill('Tab'), ...Array(12).fill('Shift+Tab')]) {
      await page.keyboard.press(key)
      // Dentro del diálogo, o en el navegador (body) cuando el ciclo pasa por la barra del
      // navegador; nunca en la página de atrás, que queda inerte.
      const ok = await dialog.evaluate(
        (el) => el.contains(document.activeElement) || document.activeElement === document.body,
      )
      expect(ok, `el foco salió del diálogo con ${key}`).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(opener).toBeFocused()
  })
})

test.describe('Movimiento reducido', () => {
  // `motion-reduce:transition-none` pone transition-property en none (la duración no importa).
  const transitionOf = (page: Page) =>
    serviceCard(page, 'Corte básico').evaluate((el) => getComputedStyle(el).transitionProperty)

  test('con prefers-reduced-motion: reduce no hay transiciones', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(serviceCard(page, 'Corte básico')).toBeVisible()
    expect(await transitionOf(page)).toBe('none')
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
    ).toBe('auto')
  })

  test('sin esa preferencia sí se mantienen las transiciones de color de 150 ms', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await expect(serviceCard(page, 'Corte básico')).toBeVisible()
    expect(await transitionOf(page)).toContain('color')
    expect(
      await serviceCard(page, 'Corte básico').evaluate(
        (el) => getComputedStyle(el).transitionDuration,
      ),
    ).toContain('0.15s')
  })
})

test.describe('Zoom y reflujo (WCAG 1.4.10 y 1.4.4)', () => {
  const noHorizontalScroll = (page: Page) =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )

  // 320 px de ancho CSS equivale a 400 % de zoom en un escritorio de 1280 px.
  test.describe('a 320 px', () => {
    test.use({ viewport: { width: 320, height: 640 } })
    for (const path of ['/', '/productos', '/privacidad', '/ingresar', '/offline', '/no-existe']) {
      test(`${path} no desborda horizontalmente`, async ({ page }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        expect(await noHorizontalScroll(page)).toBe(true)
      })
    }
  })

  // 200 % de zoom sobre un celular de 390 px = 195 px; sobre el texto, 200 % de tamaño de letra.
  test.describe('con el texto al 200 %', () => {
    test.use({ viewport: { width: 390, height: 844 } })
    test('/ sigue legible: nada se corta ni se solapa y los botones conservan su nombre', async ({
      page,
    }) => {
      await page.addInitScript(() => {
        document.documentElement.style.fontSize = '200%'
      })
      await page.goto('/')
      await expect(serviceCard(page, 'Corte básico')).toBeVisible()
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%'
      })
      expect(await noHorizontalScroll(page)).toBe(true)
      // El botón principal sigue alcanzable con el texto grande.
      await serviceCard(page, 'Corte básico').click()
      await expect(page.getByRole('button', { name: 'Confirmar cita' })).toBeAttached()
    })
  })

  // Barbero a 320 px y admin a 640 px (200 % de zoom sobre un escritorio de 1280 px): la página
  // no se desplaza de lado; las rejillas anchas (agenda del admin) se desplazan dentro de su caja.
  test.describe('con sesión', () => {
    async function login(page: Page, email: string) {
      await page.goto('/ingresar')
      await page.getByLabel('Correo').fill(email)
      await page.getByLabel('Contraseña').fill('cambiar-esto')
      await page.getByRole('button', { name: 'Ingresar' }).click()
      await expect(page).not.toHaveURL(/ingresar/)
    }

    test.describe('barbero a 320 px', () => {
      test.use({ viewport: { width: 320, height: 640 } })
      test('agenda, nueva cita y horario', async ({ page }) => {
        await login(page, 'barbero1@imperio.test')
        for (const path of ['/barbero', '/barbero/nueva', '/barbero/horario']) {
          await page.goto(path)
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
          expect(await noHorizontalScroll(page), path).toBe(true)
        }
      })
    })

    test.describe('admin a 640 px', () => {
      test.use({ viewport: { width: 640, height: 800 } })
      test('todas las pantallas', async ({ page }) => {
        await login(page, 'admin@imperio.test')
        for (const path of [
          '/admin',
          '/admin/agenda',
          '/admin/semana',
          '/admin/servicios',
          '/admin/productos',
          '/admin/barberos',
          '/admin/clientes',
        ]) {
          await page.goto(path)
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
          expect(await noHorizontalScroll(page), path).toBe(true)
        }
      })
    })
  })
})
