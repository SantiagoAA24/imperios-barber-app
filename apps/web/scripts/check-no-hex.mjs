// Falla si apps/web/src contiene colores hexadecimales o rgb()/rgba() fuera de tokens.css.
// Los colores viven solo en packages/tokens (generado desde design-system/tokens.json).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../src')
const EXTENSIONS = /\.(css|tsx?|jsx?|html|svg|mjs)$/
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g
const FUNC = /\brgba?\s*\(/gi

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* walk(path)
    else if (EXTENSIONS.test(name) && name !== 'tokens.css') yield path
  }
}

const problems = []
for (const file of walk(root)) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      for (const match of line.matchAll(HEX)) {
        // `&#123;` es una entidad HTML, no un color.
        if (line[match.index - 1] === '&') continue
        problems.push(`${relative(root, file)}:${index + 1}  ${match[0]}`)
      }
      for (const match of line.matchAll(FUNC)) {
        problems.push(`${relative(root, file)}:${index + 1}  ${match[0]}…)`)
      }
    })
}

if (problems.length > 0) {
  console.error('Hay colores fuera de los tokens (usa var(--color-*) o clases de Tailwind):')
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log('check-no-hex: sin colores hexadecimales ni rgb() en apps/web/src')
