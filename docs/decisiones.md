# Decisiones

Registro de decisiones que se apartan de `arquitectura.md` o que la completan. Una entrada por decisión, la más reciente arriba.

Formato:

```text
## AAAA-MM-DD · Título corto
Contexto: qué pasaba.
Decisión: qué se hizo.
Motivo: por qué.
Impacto: qué fases o secciones cambian.
```

## 2026-11-13 · Dependencias implícitas en la fase 0
Contexto: la fase 0 nombra FastAPI, pytest, ruff, mypy, Vitest, Testing Library, ESLint y Prettier, pero estas herramientas no funcionan sin otras piezas que el prompt no nombra.
Decisión: se instalaron `uvicorn[standard]` (servidor para `--reload`), `httpx` (lo exige `TestClient` de FastAPI), `jsdom` (entorno DOM de Vitest), `@vitejs/plugin-react`, `@testing-library/dom` (peer de Testing Library), `@eslint/js`, `globals` y los tipos `@types/react` y `@types/react-dom`. TypeScript se fijó en 6.0.x porque typescript-eslint no soporta la versión 7.
Motivo: sin ellas no arrancan la API, las pruebas ni el lint.
Impacto: ninguna dependencia de negocio. Revisar `httpx` frente a `httpx2` cuando Starlette elimine el aviso de obsolescencia.

## 2026-11-13 · Prettier también en `make lint` y en el CI
Contexto: el prompt pide Prettier pero no dice dónde se verifica.
Decisión: `prettier --check` corre en `make lint` y como un paso extra del job web del CI.
Motivo: que el formato no se desvíe sin que nadie lo note.
Impacto: ninguno en fases posteriores.
