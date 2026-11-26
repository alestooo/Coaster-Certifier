import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = resolve(ROOT, "src");
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = resolve(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

/** Texto de la interfaz sin comentarios (los comentarios pueden nombrar lo viejo). */
function withoutComments(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const FILES = walk(SRC)
  .filter(path => /\.(svelte|ts)$/.test(path) && !path.startsWith(resolve(SRC, "physics")))
  .map(path => ({ path: relative(ROOT, path), text: withoutComments(readFileSync(path, "utf8")) }));

/** Términos que el glosario reemplazó: ninguno vuelve a aparecer en la interfaz. */
const FORBIDDEN = [
  ["«Informe completo»", /Informe completo/],
  ["«reporte»", /\b[Rr]eporte/],
  ["«Casos de prueba»", /Casos de prueba/i],
  ["«Sorpréndeme»", /Sorpréndeme/],
  ["«personas»", /\bpersonas?\b/],
  ["«Recorrido del anexo»", /Recorrido del anexo/]
];

describe("Glosario de la interfaz", () => {
  test.each(FORBIDDEN)("el glosario se respeta en la interfaz: sin %s", (_, pattern) => {
    expect(FILES.filter(file => pattern.test(file.text)).map(file => file.path)).toEqual([]);
  });
});
