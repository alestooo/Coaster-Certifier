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

import { resolveConfig } from "../src/physics/config.js";

/** Estado mínimo con energías en J. */
const STATE = { energies: { kinetic: 2500, gravitational: 1500, elastic: 500, mechanical: 4500, dissipated: 750 } };

describe("Gráficas dentro del sistema de diseño", () => {
  test("con siempre apoyado el límite inferior de fuerza g es 0 g", () => {
    const strict = resolveConfig({ contactModel: "strict" });
    const load = chartDefinition("load");

    expect(load.references(strict).map(line => line.value)).toEqual([strict.maxLoad, 0]);
    expect(load.references(strict).map(line => line.label)).toEqual(["+5 g", "0 g"]);
    expect(load.band(strict)).toEqual({ from: 0, to: strict.maxLoad });
  });

  test("con ruedas anti-levantamiento el límite inferior es n_mín, con signo menos tipográfico", () => {
    const wheels = resolveConfig({ contactModel: "safety-wheels" });

    expect(chartDefinition("load").references(wheels).map(line => line.label)).toEqual(["+5 g", "−1 g"]);
    expect(chartDefinition("load").band(wheels)).toEqual({ from: wheels.minLoad, to: wheels.maxLoad });
  });

  test("las energías se grafican en kJ", () => {
    for (const kind of ["energy", "dissipated", "spring"]) {
      const definition = chartDefinition(kind);

      expect(definition.unit, kind).toBe("kJ");
      expect(definition.yTitle, kind).toMatch(/\(kJ\)$/);
      for (const series of definition.series) {
        expect(series.read(STATE), `${kind}.${series.key}`).toBeCloseTo(STATE.energies[series.key] / 1000, 9);
      }
    }
    expect(CHART_KINDS.filter(kind => kind.unit === "J")).toEqual([]);
  });

  test("una gráfica de una sola serie no lleva leyenda", () => {
    for (const kind of CHART_KINDS) {
      const definition = chartDefinition(kind.id);
      expect(definition.showLegend, kind.id).toBe(definition.series.length > 1);
    }
  });
});
