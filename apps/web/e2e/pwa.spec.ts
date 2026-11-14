// Instalabilidad y acabado: Lighthouse ya no mide PWA, así que se comprueba aquí que el navegador
// tiene todo lo que pide para ofrecer «Instalar» (manifest con nombre, íconos 192 y 512, maskable,
// start_url y display; service worker activo) y las etiquetas del <head>.
import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

type Icon = { src: string; sizes: string; type: string; purpose?: string }
type Manifest = {
  name: string
  short_name: string
  start_url: string
  scope: string
  display: string
  lang: string
  theme_color: string
  background_color: string
  icons: Icon[]
}

/** Ancho y alto leídos del encabezado IHDR de un PNG (sin depender de ninguna librería). */
function pngSize(body: Buffer): { width: number; height: number } {
  expect(body.subarray(1, 4).toString('ascii')).toBe('PNG')
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) }
}

async function fetchPng(request: APIRequestContext, path: string) {
  const response = await request.get(path)
  expect(response.status(), path).toBe(200)
  expect(response.headers()['content-type'], path).toContain('image/png')
  return pngSize(await response.body())
}

test.describe('PWA instalable', () => {
  test('el manifest declara nombre, íconos 192 y 512, maskable, start_url y display', async ({
    page,
    request,
  }) => {
    await page.goto('/')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href).toBeTruthy()
    const response = await request.get(href ?? '')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toMatch(/manifest\+json|application\/json/)
    const manifest = (await response.json()) as Manifest

    expect(manifest.name).toBe('Imperio Barber')
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.lang).toBe('es-CO')
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i)

    const any = manifest.icons.filter((i) => (i.purpose ?? 'any').split(' ').includes('any'))
    const maskable = manifest.icons.filter((i) => (i.purpose ?? '').split(' ').includes('maskable'))
    expect(any.map((i) => i.sizes).sort()).toEqual(['192x192', '512x512'])
    expect(maskable.map((i) => i.sizes)).toEqual(['512x512'])

    // Cada ícono existe y mide lo que dice.
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split('x').map(Number)
      expect(icon.type).toBe('image/png')
      expect(await fetchPng(request, icon.src), icon.src).toEqual({ width: w, height: h })
    }
    // El `theme-color` del <head> coincide con el del manifest.
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      manifest.theme_color,
    )
  })

  test('el service worker queda activo y toma el control; /offline funciona sin red', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    // `ready` resuelve cuando hay un worker activo, pero puede estar aún «activating».
    await page.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.ready
      return registration.active?.state === 'activated'
    })
    await page.reload()
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

    await context.setOffline(true)
    await page.goto('/offline')
    await expect(page.getByRole('heading', { name: 'Sin conexión', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Volver al inicio' })).toBeVisible()
    await context.setOffline(false)
  })
})

test.describe('Metadatos del <head>', () => {
  test('idioma, título, descripción, favicon, apple-touch-icon y theme-color', async ({
    page,
    request,
  }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-CO')
    await expect(page).toHaveTitle('Agendar cita · Imperio Barber')
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /Agenda tu cita/,
    )
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1)

    expect((await request.get('/favicon.ico')).status()).toBe(200)
    expect(await fetchPng(request, '/icons/favicon-32.png')).toEqual({ width: 32, height: 32 })
    const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
    expect(await fetchPng(request, touch ?? '')).toEqual({ width: 180, height: 180 })
  })

  test('Open Graph: título, descripción e imagen de 1200 x 630 para compartir el enlace', async ({
    page,
    request,
  }) => {
    await page.goto('/')
    const og = (name: string) => page.locator(`meta[property="${name}"]`).getAttribute('content')
    expect(await og('og:title')).toBe('Imperio Barber — Agenda tu cita')
    expect(await og('og:description')).toMatch(/sin registro/i)
    expect(await og('og:type')).toBe('website')
    expect(await og('og:image:width')).toBe('1200')
    expect(await og('og:image:height')).toBe('630')
    const image = await og('og:image')
    expect(image).toMatch(/\/og-image\.png$/)
    expect(await fetchPng(request, new URL(image ?? '', page.url()).pathname)).toEqual({
      width: 1200,
      height: 630,
    })
  })

  test('robots.txt permite «/» y bloquea /admin, /barbero y /cita/', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/plain')
    const lines = (await response.text()).split('\n').map((l) => l.trim())
    expect(lines).toContain('User-agent: *')
    expect(lines).toContain('Allow: /')
    for (const path of ['/admin', '/barbero', '/cita/'])
      expect(lines).toContain(`Disallow: ${path}`)
  })
})

test.describe('Título por ruta', () => {
  for (const [path, title] of [
    ['/productos', 'Productos · Imperio Barber'],
    ['/privacidad', 'Política de privacidad · Imperio Barber'],
    ['/ingresar', 'Ingresar · Imperio Barber'],
    ['/offline', 'Sin conexión · Imperio Barber'],
    ['/ruta-que-no-existe', 'Página no encontrada · Imperio Barber'],
  ] as const) {
    test(`${path} -> ${title}`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveTitle(title)
    })
  }
})
