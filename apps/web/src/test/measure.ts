/** Alto mínimo declarado en CSS (jsdom no calcula layout): el mayor entre `min-height` y `height`. */
export function declaredHeight(element: Element): number {
  const style = getComputedStyle(element)
  const values = [style.minHeight, style.height]
    .map((v) => parseFloat(v))
    .filter((n) => !Number.isNaN(n))
  return values.length === 0 ? 0 : Math.max(...values)
}
