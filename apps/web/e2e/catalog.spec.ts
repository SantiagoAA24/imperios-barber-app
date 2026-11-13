import { expect, test } from '@playwright/test'

test('catálogo: 8 productos y los agotados dicen "Agotado"', async ({ page }) => {
  await page.goto('/productos')
  await expect(page.getByRole('heading', { name: 'Productos del local', level: 1 })).toBeVisible()
  const cards = page.getByRole('region', { name: 'Productos' }).locator('article')
  await expect(cards).toHaveCount(8)
  // El seed deja 2 productos en out_of_stock: la palabra, no solo el color.
  await expect(cards.filter({ hasText: 'Agotado' })).toHaveCount(2)
  await expect(cards.filter({ hasText: 'Disponible' })).toHaveCount(6)
  await expect(cards.filter({ hasText: 'Bálsamo para barba' })).toContainText('Agotado')
  await expect(cards.filter({ hasText: 'Cera mate' })).toContainText('$28.000')
  await expect(page.getByText('Se compran directamente en el local.')).toBeVisible()
  // Sin carrito.
  await expect(page.getByRole('button', { name: /carrito|comprar|añadir/i })).toHaveCount(0)
})
