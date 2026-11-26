import { describe, test, expect } from "vitest";
import { resolveColor, readChartTheme } from "../src/ui/charts/chart-theme.js";
import { CHART_PALETTE } from "../src/ui/charts/definitions.js";

const TOKENS = { "--primary": "#7a4bc6", "--success": "#2f9d78", "--danger": "#d9465a", "--accent": "#f2a93b", "--float": "#3a7bd5", "--muted": "#8f7ba5", "--border": "#ece4f5", "--font-sans": "\"Nunito\", sans-serif" };
const read = name => TOKENS[name] ?? "";

describe("Colores de las gráficas desde los tokens", () => {
  test("una referencia var(--token) se resuelve con el valor del token", () => {
    expect(resolveColor("var(--primary)", read)).toBe("#7a4bc6");
  });

  test("un color literal o un token desconocido quedan como están", () => {
    expect(resolveColor("rgba(0,0,0,0.1)", read)).toBe("rgba(0,0,0,0.1)");
    expect(resolveColor("var(--no-existe)", read)).toBe("var(--no-existe)");
  });

  test("la paleta de las series usa tokens del sistema de diseño", () => {
    for (const key of ["speed", "load", "mechanical", "limit", "marker", "kinetic"]) {
      expect(CHART_PALETTE[key], key).toMatch(/^var\(--[\w-]+\)$/);
    }
  });

  test("el tema lee fuente, texto y grilla de los tokens", () => {
    expect(readChartTheme(read)).toMatchObject({ font: "\"Nunito\", sans-serif", text: "#8f7ba5", grid: "#ece4f5" });
  });
});
