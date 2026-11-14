// Resume los informes de Lighthouse CI (mediana de las corridas por URL).
// Uso: node scripts/lhci-summary.mjs [carpeta]   (por defecto lhci-report; .lighthouseci tras `lhci collect`)
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const dir = resolve(process.argv[2] ?? 'lhci-report')
const byUrl = {}
for (const file of readdirSync(dir).filter(
  (f) => f.endsWith('.report.json') || /^lhr-.*\.json$/.test(f),
)) {
  const r = JSON.parse(readFileSync(resolve(dir, file), 'utf8'))
  const path = new URL(r.finalUrl).pathname
  const a = r.audits
  ;(byUrl[path] ??= []).push({
    performance: Math.round(r.categories.performance.score * 100),
    accesibilidad: Math.round(r.categories.accessibility.score * 100),
    'buenas prácticas': Math.round(r.categories['best-practices'].score * 100),
    seo: Math.round(r.categories.seo.score * 100),
    'LCP (s)': a['largest-contentful-paint'].numericValue / 1000,
    'FCP (s)': a['first-contentful-paint'].numericValue / 1000,
    'TBT (ms)': a['total-blocking-time'].numericValue,
    CLS: a['cumulative-layout-shift'].numericValue,
    'Peso (KB)': a['total-byte-weight'].numericValue / 1024,
  })
}
const median = (values) => [...values].sort((x, y) => x - y)[Math.floor(values.length / 2)]
for (const [path, runs] of Object.entries(byUrl).sort()) {
  console.log(`\n${path}  (mediana de ${runs.length} corridas)`)
  for (const key of Object.keys(runs[0])) {
    const value = median(runs.map((r) => r[key]))
    console.log(
      `  ${key.padEnd(18)} ${Number.isInteger(value) ? value : value.toFixed(key === 'CLS' ? 3 : 2)}`,
    )
  }
}
