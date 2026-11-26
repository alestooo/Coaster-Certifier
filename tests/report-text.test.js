import { describe, test, expect } from "vitest";
import { runSimulation, findScenario, resolveConfig } from "../src/physics/index.js";
import { resultLines } from "../src/lib/report-text.ts";

/** Un número con punto decimal («240.87»), que en la interfaz va con coma. */
const DOT_DECIMAL = /\d\.\d/;

describe("Resultado del informe en español", () => {
  test("un recorrido aprobado se explica con coma decimal", () => {
    // Arrange
    const config = resolveConfig(findScenario("certification").config);
    const run = runSimulation(config);

    // Act
    const lines = resultLines(run.verdict, run.history.at(-1).distance, config);

    // Assert
    expect(run.verdict.approved).toBe(true);
    expect(lines).toHaveLength(3);
    expect(lines.join(" ")).not.toMatch(DOT_DECIMAL);
    expect(lines[0]).toMatch(/quedó detenido a \d+,\d\d m/);
    // «Siempre apoyado» (el modelo por defecto) no usa n_mín: exige N > 0, como dice el dictamen.
    expect(config.contactModel).toBe("strict");
    expect(lines[1]).toContain("mayor que 0 g (siempre apoyado) y hasta 5 g");
  });

  test("con ruedas anti-levantamiento el resultado nombra el intervalo de la regla", () => {
    const config = resolveConfig({ ...findScenario("certification").config, contactModel: "safety-wheels" });
    const run = runSimulation(config);

    const lines = resultLines(run.verdict, run.history.at(-1).distance, config);

    expect(run.verdict.approved).toBe(true);
    expect(lines[1]).toContain("entre -1 y 5 g");
  });

  test("un recorrido rechazado nombra cada incumplimiento con coma decimal", () => {
    const config = resolveConfig(findScenario("circular-loop").config);
    const run = runSimulation(config);

    const lines = resultLines(run.verdict, run.history.at(-1).distance, config);

    expect(run.verdict.approved).toBe(false);
    expect(lines.length).toBe(run.verdict.violations.length);
    expect(lines.join(" ")).not.toMatch(DOT_DECIMAL);
    expect(lines[0]).toMatch(/s = \d+,\d\d m, t = \d+,\d{3} s\.$/);
  });
});
