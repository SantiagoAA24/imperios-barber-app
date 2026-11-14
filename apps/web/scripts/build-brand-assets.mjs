// Deriva del sello (design-system/assets/Logo/imperio-sello.png, de solo lectura) los recursos que
// necesita la app compilada, usando el Chromium de Playwright (sin dependencias nuevas):
//   src/assets/sello-88.webp   sello a 88 px (44 px a 2x) para barras y paneles
//   src/assets/sello-264.webp  sello a 264 px (132 px a 2x) para la cabecera de agendar
//   public/og-image.png        1200 x 630 para compartir el enlace (Open Graph / WhatsApp)
//   public/favicon.ico         favicon (PNG de 48 px dentro de un .ico)
//   public/icons/favicon-32.png
// El PNG original pesa ~360 KB y se mostraba a 44-132 px: era lo más pesado de la primera carga.
//
// TODO(logo): no existe design-system/assets/Logo/logo.svg (solo el sello, que es una foto del
// letrero). Cuando exista el vector, hay que sustituir el origen de estos recursos y de
// build-icons.mjs; las salidas no cambian.
//
// Uso: pnpm --filter web assets   (y luego pnpm --filter web icons si cambió el sello)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const SEAL = resolve(here, '../../../design-system/assets/Logo/imperio-sello.png')
const TOKENS = resolve(here, '../../../packages/tokens/src/tokens.css')
const ASSETS = resolve(here, '../src/assets')
const PUBLIC = resolve(here, '../public')

const token = (name) => {
  const match = readFileSync(TOKENS, 'utf8').match(
    new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i'),
  )
  if (!match)
    throw new Error(`No se encontró --color-${name} en tokens.css (¿corriste make types?)`)
  return match[1]
}
const font = (pkg, file) =>
  readFileSync(require.resolve(`@fontsource/${pkg}/files/${file}`)).toString('base64')

const sealB64 = readFileSync(SEAL).toString('base64')
const sealUrl = `data:image/png;base64,${sealB64}`

const browser = await chromium.launch()
try {
  const page = await browser.newPage()

  /** Redimensiona el sello a `size` px y lo devuelve codificado (conserva la transparencia). */
  async function resize(size, type, quality) {
    await page.setContent('<canvas id="c"></canvas>')
    const dataUrl = await page.evaluate(
      async ([src, px, mime, q]) => {
        const img = new Image()
        img.src = src
        await img.decode()
        const canvas = document.getElementById('c')
        canvas.width = px
        canvas.height = px
        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, px, px)
        return canvas.toDataURL(mime, q)
      },
      [sealUrl, size, type, quality],
    )
    return Buffer.from(dataUrl.split(',')[1], 'base64')
  }

  mkdirSync(ASSETS, { recursive: true })
  mkdirSync(resolve(PUBLIC, 'icons'), { recursive: true })
  for (const size of [88, 264]) {
    const webp = await resize(size, 'image/webp', 0.9)
    writeFileSync(resolve(ASSETS, `sello-${size}.webp`), webp)
    console.log(`src/assets/sello-${size}.webp (${(webp.length / 1024).toFixed(1)} KB)`)
  }

  // Favicon: PNG de 32 px y un .ico que contiene un PNG de 48 px (válido desde Windows Vista).
  const bg = token('bg')
  const png = async (size) => {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
      `<body style="margin:0;background:${bg}"><img src="${sealUrl}" style="width:${size}px;height:${size}px;display:block"></body>`,
    )
    await page.evaluate(() => document.querySelector('img').decode())
    return page.screenshot({ type: 'png', omitBackground: false })
  }
  writeFileSync(resolve(PUBLIC, 'icons/favicon-32.png'), await png(32))
  const ico48 = await png(48)
  const header = Buffer.alloc(22)
  header.writeUInt16LE(1, 2) // tipo: ícono
  header.writeUInt16LE(1, 4) // una imagen
  header[6] = 48
  header[7] = 48
  header.writeUInt16LE(1, 10) // planos
  header.writeUInt16LE(32, 12) // bits por píxel
  header.writeUInt32LE(ico48.length, 14)
  header.writeUInt32LE(22, 18)
  writeFileSync(resolve(PUBLIC, 'favicon.ico'), Buffer.concat([header, ico48]))
  console.log('public/favicon.ico, public/icons/favicon-32.png')

  // Imagen para compartir: el sello a la izquierda y el nombre con su frase a la derecha.
  const gold = token('gold')
  const text = token('text')
  const muted = token('text-muted')
  await page.setViewportSize({ width: 1200, height: 630 })
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: 'Cormorant Garamond'; font-weight: 600;
      src: url(data:font/woff2;base64,${font('cormorant-garamond', 'cormorant-garamond-latin-600-normal.woff2')}) }
    @font-face { font-family: 'Inter'; font-weight: 400;
      src: url(data:font/woff2;base64,${font('inter', 'inter-latin-400-normal.woff2')}) }
    body { margin: 0; width: 1200px; height: 630px; background: ${bg}; display: flex; align-items: center;
      gap: 64px; padding: 0 96px; box-sizing: border-box; border: 2px solid ${gold}55; }
    img { width: 400px; height: 400px; border-radius: 50%; flex: none; }
    h1 { margin: 0 0 20px; font: 600 104px/1.05 'Cormorant Garamond', Georgia, serif; color: ${gold}; }
    p { margin: 0; font: 400 38px/1.4 Inter, sans-serif; color: ${text}; }
    p + p { margin-top: 14px; color: ${muted}; font-size: 30px; }
  </style></head><body>
    <img src="${sealUrl}" alt="">
    <div><h1>Imperio Barber</h1><p>Agenda tu cita en línea.</p><p>Sin registro y sin descargas.</p></div>
  </body></html>`)
  await page.evaluate(async () => {
    await document.fonts.ready
    await document.querySelector('img').decode()
  })
  const og = await page.screenshot({ type: 'png' })
  writeFileSync(resolve(PUBLIC, 'og-image.png'), og)
  console.log(`public/og-image.png (1200x630, ${(og.length / 1024).toFixed(1)} KB)`)
} finally {
  await browser.close()
}
