import { expect, test } from '@playwright/test'
import { bookViaApi, daysGroup, serviceCard, slotsGroup, timeLabel } from './helpers'

test.describe('Mi cita', () => {
  test('cancelar: pide confirmación, muestra "Cita cancelada" y el horario vuelve a aparecer', async ({
    page,
    request,
  }) => {
    const booked = await bookViaApi(request, {
      service: 'Corte básico',
      barber: 'Barbero 1',
      dayOffset: 3,
    })
    const time = timeLabel(booked.startsAt)
    const dayNumber = String(Number(booked.date.slice(8)))

    const openDay = async () => {
      await page.goto('/')
      await serviceCard(page, 'Corte básico').click()
      await page.getByRole('button', { name: 'Barbero 1', exact: true }).click()
      await daysGroup(page)
        .getByRole('button', { name: new RegExp(`\\b${dayNumber}\\b`) })
        .click()
    }

    // Mientras la cita existe, ese horario no se ofrece.
    await openDay()
    await expect(slotsGroup(page).getByRole('button').first()).toBeVisible()
    await expect(slotsGroup(page).getByRole('button', { name: time, exact: true })).toHaveCount(0)

    await page.goto(`/cita/${booked.token}`)
    await expect(page.getByRole('heading', { name: 'Tu cita está lista' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar cita' }).click()
    const dialog = page.getByRole('dialog', { name: '¿Cancelar tu cita?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Sí, cancelar cita' }).click()

    await expect(page.getByRole('heading', { name: 'Cita cancelada' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Agendar otra cita' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancelar cita' })).toHaveCount(0)

    await openDay()
    await expect(slotsGroup(page).getByRole('button', { name: time, exact: true })).toBeVisible()
  })

  test('el diálogo de cancelar cierra con Escape y devuelve el foco al botón', async ({
    page,
    request,
  }) => {
    const booked = await bookViaApi(request, {
      service: 'Corte básico',
      barber: 'Barbero 2',
      dayOffset: 4,
    })
    await page.goto(`/cita/${booked.token}`)
    const trigger = page.getByRole('button', { name: 'Cancelar cita' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: '¿Cancelar tu cita?' })
    await expect(dialog).toBeVisible()
    // La opción segura recibe el foco al abrir.
    await expect(dialog.getByRole('button', { name: 'Mantener mi cita' })).toBeFocused()
    // Foco atrapado: con Tab nunca llega a la página de atrás (como mucho sale a la barra del
    // navegador, y entonces el elemento activo es <body>).
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      const trapped = await page.evaluate(() => {
        const active = document.activeElement
        return active === document.body || !!active?.closest('dialog')
      })
      expect(trapped).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    // La cita sigue activa.
    await expect(page.getByRole('heading', { name: 'Tu cita está lista' })).toBeVisible()
  })

  test('reprogramar: mueve la cita a otro horario y muestra la nueva hora', async ({
    page,
    request,
  }) => {
    const booked = await bookViaApi(request, {
      service: 'Corte básico',
      barber: 'Barbero 1',
      dayOffset: 5,
    })
    const oldTime = timeLabel(booked.startsAt)
    const dayNumber = String(Number(booked.date.slice(8)))

    await page.goto(`/cita/${booked.token}`)
    await expect(page.getByLabel('Resumen de tu cita')).toContainText(oldTime)
    await page.getByRole('button', { name: 'Reprogramar' }).click()
    await expect(page.getByRole('heading', { name: 'Elige un nuevo horario' })).toBeVisible()

    await daysGroup(page)
      .getByRole('button', { name: new RegExp(`\\b${dayNumber}\\b`) })
      .click()
    const last = slotsGroup(page).getByRole('button').last()
    await last.waitFor()
    const newTime = ((await last.textContent()) ?? '').trim()
    expect(newTime).not.toBe(oldTime)
    await last.click()
    await page.getByRole('button', { name: 'Confirmar nuevo horario' }).click()

    await expect(page.getByText('Listo: cambiamos tu cita al nuevo horario.')).toBeVisible()
    await expect(page.getByLabel('Resumen de tu cita')).toContainText(newTime)
    await expect(page.getByLabel('Resumen de tu cita')).not.toContainText(oldTime)
    await page.reload()
    await expect(page.getByLabel('Resumen de tu cita')).toContainText(newTime)
  })

  test('"Agregar al calendario" descarga imperio-cita.ics', async ({ page, request }) => {
    const booked = await bookViaApi(request, {
      service: 'Corte + barba',
      barber: 'Barbero 2',
      dayOffset: 6,
    })
    await page.goto(`/cita/${booked.token}`)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Agregar al calendario' }).click(),
    ])
    expect(download.suggestedFilename()).toBe('imperio-cita.ics')
    const stream = await download.createReadStream()
    let text = ''
    for await (const chunk of stream) text += chunk.toString()
    expect(text).toContain('BEGIN:VCALENDAR')
    expect(text).toContain('SUMMARY:Cita en Imperio Barber')
    expect(text).toContain('Corte + barba')
  })

  test('un token inválido muestra el aviso y un enlace a "/"', async ({ page }) => {
    await page.goto('/cita/token-que-no-existe')
    await expect(page.getByRole('heading', { name: 'No encontramos tu cita' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Agendar una cita' })).toHaveAttribute('href', '/')
  })
})
