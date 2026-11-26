import { describe, test, expect } from "vitest";
import { CHART_KINDS, chartDefinition } from "../src/ui/charts/definitions.js";

/** Caracteres que entran en el eje vertical de una gráfica de 150 px (la telemetría). */
const MAX_Y_TITLE_CHARS = 10;

describe("Títulos de los ejes de las gráficas", () => {
  test("el eje vertical lleva símbolo y unidad, y entra en una gráfica baja", () => {
    for (const kind of CHART_KINDS) {
      const { yTitle } = chartDefinition(kind.id);

      expect(yTitle, kind.id).toMatch(/\(.+\)$/);
      expect(yTitle.length, `${kind.id}: «${yTitle}»`).toBeLessThanOrEqual(MAX_Y_TITLE_CHARS);
    }
  });
});
