// Genera src/tokens.css a partir de design-system/tokens.json (única fuente de verdad).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, '../../../design-system/tokens.json')
const target = resolve(here, '../src/tokens.css')
const tokens = JSON.parse(readFileSync(source, 'utf8'))

const byName = (list) => Object.fromEntries(list.map((t) => [t.name, t.value]))
const color = byName(tokens.color.tokens)
const space = byName(tokens.spacing.tokens)
const radius = byName(tokens.radius.tokens)
const shadow = byName(tokens.shadow.tokens)

const need = (map, name) => {
  if (!(name in map)) throw new Error(`Falta "${name}" en tokens.json`)
  return map[name]
}

// Los nombres de variable siguen el valor en px (--space-4 = 4px), no el nombre del JSON.
const lines = []
const add = (name, value) => lines.push(`  --${name}: ${value};`)
const group = (title) => lines.push('', `  /* ${title} */`)

group('Color')
for (const name of [
  'bg',
  'surface',
  'surface-selected',
  'surface-muted',
  'line',
  'line-strong',
  'gold',
  'gold-edge',
  'on-gold',
  'text',
  'text-muted',
  'text-disabled',
  'success',
  'danger',
]) {
  add(`color-${name}`, need(color, name))
}

group('Tipografía: familias')
add('font-display', need(tokens.type.families, 'display'))
add('font-body', need(tokens.type.families, 'sans'))

group('Tipografía: estilos (tamaño, interlineado, peso)')
for (const g of tokens.type.groups) {
  for (const s of g.styles) {
    add(`text-${s.name}`, s.fontSize)
    add(`text-${s.name}--line-height`, s.lineHeight)
    add(`text-${s.name}--font-weight`, String(s.fontWeight))
    if (s.letterSpacing) add(`text-${s.name}--letter-spacing`, s.letterSpacing)
  }
}

group('Espaciado')
for (const [px, jsonName] of [
  ['4', 'space-1'],
  ['8', 'space-2'],
  ['10', 'space-3'],
  ['14', 'space-4'],
  ['20', 'space-5'],
  ['36', 'space-6'],
]) {
  const value = need(space, jsonName)
  if (value !== `${px}px`) throw new Error(`${jsonName} ya no vale ${px}px (vale ${value})`)
  add(`space-${px}`, value)
}

group('Controles y zona táctil')
add('control-46', need(space, 'control-sm'))
add('control-52', need(space, 'control-md'))
add('control-54', need(space, 'control-lg'))
add('touch-min', need(space, 'touch-min'))

group('Radios')
add('radius-12', need(radius, 'radius-sm'))
add('radius-14', need(radius, 'radius-md'))
add('radius-18', need(radius, 'radius-lg'))
add('radius-pill', need(radius, 'radius-pill'))
add('radius-round', need(radius, 'radius-full'))

group('Sombra')
add('shadow-logo-glow', need(shadow, 'logo-glow'))

const css = `/* GENERADO por scripts/build-tokens.mjs desde design-system/tokens.json. No lo edites a mano. */
:root {${lines.join('\n')}
}
`
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, css)
console.log(`tokens.css escrito (${lines.filter((l) => l.startsWith('  --')).length} variables)`)
