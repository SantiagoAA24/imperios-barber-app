// Presupuesto de tamaño del paquete (corre después de `pnpm build`):
//   1. El JavaScript inicial (lo que index.html carga al abrir «/») pesa <= 180 KB comprimido (gzip).
//   2. Las áreas del barbero y del admin viajan fuera de ese paquete (chunks aparte y sin
//      referencias desde index.html ni textos propios de esas áreas en el paquete inicial).
// Uso: node scripts/check-bundle-size.mjs [dist]   (BUDGET_KB para cambiar el límite)
// Para ver qué ocupa cada módulo: ANALYZE=1 pnpm build  ->  dist-stats/stats.html
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(process.argv[2] ?? resolve(here, '../dist'))
const BUDGET = Number(process.env.BUDGET_KB ?? 180) * 1000 // «kB» de Vite = 1000 bytes

const html = readFileSync(resolve(dist, 'index.html'), 'utf8')
const initial = [
  ...new Set(
    [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map(
      (m) => m[1],
    ),
  ),
]
if (initial.length === 0) throw new Error(`No se encontró JavaScript inicial en ${dist}/index.html`)

const gz = (file) => gzipSync(readFileSync(resolve(dist, `.${file}`)), { level: 9 }).length
const kb = (n) => `${(n / 1000).toFixed(1)} kB`
const all = readdirSync(resolve(dist, 'assets')).filter((f) => f.endsWith('.js'))

let total = 0
console.log('JavaScript inicial (index.html):')
for (const file of initial) {
  const size = gz(file)
  total += size
  console.log(`  ${file.replace('/assets/', '').padEnd(34)} ${kb(size).padStart(9)} gzip`)
}
console.log(`  ${'TOTAL'.padEnd(34)} ${kb(total).padStart(9)} gzip  (límite ${kb(BUDGET)})`)

const initialNames = new Set(initial.map((f) => f.replace('/assets/', '')))
const lazy = all.filter((f) => !initialNames.has(f))
console.log('\nFuera del paquete inicial (carga bajo demanda):')
for (const file of lazy)
  console.log(`  ${file.padEnd(34)} ${kb(gz(`/assets/${file}`)).padStart(9)} gzip`)

const problems = []
if (total > BUDGET)
  problems.push(`El JavaScript inicial pesa ${kb(total)} y el límite es ${kb(BUDGET)}.`)
for (const area of ['BarberArea', 'AdminArea']) {
  if (!lazy.some((f) => f.startsWith(`${area}-`))) {
    problems.push(`No hay un chunk ${area}-*.js aparte: el área entró al paquete inicial.`)
  }
}
// Textos que solo existen en las áreas de personal: si aparecen en el inicial, se filtraron.
const MARKERS = ['Citas por revisar', 'Administrar productos', 'Mi horario', 'Agenda de la semana']
for (const file of initial) {
  const source = readFileSync(resolve(dist, `.${file}`), 'utf8')
  for (const marker of MARKERS) {
    if (source.includes(marker)) {
      problems.push(`«${marker}» (propio del barbero o del admin) está en ${file}.`)
    }
  }
}

if (problems.length > 0) {
  console.error(`\nPresupuesto NO cumplido:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  process.exit(1)
}
console.log('\nPresupuesto cumplido: JS inicial dentro del límite y las áreas de personal aparte.')
