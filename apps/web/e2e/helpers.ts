import { expect } from '@playwright/test'
import type { APIRequestContext, Locator, Page } from '@playwright/test'

export const API = '/api/v1/public'

/** Celular colombiano al azar: cada prueba usa el suyo (la API limita las citas activas por celular). */
export function randomPhone(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')
  return `3${digits}`
}

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Bogota',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/** Día de calendario en Bogotá, `offset` días después de hoy (AAAA-MM-DD). */
export function bogotaDay(offset = 0): string {
  return dayFormat.format(new Date(Date.now() + offset * 86_400_000))
}

/** '10:30 am', como lo muestra la app. */
export function timeLabel(iso: string): string {
  return timeFormat
    .format(new Date(iso))
    .replace(/\s?(AM|PM)/, (_, p: string) => ` ${p.toLowerCase()}`)
}

type Service = { id: string; name: string }
type Barber = { id: string; display_name: string }
type Slot = { starts_at: string }

async function json<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(response.ok(), `${response.url()} -> ${response.status()}`).toBe(true)
  return (await response.json()) as T
}

/**
 * Agenda una cita directamente por la API (sin pasar por la pantalla) y devuelve su token.
 * `dayOffset` de 3 o más garantiza que cae dentro del plazo para cancelar y reprogramar.
 */
export async function bookViaApi(
  request: APIRequestContext,
  options: { service: string; barber: string; dayOffset: number; slotIndex?: number },
) {
  const services = await json<Service[]>(await request.get(`${API}/services`))
  const barbers = await json<Barber[]>(await request.get(`${API}/barbers`))
  const service = services.find((s) => s.name === options.service)
  const barber = barbers.find((b) => b.display_name === options.barber)
  if (!service || !barber) throw new Error('El seed no trae ese servicio o ese barbero')
  const date = bogotaDay(options.dayOffset)
  const availability = await json<{ slots: Slot[] }>(
    await request.get(`${API}/availability`, {
      params: { service_id: service.id, barber_id: barber.id, date },
    }),
  )
  const slot = availability.slots[options.slotIndex ?? 0]
  if (!slot) throw new Error(`Sin horarios el ${date}`)
  const created = await json<{ manage_token: string }>(
    await request.post(`${API}/appointments`, {
      data: {
        service_id: service.id,
        barber_id: barber.id,
        starts_at: slot.starts_at,
        client: { name: 'Cliente de prueba', phone: randomPhone() },
        consent: true,
        website: '',
      },
    }),
  )
  return { token: created.manage_token, startsAt: slot.starts_at, date, service, barber }
}

export function serviceCard(page: Page, name: string): Locator {
  // El nombre accesible incluye duración y precio: "Corte básico 30 min $22.000".
  return page.getByRole('button', { name: new RegExp(`^${name.replace(/[+]/g, '\\+')} (\\d|~)`) })
}

export const daysGroup = (page: Page) => page.getByRole('group', { name: 'Días disponibles' })
export const slotsGroup = (page: Page) => page.getByRole('group', { name: 'Horarios disponibles' })

/** Rellena nombre, celular y consentimiento. */
export async function fillClient(page: Page, phone = randomPhone(), name = 'Juan Pérez') {
  await page.getByLabel('Nombre').fill(name)
  await page.getByLabel('Celular (WhatsApp)').fill(phone)
  await page.getByRole('checkbox', { name: /Acepto el tratamiento/ }).check()
  return { name, phone }
}

/** Elige servicio y barbero, el primer día con cupo y el primer horario; devuelve la hora elegida. */
export async function pickFirstSlot(page: Page, service: string, barber = 'Cualquiera') {
  await serviceCard(page, service).click()
  await page.getByRole('button', { name: barber, exact: true }).click()
  const firstOpenDay = daysGroup(page).locator('button:not([disabled])').first()
  await firstOpenDay.waitFor()
  await firstOpenDay.click()
  const first = slotsGroup(page).getByRole('button').first()
  await first.waitFor()
  const time = (await first.textContent()) ?? ''
  await first.click()
  return time
}
