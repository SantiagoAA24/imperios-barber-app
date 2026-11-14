import { execFileSync } from 'node:child_process'
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

/** Día de calendario en Bogotá de un instante ISO (AAAA-MM-DD). */
export function bogotaDayOf(iso: string): string {
  return dayFormat.format(new Date(iso))
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
  options: {
    service: string
    barber: string
    dayOffset: number
    slotIndex?: number
    clientName?: string
    phone?: string
  },
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
        client: {
          name: options.clientName ?? 'Cliente de prueba',
          phone: options.phone ?? randomPhone(),
        },
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

/** Base de datos de las E2E (la crea y siembra scripts/e2e-setup.sh). */
const E2E_DB_URL = 'postgresql://imperio:imperio@localhost:5432/imperio_e2e'

/**
 * Inserta (con SQL) una cita de Barbero 1 empezando dentro de `startsInHours` horas (negativo = en
 * el pasado). La API no deja crear citas en el pasado ni pasar de reserva a «vencida» sin esperar,
 * y justo eso es lo que «Citas por revisar» y los recordatorios tienen que mostrar.
 * Devuelve el instante ISO de inicio.
 */
export function seedAppointment(options: {
  startsInHours: number
  clientName: string
  status?: 'booked' | 'attended' | 'no_show' | 'cancelled'
  phone?: string
  /** Sin desplazar la hora aunque choque con otra cita (por defecto se desplaza hasta encontrar hueco). */
  exact?: boolean
}): string {
  const { startsInHours, clientName, status = 'booked' } = options
  const phone = options.phone ?? `+57300${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`
  // Barbero 1 no puede tener dos citas a la vez (restricción de exclusión): si otra prueba dejó
  // una a esa hora, se corre 37 minutos más lejos del presente hasta encontrar hueco.
  const direction = startsInHours < 0 ? -1 : 1
  for (let attempt = 0; attempt < 12; attempt++) {
    const minutes = Math.round(startsInHours * 60) + direction * attempt * 37
    const start = `date_trunc('minute', now()) + interval '${minutes} minutes'`
    const sql = `
      WITH c AS (
        INSERT INTO client (business_id, name, phone_e164)
        SELECT b.business_id, '${clientName}', '${phone}'
        FROM barber b WHERE b.display_name = 'Barbero 1'
        ON CONFLICT (business_id, phone_e164) WHERE phone_e164 IS NOT NULL
          DO UPDATE SET name = EXCLUDED.name
        RETURNING id, business_id
      )
      INSERT INTO appointment (business_id, barber_id, client_id, service_id, starts_at, ends_at,
                               status, source, price_cop, duration_min, manage_token_hash)
      SELECT c.business_id, b.id, c.id, s.id, ${start}, ${start} + interval '30 minutes',
             '${status}', 'manual', s.price_cop, 30, md5(random()::text)
      FROM c, barber b, service s
      WHERE b.display_name = 'Barbero 1' AND s.name = 'Corte básico' AND s.business_id = c.business_id
      RETURNING starts_at;`
    try {
      const out = execFileSync('psql', [E2E_DB_URL, '-v', 'ON_ERROR_STOP=1', '-tA', '-c', sql], {
        env: { ...process.env, PGPASSWORD: 'imperio' },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return new Date(out.split('\n')[0]?.trim() ?? '').toISOString()
    } catch (error) {
      const overlap = String((error as { stderr?: unknown }).stderr).includes(
        'appointment_no_barber_overlap',
      )
      if (!overlap || options.exact) throw error
    }
  }
  throw new Error('No se encontró hueco libre para sembrar la cita')
}

/** Cita «pendiente» que terminó hace `daysAgo` días (por revisar). Devuelve el nombre del cliente. */
export function seedOverdueAppointment(daysAgo = 3, clientName = 'Cliente por revisar'): string {
  seedAppointment({ startsInHours: -24 * daysAgo, clientName })
  return clientName
}
