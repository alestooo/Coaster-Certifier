/**
 * Cada escenario de referencia debe producir el dictamen esperado.
 * Así los presets que ofrece la interfaz nunca contradicen al motor.
 */
import { describe, it, expect } from "vitest";
import { SCENARIOS, runSimulation } from "../src/physics/index.js";

describe("Escenarios de referencia", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.title} → ${scenario.expected.approved ? "aprobado" : `rechazado (${scenario.expected.code})`}`, () => {
      const run = runSimulation(scenario.config);

      expect(run.verdict.approved).toBe(scenario.expected.approved);

      if (scenario.expected.code) {
        expect(run.verdict.violations[0]?.code).toBe(scenario.expected.code);
      }

      if (scenario.expected.maxLoad) {
        expect(run.verdict.summary.maxLoad.value).toBeCloseTo(scenario.expected.maxLoad, 1);
      }

      if (scenario.expected.approved) {
        expect(run.verdict.summary.maxLoad.value).toBeLessThanOrEqual(run.config.maxLoad);
        expect(run.verdict.summary.maxBalanceError.value / run.verdict.summary.initialEnergy).toBeLessThan(1e-3);
      }
    });
  }
});
