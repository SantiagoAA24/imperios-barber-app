// Extrae los textos visibles al usuario (JSX, atributos accesibles y mensajes) a una tabla
// Markdown para que el dueño los revise: docs/textos.md.
//   pantalla | texto | contexto
// Uso: node scripts/extract-texts.mjs [--check]   (--check falla si docs/textos.md está desactualizado)
//
// No es un análisis semántico: recorre el AST de cada archivo de src/ (sin pruebas) y recoge
//   · texto dentro de elementos JSX            -> contexto = la etiqueta (h1, p, button…)
//   · atributos aria-label, placeholder, title, alt, label, description… -> «lectores de pantalla» o el atributo
//   · cadenas con aspecto de frase (mayúscula inicial y espacios) en el resto del código
// Los mensajes del servidor (errores de la API) se leen de apps/api/app con Python (ver abajo).
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(here, '../src')
const OUT = resolve(here, '../../../docs/textos.md')
const API = resolve(here, '../../api/app')

const ATTRS = new Set([
  'aria-label',
  'placeholder',
  'title',
  'alt',
  'label',
  'description',
  'error',
  'hint',
  'helper',
  'note',
  'sub',
  'subtitle',
])
const SCREEN = [
  [/^app\/pages\/NotFound/, 'Página no encontrada (404)'],
  [/^app\/pages\/Offline/, 'Sin conexión (/offline)'],
  [/^app\/pages\/Privacy/, 'Política de privacidad'],
  [/^app\/ErrorBoundary/, 'Error inesperado (pantalla global)'],
  [/^app\/RouteBoundary/, 'Error al cargar un área'],
  [/^app\/SkipLink/, 'Todas (enlace «Saltar al contenido»)'],
  [/^app\/RutaProtegida/, 'Acceso del personal'],
  [/^app\/layouts\/BarberLayout/, 'Barbero · barra'],
  [/^app\/layouts\/AdminLayout/, 'Admin · barra lateral'],
  [/^app\/App\.tsx/, 'Carga de áreas'],
  [/^features\/booking\//, 'Agendar (/)'],
  [/^features\/appointment\//, 'Tu cita (/cita/…)'],
  [/^features\/catalog\//, 'Productos (/productos)'],
  [/^features\/auth\/Login/, 'Ingresar (/ingresar)'],
  [/^features\/auth\/ChangePassword/, 'Cambiar clave (/cambiar-clave)'],
  [/^features\/barber\/AgendaPage|^features\/barber\/AppointmentRow/, 'Barbero · Mi agenda'],
  [/^features\/barber\/NewAppointment/, 'Barbero · Nueva cita'],
  [/^features\/barber\/(Schedule|Conflict)/, 'Barbero · Mi horario'],
  [/^features\/barber\//, 'Barbero'],
  [/^features\/admin\/(Agenda|NewAppointment|AppointmentPanel)/, 'Admin · Agenda del día'],
  [/^features\/admin\/(Week)/, 'Admin · Agenda de la semana'],
  [/^features\/admin\/Services|^features\/admin\/serviceForm/, 'Admin · Servicios'],
  [/^features\/admin\/Products|^features\/admin\/productForm/, 'Admin · Productos'],
  [/^features\/admin\/Barbers/, 'Admin · Barberos'],
  [/^features\/admin\/(Clients|clientFormat)/, 'Admin · Clientes'],
  [/^features\/admin\/(Overview|Revenue|overviewRange)/, 'Admin · Resumen'],
  [/^features\/admin\//, 'Admin'],
  [/^features\/shared\/PendingReview/, 'Citas por revisar (barbero y admin)'],
  [/^features\/shared\//, 'Varias pantallas'],
  [/^components\//, 'Componentes compartidos'],
  [/^lib\//, 'Varias pantallas'],
]
const screenOf = (file) => SCREEN.find(([re]) => re.test(file))?.[1] ?? 'Otras'

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'test' || name === 'dev' ? [] : walk(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')
      ? [path]
      : []
  })
}

const CLASSY =
  /(^|\s)(flex|grid|gap-|px-|py-|text-|bg-|border|rounded|min-|max-|w-|h-|items-|justify-|font-|absolute|relative|sr-only|outline|focus|hover|motion|disabled|aria-|data-|enabled|transition|shadow|inset|top-|left-|right-|bottom-|z-|cursor|underline|truncate|list-none|overflow|opacity|ring|size-|col-|row-|space-|self-|order-)/
const looksLikeSentence = (s) =>
  /[A-ZÁÉÍÓÚÑ¿¡]/.test(s[0] ?? '') &&
  /\s/.test(s) &&
  /[a-záéíóúñ]/.test(s) &&
  !CLASSY.test(s) &&
  !/^https?:|^\/|\.(png|webp|svg)$/.test(s) &&
  !/^[A-Z-]+:/.test(s)
const CONTEXT = {
  Button: 'botón',
  button: 'botón',
  Link: 'enlace',
  a: 'enlace',
  RetryNotice: 'aviso con «Reintentar»',
  Notice: 'aviso',
  p: 'párrafo',
  span: 'texto',
  li: 'lista',
  th: 'encabezado de columna',
  td: 'celda',
  dt: 'dato (etiqueta)',
  dd: 'dato',
  strong: 'texto destacado',
  label: 'etiqueta de campo',
  caption: 'título de tabla (solo lectores de pantalla)',
  option: 'opción de lista',
  title: 'título de ventana',
  placeholder: 'texto de ayuda en el campo',
  hint: 'ayuda bajo el campo',
  note: 'nota',
  alt: 'texto alternativo de imagen',
  SectionTitle: 'título de sección',
  Checkbox: 'casilla',
  Switch: 'interruptor (nombre)',
  Stat: 'cifra',
  TextField: 'campo',
  SlotPicker: 'horarios',
  section: 'sección',
  div: 'texto',
}
const nice = (c) => CONTEXT[c] ?? c
const clean = (s) => s.replace(/\s+/g, ' ').trim()

const rows = []
function add(file, text, context) {
  const t = clean(text)
  if (t.length < 2 || !/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(t)) return
  rows.push({ screen: screenOf(file), text: t, context: nice(context) })
}

for (const path of walk(SRC)) {
  const file = relative(SRC, path).replaceAll('\\', '/')
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )

  const tagOf = (node) => {
    for (let n = node.parent; n; n = n.parent) {
      if (ts.isJsxElement(n)) return n.openingElement.tagName.getText(source)
      if (ts.isJsxSelfClosingElement(n)) return n.tagName.getText(source)
    }
    return 'texto'
  }
  const inClassName = (node) => {
    for (let n = node.parent; n; n = n.parent) {
      if (ts.isJsxAttribute(n))
        return /^(className|id|name|type|href|to|src|role|key|rel|target|htmlFor|inputMode|autoComplete|value|data-.*|style)$/.test(
          n.name.getText(source),
        )
      if (
        ts.isCallExpression(n) &&
        /^(cx|clsx|useNavigate|navigate|queryKey|api\.\w+|import|require)$/.test(
          n.expression.getText(source).replace(/\(.*/, ''),
        )
      )
        return true
      if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return true
      if (
        ts.isThrowStatement(n) ||
        (ts.isNewExpression(n) && /^Error$/.test(n.expression.getText(source)))
      )
        return true
      if (ts.isCallExpression(n) && /^console\./.test(n.expression.getText(source))) return true
      if (
        ts.isBinaryExpression(n) &&
        [
          ts.SyntaxKind.EqualsEqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ].includes(n.operatorToken.kind)
      )
        return true
      if (
        ts.isCaseClause(n) ||
        ts.isElementAccessExpression(n) ||
        ts.isIndexedAccessTypeNode?.(n) ||
        ts.isTypeNode(n)
      )
        return true
      if (
        ts.isPropertyAssignment(n) &&
        /^(className|queryKey|path|url|key|id|type|to|href|src)$/.test(n.name.getText(source))
      )
        return true
    }
    return false
  }
  const templateText = (node) =>
    ts.isNoSubstitutionTemplateLiteral(node)
      ? node.text
      : [node.head.text, ...node.templateSpans.map((s) => `{…}${s.literal.text}`)].join('')

  const visit = (node) => {
    if (ts.isJsxText(node)) add(file, node.getText(source), tagOf(node))
    else if (ts.isJsxAttribute(node) && node.initializer && ATTRS.has(node.name.getText(source))) {
      const init = node.initializer
      const name = node.name.getText(source)
      const label = name === 'aria-label' ? 'lectores de pantalla (aria-label)' : name
      if (ts.isStringLiteral(init)) add(file, init.text, label)
      else if (
        ts.isJsxExpression(init) &&
        init.expression &&
        (ts.isStringLiteral(init.expression) ||
          ts.isNoSubstitutionTemplateLiteral(init.expression) ||
          ts.isTemplateExpression(init.expression))
      )
        add(
          file,
          ts.isStringLiteral(init.expression)
            ? init.expression.text
            : templateText(init.expression),
          label,
        )
    } else if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node)) &&
      !ts.isJsxAttribute(node.parent) &&
      !inClassName(node)
    ) {
      const text = ts.isStringLiteral(node) ? node.text : templateText(node)
      if (looksLikeSentence(text)) {
        const jsxParent = ts.isJsxExpression(node.parent)
        add(file, text, jsxParent ? tagOf(node) : 'aviso o texto según el caso')
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

// Mensajes del servidor que la app muestra tal cual (errores de la API en español).
const py = String.raw`
import ast, pathlib, sys
root = pathlib.Path(sys.argv[1])
out = []
for path in sorted(root.rglob("*.py")):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and getattr(node.func, "id", getattr(node.func, "attr", "")) == "ApiError" and len(node.args) >= 3:
            msg = node.args[2]
            if isinstance(msg, ast.Constant) and isinstance(msg.value, str):
                text = msg.value
            elif isinstance(msg, ast.JoinedStr):
                text = "".join(v.value if isinstance(v, ast.Constant) else "{…}" for v in msg.values)
            else:
                continue
            code = node.args[1].value if isinstance(node.args[1], ast.Constant) else "(según el caso)"
            out.append(f"{code}\t{text}")
print("\n".join(sorted(set(out))))
`
const server = execFileSync('python3', ['-I', '-c', py, API], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .map((l) => l.split('\t'))

// Duplicados: el mismo texto en la misma pantalla y contexto se muestra una sola vez.
const seen = new Set()
const unique = rows.filter((r) => {
  const key = `${r.screen}|${r.text}|${r.context}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
const byScreen = Map.groupBy(unique, (r) => r.screen)
const esc = (s) => s.replaceAll('|', '\\|')

const lines = [
  '# Textos de la app',
  '',
  'Tabla de **todos los textos que ve una persona** en Imperio Barber, para que el dueño los revise.',
  'Se genera sola desde el código: **no la edites a mano**; corrige el texto en el código y vuelve a generarla con',
  '`pnpm --filter web texts` (CI falla si queda desactualizada).',
  '',
  '**Criterios de redacción** (ya aplicados): español de Colombia, tuteo («tú», «tu cita», «elige», «revisa»), nunca «usted»;',
  'mayúscula solo al inicio de la frase y en nombres propios («Agenda tu cita», no «Agenda Tu Cita»); precios con punto de miles',
  '(`$22.000`); horas en 12 horas con «am»/«pm» en minúscula (`10:30 am`); «celular» (no «móvil» ni «teléfono»); «cita» (no «reserva» ni «turno», salvo «turno sin cita»).',
  '',
  '«Contexto» dice dónde aparece: la etiqueta HTML (título `h1`/`h2`, párrafo `p`, botón `button`, enlace `a`…), «lectores de pantalla»',
  'si solo lo oyen quienes usan lector (no se ve en pantalla), o «aviso o texto según el caso» si lo arma el código (mensajes de error, títulos de ventana, textos con datos).',
  'Las partes variables van como `{…}` (nombre, hora, precio…).',
  '',
  `Total: ${unique.length} textos de la interfaz y ${server.length} mensajes del servidor.`,
  '',
]
for (const [screen, items] of [...byScreen.entries()].sort(([a], [b]) =>
  a.localeCompare(b, 'es'),
)) {
  lines.push(`## ${screen}`, '', '| Texto | Contexto |', '| --- | --- |')
  for (const r of items) lines.push(`| ${esc(r.text)} | ${esc(r.context)} |`)
  lines.push('')
}
lines.push(
  '## Mensajes del servidor',
  '',
  'Errores de la API que la app muestra tal cual a la persona (código estable + mensaje en español).',
  '',
  '| Código | Mensaje |',
  '| --- | --- |',
  ...server.map(([code, text]) => `| \`${code}\` | ${esc(text)} |`),
  '',
)
const out = lines.join('\n')

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(OUT, 'utf8')
  } catch {
    /* no existe */
  }
  if (current !== out) {
    console.error('docs/textos.md está desactualizado: ejecuta `pnpm --filter web texts` y súbelo.')
    process.exit(1)
  }
  console.log('docs/textos.md está al día.')
} else {
  writeFileSync(OUT, out)
  console.log(
    `docs/textos.md: ${unique.length} textos de interfaz + ${server.length} mensajes del servidor`,
  )
}
