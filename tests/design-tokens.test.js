import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TOKENS = readFileSync(resolve(import.meta.dirname, "../src/styles/tokens.css"), "utf8");

/** Escala del sistema de diseño (especificación, sección 1). */
const REQUIRED = [
  "--text-11", "--text-12", "--text-13", "--text-14", "--text-16", "--text-20", "--text-24",
  "--weight-regular", "--weight-bold", "--weight-black",
  "--space-1", "--space-2", "--space-3", "--space-4", "--space-6", "--space-8",
  "--radius-sm", "--radius-md", "--radius", "--radius-lg", "--radius-pill",
  "--control-sm", "--control-md", "--control-lg", "--control-xl",
  "--success-text", "--success-border", "--warn-text", "--warn-soft", "--warn-border", "--danger-text", "--danger-border",
  "--tooltip-bg", "--tooltip-text", "--backdrop", "--overlay-surface",
  "--focus-ring", "--handle"
];

describe("Tokens del sistema de diseño", () => {
  test("tokens.css declara la escala completa de tipo, espaciado, radios, controles, estados, superficies y foco", () => {
    const missing = REQUIRED.filter(name => !new RegExp(`${name}\\s*:`).test(TOKENS));

    expect(missing).toEqual([]);
  });

  test("el anillo de foco se ve sobre cualquier superficie: color primario separado por la superficie", () => {
    const ring = /--focus-ring:\s*([^;]+);/.exec(TOKENS)?.[1] ?? "";

    // primary-soft sobre surface-muted daba 1,01:1: el foco con teclado no se veía.
    expect(ring).not.toMatch(/primary-soft/);
    expect(ring).toMatch(/var\(--surface\)/);
    expect(ring).toMatch(/var\(--primary\)/);
  });
});
