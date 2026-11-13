import { defineConfig } from '@playwright/test'

// La API real corre contra una base de datos de pruebas (imperio_e2e) creada, migrada y sembrada
// por scripts/e2e-setup.sh. La web se sirve compilada (vite preview) porque el service worker de
// la PWA solo existe en la compilación; /api se reenvía a la API de pruebas.
const API_PORT = 8100
const WEB_PORT = 4173
const API_URL = `http://127.0.0.1:${API_PORT}`
const WEB_URL = `http://localhost:${WEB_PORT}`

export default defineConfig({
  testDir: './e2e',
  // Un solo trabajador: todas las pruebas comparten la misma base y los mismos horarios.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: WEB_URL,
    viewport: { width: 390, height: 844 },
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    // Sin desplazamiento suave: las pruebas no esperan animaciones (y se ejerce esa rama).
    reducedMotion: 'reduce',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: `bash -c 'bash ../../scripts/e2e-setup.sh && cd ../api && exec uv run uvicorn app.main:app --host 127.0.0.1 --port ${API_PORT}'`,
      url: `${API_URL}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: 'postgresql://imperio:imperio@localhost:5432/imperio_e2e',
        JWT_SECRET: 'secreto-solo-para-e2e-0123456789abcdef0123456789',
        COOKIE_SECURE: 'false',
        ENVIRONMENT: 'test',
        // Las pruebas comparten una IP: sin esto el límite por IP las frenaría.
        RATE_LIMIT_ENABLED: 'false',
        ALLOWED_ORIGINS: WEB_URL,
      },
    },
    {
      command: `pnpm build && pnpm exec vite preview --host localhost --port ${WEB_PORT}`,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { API_PROXY_TARGET: API_URL },
    },
  ],
})
