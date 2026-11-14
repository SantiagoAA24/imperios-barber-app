// Fase 8: recordatorio por WhatsApp y «citas por revisar», de punta a punta con la API real.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { bogotaDayOf, seedAppointment } from './helpers'

const PASSWORD = 'cambiar-esto'

async function login(page: Page, email: string, url: RegExp) {
  await page.goto('/ingresar')
  await page.getByLabel('Correo').fill(email)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(url)
}

test.describe('Recordatorio por WhatsApp (barbero)', () => {
  test('abre wa.me con el mensaje, marca el envío y el botón pasa a «Recordatorio enviado»', async ({
    page,
    context,
  }) => {
    const name = `Recordar ${Date.now()}`
    const phone = '+573001112233'
    const startsAt = seedAppointment({ startsInHours: 3, clientName: name, phone })
    const far = seedAppointment({
      startsInHours: 30,
      clientName: `${name} lejano`,
      phone: '+573001112244',
    })

    // wa.me no existe en el entorno de pruebas: se atiende la pestaña nueva con una página vacía.
    await context.route('https://wa.me/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>WhatsApp</title>' }),
    )

    await login(page, 'barbero1@imperio.test', /\/barbero$/)
    await page.goto(`/barbero?fecha=${bogotaDayOf(startsAt)}`)
    const card = page
      .getByRole('article')
      .filter({ hasText: name })
      .filter({ hasNotText: 'lejano' })
    await expect(card).toBeVisible()

    // El botón solo aparece si falta menos de 24 horas.
    expect(far).toBeTruthy()
    const remind = card.getByRole('link', { name: /^Recordar por WhatsApp/ })
    await expect(remind).toHaveAttribute('target', '_blank')
    await expect(remind).toHaveAttribute('rel', /noopener/)

    const [popup] = await Promise.all([context.waitForEvent('page'), remind.click()])
    const url = new URL(popup.url())
    expect(url.origin + url.pathname).toBe('https://wa.me/573001112233')
    const text = url.searchParams.get('text') ?? ''
    expect(text).toMatch(
      new RegExp(`^Hola Recordar, te recordamos tu cita en Imperio Barber: Corte básico, `),
    )
    expect(text).toMatch(
      / a las \d{1,2}:\d{2} (am|pm)\. Te esperamos; tenemos 5 minutos de tolerancia\./,
    )
    expect(text).toMatch(/Si no puedes venir, respóndenos por aquí\.$/)
    expect(text).not.toMatch(/https?:|\/cita\//)
    await popup.close()

    // Se registró el envío y el botón lo dice (y se puede reenviar).
    const sent = card.getByRole('link', { name: /^Recordatorio enviado hace/ })
    await expect(sent).toBeVisible()
    await page.reload()
    await expect(
      page
        .getByRole('article')
        .filter({ hasText: name })
        .filter({ hasNotText: 'lejano' })
        .getByRole('link', { name: /^Recordatorio enviado hace/ }),
    ).toBeVisible()
    const api = await page.request.get(`/api/v1/me/appointments?date=${bogotaDayOf(startsAt)}`)
    const agenda = (await api.json()) as {
      appointments: Array<{ client: { name: string }; reminder_sent_at: string | null }>
    }
    expect(agenda.appointments.find((a) => a.client.name === name)?.reminder_sent_at).toBeTruthy()

    // La cita de pasado mañana no ofrece recordatorio.
    await page.goto(`/barbero?fecha=${bogotaDayOf(far)}`)
    const lejano = page.getByRole('article').filter({ hasText: `${name} lejano` })
    await expect(lejano).toBeVisible()
    await expect(
      lejano.getByRole('link', { name: /Recordar por WhatsApp|Recordatorio enviado/ }),
    ).toHaveCount(0)
  })
})

test.describe('Citas por revisar', () => {
  test('el barbero las marca como atendida o no asistió y bajan el número de la insignia', async ({
    page,
  }) => {
    const a = `Revisar A ${Date.now()}`
    const b = `Revisar B ${Date.now()}`
    seedAppointment({ startsInHours: -72, clientName: a })
    seedAppointment({ startsInHours: -48, clientName: b })
    seedAppointment({ startsInHours: -1, clientName: 'Terminó hace menos de dos horas' }) // aún no

    await login(page, 'barbero1@imperio.test', /\/barbero$/)
    const section = page.getByRole('region', { name: 'Citas por revisar' })
    await expect(section).toBeVisible()
    await expect(section.getByText(a)).toBeVisible()
    await expect(section.getByText('Terminó hace menos de dos horas')).toHaveCount(0)
    const badge = page.getByRole('link', { name: /^Agenda \d+ citas? por revisar$/ })
    const before = Number(
      /(\d+) citas? por revisar/.exec((await badge.locator('.sr-only').textContent()) ?? '')?.[1],
    )
    expect(before).toBeGreaterThanOrEqual(2)

    await section.getByRole('button', { name: new RegExp(`^Atendida: ${a}`) }).click()
    await expect(section.getByText(a)).toHaveCount(0)
    await expect(page.getByText(`Cita de ${a} marcada como atendida.`)).toBeAttached()
    await section.getByRole('button', { name: new RegExp(`^No asistió: ${b}`) }).click()
    await expect(section.getByText(b)).toHaveCount(0)
    if (before === 2) {
      await expect(page.getByRole('link', { name: 'Agenda', exact: true })).toBeVisible()
    } else {
      await expect(
        page.getByRole('link', { name: `Agenda ${before - 2} citas por revisar` }),
      ).toBeVisible()
    }

    // Quedó guardado: la recarga no las trae de vuelta.
    await page.reload()
    await expect(page.getByText(a)).toHaveCount(0)
    await expect(page.getByText(b)).toHaveCount(0)
  })

  test('el admin ve las de todo el negocio y las marca desde la agenda', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const name = `Admin revisar ${Date.now()}`
    seedAppointment({ startsInHours: -96, clientName: name })

    await login(page, 'admin@imperio.test', /\/admin$/)
    await expect(page.getByRole('link', { name: /^Agenda \d+ citas? por revisar$/ })).toBeVisible()
    await page.getByRole('link', { name: /^Agenda/ }).click()
    const section = page.getByRole('region', { name: 'Citas por revisar' })
    await expect(section.getByText(name)).toBeVisible()
    await expect(section.getByText(/Barbero 1/).first()).toBeVisible()
    await section.getByRole('button', { name: new RegExp(`^No asistió: ${name}`) }).click()
    await expect(section.getByText(name)).toHaveCount(0)
    const res = await page.request.get('/api/v1/admin/appointments/pending-review')
    expect(
      ((await res.json()) as { items: Array<{ client: { name: string } }> }).items.map(
        (i) => i.client.name,
      ),
    ).not.toContain(name)
  })
})
