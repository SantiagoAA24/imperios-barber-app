import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dist-stats',
      'dev-dist',
      'test-results',
      'playwright-report',
      'lhci-report',
      '.lighthouseci',
      'src/lib/api/schema.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['scripts/**/*.mjs', 'lighthouserc.cjs'],
    languageOptions: { globals: globals.node },
  },
)
