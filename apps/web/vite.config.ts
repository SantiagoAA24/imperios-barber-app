import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// theme_color y background_color del manifest = --color-bg, leído de los tokens generados.
const tokens = readFileSync('../../packages/tokens/src/tokens.css', 'utf8')
const bg = tokens.match(/--color-bg:\s*(#[0-9a-fA-F]{6})/)?.[1]
if (!bg) throw new Error('No se encontró --color-bg en packages/tokens/src/tokens.css')

export default defineConfig(({ mode }) => {
  // Las pruebas E2E levantan la API en otro puerto: API_PROXY_TARGET=http://localhost:8100.
  const apiTarget = loadEnv(mode, '.', '').API_PROXY_TARGET ?? 'http://localhost:8000'
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'theme-color-from-tokens',
        transformIndexHtml: (html: string) => html.replace('__THEME_COLOR__', bg),
      },
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'script-defer',
        includeAssets: ['icons/apple-touch-icon.png'],
        manifest: {
          name: 'Imperio Barber',
          short_name: 'Imperio',
          description: 'Agenda tu cita en Imperio Barber.',
          lang: 'es-CO',
          dir: 'ltr',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          theme_color: bg,
          background_color: bg,
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: '/icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // El shell (HTML, JS, CSS, fuentes woff2, íconos) se precachea.
          globPatterns: ['**/*.{html,js,css,woff2,png,svg,ico}'],
          // Las áreas de personal necesitan red de todos modos: sin red, su carga falla y la app
          // muestra /offline (RouteBoundary) en lugar de una pantalla a medias.
          globIgnores: ['**/BarberArea-*.js', '**/AdminArea-*.js', '**/useLogoutAndLeave-*.js'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // Nunca se cachean: disponibilidad, citas y sesión (y, por prudencia, personal).
              // Ojo: Workbox serializa esta función dentro de sw.js, así que no puede usar variables
              // externas; la expresión regular va escrita aquí.
              urlPattern: ({ url, request }) =>
                request.method === 'GET' &&
                /^\/api\/v1\/(public\/availability|public\/appointments|auth|me|admin)(\/|$)/.test(
                  url.pathname,
                ),
              handler: 'NetworkOnly',
            },
            {
              // Catálogo público: se sirve del caché mientras se revalida (stale-while-revalidate).
              urlPattern: ({ url, request }) =>
                request.method === 'GET' &&
                /^\/api\/v1\/public\/(business|services|barbers|products)\/?$/.test(url.pathname),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'catalogo',
                cacheableResponse: { statuses: [200] },
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
          ],
        },
      }),
    ],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': apiTarget,
      },
    },
    preview: {
      port: 4173,
      strictPort: true,
      proxy: {
        '/api': apiTarget,
      },
    },
    test: {
      // Las pruebas de Playwright (e2e/*.spec.ts) las corre `pnpm e2e`, no Vitest.
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      globals: false,
      css: true,
      env: { VITE_API_URL: 'http://localhost' },
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})
