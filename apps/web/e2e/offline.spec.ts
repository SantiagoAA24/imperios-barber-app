import { expect, test } from '@playwright/test'
import { serviceCard } from './helpers'

test('sin red: /productos carga desde caché y / avisa del error de red sin romperse', async ({
  page,
  context,
}) => {
  // Primera visita con red: el service worker se instala y toma el control.
  await page.goto('/')
  await expect(serviceCard(page, 'Corte básico')).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)

  // El service worker toma el control en la siguiente carga; desde ahí el catálogo pasa por él
  // y queda en caché.
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await expect(serviceCard(page, 'Corte básico')).toBeVisible()
  await page.goto('/productos')
  await expect(page.getByRole('region', { name: 'Productos' }).locator('article')).toHaveCount(8)

  await context.setOffline(true)

  // El catálogo sale del caché.
  await page.goto('/productos')
  const cards = page.getByRole('region', { name: 'Productos' }).locator('article')
  await expect(cards).toHaveCount(8)
  await expect(cards.filter({ hasText: 'Agotado' })).toHaveCount(2)

  // "/" carga su estructura y los servicios del caché; la disponibilidad nunca se cachea.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Agenda tu cita', level: 1 })).toBeVisible()
  await serviceCard(page, 'Corte básico').click()
  const alert = page.getByRole('alert').filter({ hasText: 'Revisa tu conexión' })
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('No pudimos cargar los horarios.')
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar cita' })).toBeDisabled()

  // Al volver la red, "Reintentar" recupera los horarios.
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(alert).toBeHidden()
  await expect(page.getByRole('group', { name: 'Horarios disponibles' })).toBeVisible()
})
