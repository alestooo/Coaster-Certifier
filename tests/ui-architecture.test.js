import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = resolve(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
/** Componentes de la interfaz (la librería de física no tiene .svelte). */
const COMPONENTS = walk(resolve(ROOT, "src")).filter(path => path.endsWith(".svelte")).map(path => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") }));

/** Arte con colores propios: avatares, miniaturas a escala, paleta de piel y pelo, y los tokens. */
const ART_ALLOWED = new Set([
  "src/styles/tokens.css",
  "src/components/Avatar.svelte",
  "src/components/TrackThumbnail.svelte",
  "src/components/ColorPicker.svelte"
]);

/** Archivos de la interfaz que contienen el patrón. */
function offenders(pattern) {
  return COMPONENTS.filter(file => pattern.test(file.text)).map(file => file.path);
}

describe("Arquitectura de la interfaz: un solo componente por tipo de control", () => {
  test("ningún componente usa ScrubField ni <input type=number>", () => {
    expect(offenders(/ScrubField/)).toEqual([]);
    expect(offenders(/type="number"/)).toEqual([]);
  });

  test("no hay <select> nativos: la lista desplegable es el componente Select", () => {
    expect(offenders(/<select\b/)).toEqual([]);
  });

  test("no hay glifos de texto donde corresponde un ícono", () => {
    expect(offenders(/[✔✘⚠⤓🖨✕]/u)).toEqual([]);
  });

  test("no hay colores hexadecimales fuera de los tokens y del arte permitido", () => {
    const stylesheets = walk(resolve(ROOT, "src")).filter(path => path.endsWith(".css")).map(path => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") }));
    const files = [...COMPONENTS, ...stylesheets].filter(file => !ART_ALLOWED.has(file.path));
    const hex = /#[0-9a-fA-F]{3,8}\b/;

    expect(files.filter(file => hex.test(file.text.replace(/\{#[a-z]+/g, ""))).map(file => file.path)).toEqual([]);
  });
});
