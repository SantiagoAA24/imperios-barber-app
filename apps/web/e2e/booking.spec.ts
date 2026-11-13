import { expect, test } from '@playwright/test'
import { fillClient, pickFirstSlot, randomPhone, serviceCard, slotsGroup } from './helpers'

test.describe('Agendar', () => {
  test('camino feliz: agenda, llega a /cita/<token> y la recarga conserva la cita', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Agenda tu cita', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cualquiera', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const time = await pickFirstSlot(page, 'Corte + barba', 'Cualquiera')
    // La barra de resumen usa los datos reales, no un texto fijo.
    const summary = page.getByLabel('Resumen', { exact: true })
    await expect(summary).toContainText(`Corte + barba · `)
    await expect(summary).toContainText(time)
    await expect(summary).toContainText('$27.000')

    await fillClient(page)
    await page.getByRole('button', { name: 'Confirmar cita' }).click()

    await expect(page).toHaveURL(/\/cita\/[\w-]+$/)
    const token = new URL(page.url()).pathname.split('/').pop() ?? ''
    await expect(page.getByRole('heading', { name: 'Tu cita está lista' })).toBeVisible()
    const card = page.getByLabel('Resumen de tu cita')
    await expect(card).toContainText('Corte + barba')
    await expect(card).toContainText(time)
    await expect(card).toContainText('$27.000')
    await expect(card).toContainText(
      /(lunes|martes|miércoles|jueves|viernes|sábado|domingo) \d{1,2} \w{3,4}/,
    )
    await expect(
      page.getByText(/Llega a tu hora: esperamos hasta 5 minutos después\./),
    ).toBeVisible()
    // El celular nunca se muestra en la cita.
    await expect(page.locator('body')).not.toContainText('+57')

    expect(await page.evaluate(() => localStorage.getItem('imperio:ultima-cita'))).toBe(token)

    // `replace`: Atrás no regresa al formulario ya enviado.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Tu cita está lista' })).toBeVisible()
    await expect(page.getByLabel('Resumen de tu cita')).toContainText('Corte + barba')
    await expect(page.getByLabel('Resumen de tu cita')).toContainText(time)
  })

  test('carrera: el segundo en confirmar recibe alternativas y logra reservar una', async ({
    browser,
    baseURL,
  }) => {
    const options = {
      baseURL,
      viewport: { width: 390, height: 844 },
      locale: 'es-CO',
      timezoneId: 'America/Bogota',
      reducedMotion: 'reduce' as const,
    }
    const first = await (await browser.newContext(options)).newPage()
    const second = await (await browser.newContext(options)).newPage()

    // Con un barbero concreto (con "Cualquiera" el segundo recibiría al otro barbero).
    for (const page of [first, second]) {
      await page.goto('/')
      await pickFirstSlot(page, 'Corte básico', 'Barbero 1')
    }
    const secondPhone = randomPhone()
    await fillClient(second, secondPhone, 'Segundo Cliente')
    await fillClient(first)

    await first.getByRole('button', { name: 'Confirmar cita' }).click()
    await expect(first).toHaveURL(/\/cita\//)

    await second.getByRole('button', { name: 'Confirmar cita' }).click()
    await expect(
      second.getByRole('alert').filter({ hasText: 'Ese horario se acaba de ocupar. Elige otro.' }),
    ).toBeVisible()
    const alternatives = second.getByRole('group', { name: 'Horarios cercanos disponibles' })
    const count = await alternatives.getByRole('button').count()
    expect(count).toBeGreaterThanOrEqual(1)
    expect(count).toBeLessThanOrEqual(3)
    // Lo que escribió se conserva.
    await expect(second.getByLabel('Nombre')).toHaveValue('Segundo Cliente')
    await expect(second.getByLabel('Celular (WhatsApp)')).toHaveValue(secondPhone)
    await expect(second.getByRole('checkbox', { name: /Acepto el tratamiento/ })).toBeChecked()

    await alternatives.getByRole('button').first().click()
    await second.getByRole('button', { name: 'Confirmar cita' }).click()
    await expect(second).toHaveURL(/\/cita\//)
    await expect(second.getByRole('heading', { name: 'Tu cita está lista' })).toBeVisible()
  })

  test('validación: celular inválido muestra el error y sin consentimiento no se puede confirmar', async ({
    page,
  }) => {
    await page.goto('/')
    const confirm = page.getByRole('button', { name: 'Confirmar cita' })
    await expect(confirm).toBeDisabled()

    await page.getByLabel('Celular (WhatsApp)').fill('1234')
    await page.getByLabel('Nombre').click() // al salir del campo se valida
    await expect(page.getByText('Escribe un celular colombiano de 10 dígitos.')).toBeVisible()

    await page.getByLabel('Nombre').fill('A')
    await page.getByLabel('Celular (WhatsApp)').click()
    await expect(page.getByText('Escribe tu nombre (entre 2 y 60 caracteres).')).toBeVisible()

    // Todo válido salvo el consentimiento: el botón sigue deshabilitado.
    await pickFirstSlot(page, 'Corte básico')
    await page.getByLabel('Nombre').fill('Juan Pérez')
    await page.getByLabel('Celular (WhatsApp)').fill('+57 300 123 4567')
    await expect(page.getByText('Escribe un celular colombiano de 10 dígitos.')).toBeHidden()
    await expect(confirm).toBeDisabled()
    await page.getByRole('checkbox', { name: /Acepto el tratamiento/ }).check()
    await expect(confirm).toBeEnabled()
  })

  test('al cambiar de servicio se limpia la hora elegida', async ({ page }) => {
    await page.goto('/')
    await pickFirstSlot(page, 'Corte básico')
    await expect(slotsGroup(page).locator('[aria-pressed="true"]')).toHaveCount(1)
    await serviceCard(page, 'Limpieza facial').click()
    await expect(slotsGroup(page).locator('[aria-pressed="true"]')).toHaveCount(0)
    await expect(page.getByLabel('Resumen', { exact: true })).toContainText('Elige una hora')
  })

  test('el campo trampa está fuera de pantalla y fuera del orden de tabulación', async ({
    page,
  }) => {
    await page.goto('/')
    const trap = page.locator('input[name="website"]')
    await expect(trap).toHaveAttribute('tabindex', '-1')
    await expect(trap).toHaveAttribute('autocomplete', 'off')
    const box = await trap.boundingBox()
    expect(box === null || box.x + box.width < 0).toBe(true)
    await expect(trap.locator('xpath=ancestor::div[@aria-hidden="true"]')).toHaveCount(1)
  })
})
