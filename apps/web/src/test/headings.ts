/** Niveles de los encabezados (h1-h6) de un contenedor, en orden de aparición. */
export function headingLevels(root: ParentNode): number[] {
  return [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName.slice(1)))
}

/**
 * Saltos de nivel que rompen la jerarquía (WCAG 1.3.1, regla `heading-order` de axe/Lighthouse):
 * la página debe empezar en h1 y no bajar más de un nivel de golpe (h1 -> h3). Subir es libre.
 */
export function skippedHeadings(levels: number[]): string[] {
  const problems: string[] = []
  if (levels.length > 0 && levels[0] !== 1) problems.push(`empieza en h${levels[0]}`)
  levels.forEach((level, i) => {
    const prev = levels[i - 1]
    if (prev !== undefined && level > prev + 1) problems.push(`h${prev} -> h${level}`)
  })
  return problems
}
