#!/usr/bin/env node
// Razón de contraste WCAG 2.x de los pares de color que la app usa de verdad.
// Lee design-system/tokens.json (la fuente de verdad de los colores) y falla (código 1) si algún
// par queda por debajo de su mínimo:
//   texto normal            >= 4.5:1  (WCAG 1.4.3)
//   texto grande y bordes de controles / componentes  >= 3:1  (WCAG 1.4.3 y 1.4.11)
// `text-disabled` está exento (WCAG 1.4.3: los componentes inactivos no tienen requisito) y
// `gold-edge` es decorativo y lleva transparencia, así que tampoco se evalúa.
//
// Si un par falla, el script PROPONE el ajuste mínimo del token (misma tonalidad y saturación,
// solo la luminosidad) pero nunca modifica tokens.json: aplicarlo es una decisión de diseño.
//
// Uso: node scripts/check-contrast.mjs [ruta/a/tokens.json]
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TOKENS = resolve(here, "../design-system/tokens.json");

const TEXT = 4.5;
const NON_TEXT = 3;

/**
 * Pares [primer plano, fondo, mínimo, dónde se usa]. Los primeros son los que pide el brief; los
 * marcados `extra` salen de la columna "usage" de tokens.json (sobre qué superficies se garantiza
 * que cada color se lee).
 */
export const PAIRS = [
  ["text", "bg", TEXT, "Texto principal sobre el fondo"],
  ["text", "surface", TEXT, "Texto principal en tarjetas y campos"],
  ["text-muted", "bg", TEXT, "Texto secundario sobre el fondo"],
  ["text-muted", "surface", TEXT, "Texto secundario en tarjetas y campos"],
  ["gold", "bg", TEXT, "Precios, enlaces y acentos sobre el fondo"],
  ["gold", "surface", TEXT, "Precios y acentos en tarjetas"],
  ["on-gold", "gold", TEXT, "Texto de botones primarios y selección"],
  ["danger", "surface", TEXT, "Estado «No asistió» y errores en tarjetas"],
  ["success", "surface", TEXT, "Estado «Atendida» y avisos en tarjetas"],
  // Bordes de controles y componentes (no texto): 3:1.
  ["line-strong", "bg", NON_TEXT, "Borde de campos y controles sobre el fondo"],
  // Extras: otras superficies donde tokens.json promete legibilidad.
  [
    "line-strong",
    "surface",
    NON_TEXT,
    "Borde de campos y barras del gráfico de ingresos dentro de tarjetas",
    true,
  ],
  ["text", "surface-selected", TEXT, "Texto en tarjetas seleccionadas", true],
  ["gold", "surface-selected", TEXT, "Acento en tarjetas seleccionadas", true],
  [
    "text-muted",
    "surface-selected",
    TEXT,
    "Texto secundario en tarjetas seleccionadas",
    true,
  ],
  [
    "text-muted",
    "surface-muted",
    TEXT,
    "Texto secundario en botón deshabilitado y avatar",
    true,
  ],
  ["gold", "surface-muted", TEXT, "Acento sobre el avatar de barbero", true],
  [
    "on-gold",
    "danger",
    TEXT,
    "Botón «Sí, cancelar cita» y marca «Ahora»",
    true,
  ],
  ["danger", "bg", TEXT, "Estado «No asistió» y errores sobre el fondo", true],
  ["success", "bg", TEXT, "Estado «Atendida» sobre el fondo", true],
  // Componentes grandes (relleno gold del botón y de la selección contra el fondo): 3:1.
  [
    "gold",
    "bg",
    NON_TEXT,
    "Relleno del botón primario contra el fondo (componente)",
    true,
  ],
];

/** '#rrggbb' -> [r, g, b] (0-255). Los colores con transparencia no se evalúan. */
export function parseHex(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`Color no válido o con transparencia: ${hex}`);
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminancia relativa WCAG de un color sRGB. */
export function luminance([r, g, b]) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Razón de contraste (1 a 21) entre dos colores '#rrggbb'. */
export function contrast(a, b) {
  const la = luminance(parseHex(a));
  const lb = luminance(parseHex(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function rgbToHsl([r, g, b]) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === R
      ? (G - B) / d + (G < B ? 6 : 0)
      : max === G
        ? (B - R) / d + 2
        : (R - G) / d + 4;
  return [h / 6, s, l];
}

function hslToHex([h, s, l]) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const hex = [f(0), f(8), f(4)]
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
  return `#${hex}`;
}

/**
 * Ajuste mínimo del primer plano: conserva tonalidad y saturación y mueve la luminosidad (HSL)
 * hacia el lado que más contraste da, en pasos de 0,5 %, hasta alcanzar `min`. null si no existe.
 */
export function suggestForeground(foreground, background, min) {
  const [h, s, l] = rgbToHsl(parseHex(foreground));
  const lighter =
    luminance(parseHex(foreground)) >= luminance(parseHex(background));
  for (let step = 1; step <= 200; step++) {
    const next = Math.min(
      1,
      Math.max(0, l + (lighter ? 1 : -1) * step * 0.005),
    );
    const candidate = hslToHex([h, s, next]);
    if (contrast(candidate, background) >= min) return candidate;
    if (next === 0 || next === 1) break;
  }
  return null;
}

export function loadColors(path = DEFAULT_TOKENS) {
  const json = JSON.parse(readFileSync(path, "utf8"));
  return Object.fromEntries(json.color.tokens.map((t) => [t.name, t.value]));
}

export function evaluate(colors) {
  return PAIRS.map(([fg, bg, min, use, extra = false]) => {
    for (const name of [fg, bg]) {
      if (!colors[name])
        throw new Error(`tokens.json no tiene el color «${name}»`);
    }
    const ratio = contrast(colors[fg], colors[bg]);
    const pass = ratio >= min;
    return {
      fg,
      bg,
      min,
      use,
      extra,
      ratio,
      pass,
      suggestion: pass ? null : suggestForeground(colors[fg], colors[bg], min),
    };
  });
}

function main() {
  const path = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_TOKENS;
  const colors = loadColors(path);
  const results = evaluate(colors);
  const name = (r) => `${r.fg} sobre ${r.bg}`;
  const width = Math.max(...results.map((r) => name(r).length));
  console.log(
    `Contraste WCAG (${path.replace(`${resolve(here, "..")}/`, "")})\n`,
  );
  for (const r of results) {
    const mark = r.pass ? "OK   " : "FALLA";
    const kind = r.min === TEXT ? "texto 4.5" : "no texto 3";
    console.log(
      `${mark} ${name(r).padEnd(width)}  ${r.ratio.toFixed(2).padStart(5)}:1  (mín. ${kind}) ${r.use}${r.extra ? " [extra]" : ""}`,
    );
  }
  console.log(
    "\nExento: text-disabled (solo controles deshabilitados) y gold-edge (decorativo).",
  );
  const failures = results.filter((r) => !r.pass);
  if (failures.length === 0) {
    console.log(`\n${results.length} pares revisados: todos cumplen.`);
    return 0;
  }
  console.log(
    `\n${failures.length} de ${results.length} pares no cumplen. Ajuste mínimo propuesto (no aplicado):`,
  );
  for (const f of failures) {
    const now = colors[f.fg];
    console.log(
      f.suggestion
        ? `  - ${f.fg}: ${now} -> ${f.suggestion} (${contrast(f.suggestion, colors[f.bg]).toFixed(2)}:1 sobre ${f.bg}); revisa que siga cumpliendo con sus otras superficies.`
        : `  - ${f.fg} sobre ${f.bg}: ningún ajuste de luminosidad alcanza ${f.min}:1; hay que cambiar el fondo.`,
    );
  }
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  process.exit(main());
