import { describe, test, expect } from "vitest";
import { checkDesignConditions } from "../src/physics/index.js";
import { designCheckText } from "../src/lib/design-checks-text";
import { findScenario } from "../src/physics/scenarios.js";

/** Trazado del anexo (escenario de certificación), con loop, colina y frenos. */
const ANNEX = findScenario("certification").config;

describe("Texto de las condiciones de diseño", () => {
  test("las condiciones de diseño se escriben con coma decimal", () => {
    const configs = [ANNEX, { ...ANNEX, brakeMode: "spring" }];

    for (const config of configs) {
      const texts = checkDesignConditions(config).map(designCheckText);

      expect(texts.length).toBeGreaterThan(0);
      for (const text of texts) {
        expect(text.detail).not.toMatch(/\d\.\d/);
        expect(text.detail).toMatch(/\d,\d/);
        expect(text.name.length).toBeGreaterThan(0);
      }
    }
  });

  test("el detalle compara el valor con el requerido en metros para el loop", () => {
    const loop = checkDesignConditions(ANNEX).find(check => check.id.startsWith("loop-"));
    if (!loop) throw new Error("El anexo tiene un loop");

    expect(designCheckText(loop).detail).toMatch(/^[\d ]+,\d{2} m frente a [\d ]+,\d{2} m requeridos$/);
  });
});
