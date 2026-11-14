// Servidor estático mínimo para medir con Lighthouse CI: sirve dist/ como lo haría un hosting
// real (gzip/brotli para texto, caché larga para /assets, fallback de la SPA) y reenvía /api al API.
// `vite preview` no comprime, y eso falsearía la puntuación de rendimiento hacia abajo.
// Uso: node scripts/serve-dist.mjs [puerto]   (API_PROXY_TARGET, por defecto http://127.0.0.1:8100)
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer, request as httpRequest } from 'node:http'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(process.env.DIST_DIR ?? resolve(here, '../dist')) // DIST_DIR: medir otra compilación
const PORT = Number(process.argv[2] ?? 4173)
const API = new URL(process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8100')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
}
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt'])
const cache = new Map() // ruta -> { gzip, br } (los archivos no cambian mientras corre)

function proxy(req, res) {
  const upstream = httpRequest(
    { host: API.hostname, port: API.port, path: req.url, method: req.method, headers: req.headers },
    (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers)
      response.pipe(res)
    },
  )
  upstream.on('error', () => {
    res.writeHead(502)
    res.end('API no disponible')
  })
  req.pipe(upstream)
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname.startsWith('/api/')) return proxy(req, res)

  let file = normalize(join(DIST, decodeURIComponent(url.pathname)))
  if (!file.startsWith(DIST)) return res.writeHead(403).end()
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html') // SPA
  const ext = extname(file)
  const hashed = file.includes(`${join(DIST, 'assets')}/`)
  const headers = {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    // Archivos con hash: para siempre. El resto (HTML, sw.js, manifest): siempre revalidar.
    'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
  }
  const accept = String(req.headers['accept-encoding'] ?? '')
  if (COMPRESSIBLE.has(ext) && /\b(br|gzip)\b/.test(accept)) {
    const entry = cache.get(file) ?? {}
    const raw = readFileSync(file)
    const useBr = /\bbr\b/.test(accept)
    entry.br ??= useBr ? brotliCompressSync(raw) : undefined
    entry.gzip ??= gzipSync(raw, { level: 9 })
    cache.set(file, entry)
    const body = useBr && entry.br ? entry.br : entry.gzip
    res.writeHead(200, {
      ...headers,
      'Content-Encoding': useBr ? 'br' : 'gzip',
      Vary: 'Accept-Encoding',
      'Content-Length': body.length,
    })
    return res.end(body)
  }
  res.writeHead(200, { ...headers, 'Content-Length': statSync(file).size })
  createReadStream(file).pipe(res)
}).listen(PORT, 'localhost', () => {
  console.log(`Sirviendo ${DIST}\n  Local:   http://localhost:${PORT}/  (API en ${API.origin})`)
})
