// node --test scripts/
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  contrast,
  evaluate,
  loadColors,
  suggestForeground,
} from "./check-contrast.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, "check-contrast.mjs");
const TOKENS = resolve(here, "../design-system/tokens.json");

test("razones de referencia WCAG", () => {
  assert.equal(contrast("#000000", "#ffffff").toFixed(2), "21.00");
  assert.equal(contrast("#ffffff", "#ffffff").toFixed(2), "1.00");
  // Ejemplo clásico: #767676 sobre blanco = 4.54:1.
  assert.equal(contrast("#767676", "#ffffff").toFixed(2), "4.54");
  // Simétrica.
  assert.equal(contrast("#0b0b0c", "#d4af5a"), contrast("#d4af5a", "#0b0b0c"));
});

test("los tokens reales cumplen todos los pares", () => {
  const failing = evaluate(loadColors()).filter((r) => !r.pass);
  assert.deepEqual(
    failing.map((r) => `${r.fg}/${r.bg}`),
    [],
  );
});

test("text-disabled queda exento: no está en ningún par", () => {
  const used = new Set(evaluate(loadColors()).flatMap((r) => [r.fg, r.bg]));
  assert.equal(used.has("text-disabled"), false);
});

test("suggestForeground devuelve el cambio mínimo que cumple, sin pasarse", () => {
  const suggestion = suggestForeground("#555555", "#151517", 4.5);
  assert.ok(suggestion);
  assert.ok(contrast(suggestion, "#151517") >= 4.5);
  // Un paso menos (0,5 % de luminosidad) ya no cumpliría.
  const darker = `#${[...suggestion.slice(1).match(/../g)]
    .map((h) =>
      Math.max(0, parseInt(h, 16) - 2)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
  assert.ok(contrast(darker, "#151517") < 4.5);
});

test("el script falla con código 1, propone el ajuste y no toca el archivo", () => {
  const json = JSON.parse(readFileSync(TOKENS, "utf8"));
  json.color.tokens.find((t) => t.name === "text-muted").value = "#4a4a4a";
  const file = join(mkdtempSync(join(tmpdir(), "contraste-")), "tokens.json");
  const before = JSON.stringify(json);
  writeFileSync(file, before);
  const run = spawnSync("node", [SCRIPT, file], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stdout, /FALLA text-muted sobre bg/);
  assert.match(run.stdout, /Ajuste mínimo propuesto \(no aplicado\)/);
  assert.match(run.stdout, /text-muted: #4a4a4a -> #[0-9a-f]{6}/);
  assert.equal(readFileSync(file, "utf8"), before);
});

test("el script termina en 0 con los tokens del repositorio", () => {
  assert.doesNotThrow(() => execFileSync("node", [SCRIPT], { stdio: "pipe" }));
});
