// Genera los íconos de la PWA (192, 512, maskable 512 y apple-touch 180) a partir del sello
// design-system/assets/Logo/imperio-sello.png sobre el fondo de la marca (--color-bg).
// Sin dependencias: decodifica y codifica PNG con zlib de Node.
//
// TODO(logo): el sello es una foto del letrero físico. Cuando exista el logo vectorial original,
// sustituir imperio-sello.png (el script no cambia) o dibujar el ícono desde el SVG.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32, deflateSync, inflateSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const SEAL = resolve(here, '../../../design-system/assets/Logo/imperio-sello.png')
const TOKENS = resolve(here, '../../../packages/tokens/src/tokens.css')
const OUT = resolve(here, '../public/icons')

function backgroundColor() {
  const match = readFileSync(TOKENS, 'utf8').match(/--color-bg:\s*#([0-9a-f]{6})/i)
  if (!match) throw new Error('No se encontró --color-bg en tokens.css (¿corriste make types?)')
  const n = parseInt(match[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function decodePng(buffer) {
  let offset = 8
  let header
  const data = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const body = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') header = body
    if (type === 'IDAT') data.push(body)
    offset += 12 + length
  }
  const width = header.readUInt32BE(0)
  const height = header.readUInt32BE(4)
  if (header[8] !== 8 || header[9] !== 6 || header[12] !== 0) {
    throw new Error('El sello debe ser un PNG RGBA de 8 bits sin entrelazado')
  }
  const raw = inflateSync(Buffer.concat(data))
  const stride = width * 4
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const out = pixels.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? out[x - 4] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= 4 ? prev[x - 4] : 0
      let add = 0
      if (filter === 1) add = a
      else if (filter === 2) add = b
      else if (filter === 3) add = (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      out[x] = (line[x] + add) & 255
    }
  }
  return { width, height, pixels }
}

function encodePng(width, height, rgb) {
  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  const chunk = (type, body) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(body.length, 0)
    head.write(type, 4, 'ascii')
    const tail = Buffer.alloc(4)
    tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0)
    return Buffer.concat([head, body, tail])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // profundidad
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Compone el sello (promedio por área, con alfa) centrado sobre un cuadrado de color `bg`. */
function render(seal, size, sealSize, bg) {
  const rgb = Buffer.alloc(size * size * 3)
  for (let i = 0; i < size * size; i++) bg.forEach((v, k) => (rgb[i * 3 + k] = v))
  const origin = Math.round((size - sealSize) / 2)
  const scale = seal.width / sealSize
  for (let ty = 0; ty < sealSize; ty++) {
    for (let tx = 0; tx < sealSize; tx++) {
      const x0 = tx * scale
      const y0 = ty * scale
      let r = 0
      let g = 0
      let b = 0
      let alpha = 0
      let weight = 0
      for (let sy = Math.floor(y0); sy < Math.min(seal.height, Math.ceil(y0 + scale)); sy++) {
        const wy = Math.min(sy + 1, y0 + scale) - Math.max(sy, y0)
        for (let sx = Math.floor(x0); sx < Math.min(seal.width, Math.ceil(x0 + scale)); sx++) {
          const w = wy * (Math.min(sx + 1, x0 + scale) - Math.max(sx, x0))
          const p = (sy * seal.width + sx) * 4
          const a = seal.pixels[p + 3] / 255
          r += seal.pixels[p] * a * w
          g += seal.pixels[p + 1] * a * w
          b += seal.pixels[p + 2] * a * w
          alpha += a * w
          weight += w
        }
      }
      const coverage = alpha / weight
      const at = ((origin + ty) * size + origin + tx) * 3
      const premultiplied = [r / weight, g / weight, b / weight]
      for (let k = 0; k < 3; k++) {
        rgb[at + k] = Math.round(premultiplied[k] + bg[k] * (1 - coverage))
      }
    }
  }
  return encodePng(size, size, rgb)
}

const seal = decodePng(readFileSync(SEAL))
const bg = backgroundColor()
mkdirSync(OUT, { recursive: true })

// `any`: el sello ocupa ~90 %. `maskable`: queda dentro de la zona segura (círculo de 80 %).
const targets = [
  ['icon-192.png', 192, 0.9],
  ['icon-512.png', 512, 0.9],
  ['maskable-512.png', 512, 0.72],
  ['apple-touch-icon.png', 180, 0.9],
]
for (const [name, size, ratio] of targets) {
  writeFileSync(resolve(OUT, name), render(seal, size, Math.round(size * ratio), bg))
  console.log(`public/icons/${name} (${size}×${size})`)
}
