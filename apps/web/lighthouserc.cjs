// Lighthouse CI: móvil con el estrangulamiento estándar (4G lenta simulada, CPU 4x más lenta) sobre
// «/» y «/productos». Lighthouse ya no mide PWA: la instalabilidad la prueba e2e/pwa.spec.ts.
// Uso: pnpm --filter web lhci   (necesita PostgreSQL: make db-up)
const chrome = process.env.CHROME_PATH || process.env.LHCI_CHROME_PATH

module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4173/', 'http://localhost:4173/productos'],
      numberOfRuns: Number(process.env.LHCI_RUNS ?? 3), // la mediana de 3 evita un resultado atípico
      startServerCommand: 'bash scripts/lhci-server.sh',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 240000,
      ...(chrome ? { chromePath: chrome } : {}),
      settings: {
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 360,
          height: 640,
          deviceScaleFactor: 2,
          disabled: false,
        },
        // Estrangulamiento estándar de Lighthouse en móvil («Slow 4G» simulado).
        throttlingMethod: 'simulate',
        throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
        chromeFlags: '--no-sandbox --headless=new --disable-dev-shm-usage',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
      },
    },
    upload: { target: 'filesystem', outputDir: 'lhci-report' },
  },
}
