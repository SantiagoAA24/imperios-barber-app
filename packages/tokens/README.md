# @imperio/tokens

Variables CSS del sistema de diseño. La única fuente es `design-system/tokens.json`;
`src/tokens.css` se genera y se versiona para que el CI detecte desajustes.

```bash
pnpm --filter @imperio/tokens build   # node scripts/build-tokens.mjs
```

Los nombres siguen el valor en píxeles (`--space-4` = 4 px, `--radius-12` = 12 px),
no los nombres del JSON (`space-1`, `radius-sm`). Además de los pedidos, el script emite
los estilos de texto (`--text-h1`, `--text-h1--line-height`, `--text-h1--font-weight`…) y
`--shadow-logo-glow`, porque los componentes no pueden usar tamaños fuera de los tokens.
