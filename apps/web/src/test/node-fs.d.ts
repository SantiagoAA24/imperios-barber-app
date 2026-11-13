// vite.config.ts lee tokens.css con node:fs; se declara solo esa función para no añadir @types/node.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string
}
