import { describe, test, expect } from "vitest";
import {
  runSimulation,
  resolveConfig,
  findScenario,
  optimizeDesign,
  optimizationVariables,
  defaultVariables,
  readVariable,
  writeVariable,
  ANNEX_RANGES,
  OPTIMIZATION_BUDGET
} from "../src/physics/index.js";

/** Recorre el generador hasta el final y devuelve el resultado y los avisos de progreso. */
function drain(generator) {
  const progress = [];
  let step = generator.next();
  while (!step.done) {
    progress.push(step.value);
    step = generator.next();
  }
  return { result: step.value, progress };
}

const annex = () => resolveConfig(findScenario("certification").config);

describe("Optimizador", () => {
  test("menor fuerza g máxima: mejora el anexo y el resultado aprueba verificado a dt 0,01", () => {
    // Arrange
    const config = annex();
    const run = runSimulation(config, { timeStep: 0.02 });
    const variables = defaultVariables(config, run, "maxLoad");

    // Act
    const { result, progress } = drain(optimizeDesign(config, { objective: "maxLoad", variables, budget: 120 }));

    // Assert
    expect(result.ok).toBe(true);
    expect(result.after).toBeLessThan(result.before - 0.05);
    expect(result.tested).toBeLessThanOrEqual(120);
    expect(progress.length).toBeGreaterThan(10);
    expect(progress.at(-1).tested).toBeLessThanOrEqual(120);
    const verified = runSimulation(result.config, { timeStep: 0.01 });
    expect(verified.verdict.approved).toBe(true);
    expect(verified.verdict.summary.maxLoad.value).toBeCloseTo(result.after, 1);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.limiting.text.length).toBeGreaterThan(0);
  }, 60_000);

  test("por defecto cambia de 2 a 4 valores: los del elemento crítico más H", () => {
    const config = annex();
    const run = runSimulation(config, { timeStep: 0.02 });

    const variables = defaultVariables(config, run, "maxLoad");

    expect(variables).toContain("initialHeight");
    expect(variables.length).toBeGreaterThanOrEqual(2);
    expect(variables.length).toBeLessThanOrEqual(4);
    // La fuerza g máxima del anexo está en el loop: sus dos valores entran.
    const loop = config.track.findIndex(element => element.type === "point" && element.loop);
    expect(variables).toEqual(expect.arrayContaining([`loopHeight:${loop}`, `loopTopRadius:${loop}`]));
  });

  test("menor altura H: baja H hasta que una restricción lo limita y lo dice", () => {
    const config = annex();

    const { result } = drain(optimizeDesign(config, { objective: "height", variables: ["initialHeight"], budget: 40 }));

    expect(result.ok).toBe(true);
    expect(result.config.initialHeight).toBeLessThan(config.initialHeight);
    expect(runSimulation(result.config, { timeStep: 0.01 }).verdict.approved).toBe(true);
    // Lo que frena a H: el criterio que falla un paso más abajo, o el borde de su rango.
    expect(result.limiting.text).toMatch(/si la altura inicial pasa a|rango/);
  }, 60_000);

  test("con los rangos del anexo, los valores cambiados quedan dentro de la Tabla 2", () => {
    const config = annex();
    const run = runSimulation(config, { timeStep: 0.02 });
    const variables = defaultVariables(config, run, "margin");

    const { result } = drain(optimizeDesign(config, { objective: "margin", variables, budget: 80 }));

    expect(result.ok).toBe(true);
    for (const id of variables) {
      const [lo, hi] = ANNEX_RANGES[id.split(":")[0]];
      const value = readVariable(result.config, id);
      expect(value).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(value).toBeLessThanOrEqual(hi + 1e-9);
    }
    expect(result.after).toBeGreaterThanOrEqual(result.before);
  }, 60_000);

  test("un diseño rechazado pasa primero por la factibilidad", () => {
    const config = resolveConfig(findScenario("stall").config);
    expect(runSimulation(config).verdict.approved).toBe(false);

    const { result, progress } = drain(optimizeDesign(config, { objective: "height", variables: ["initialHeight"], budget: 200 }));

    expect(progress[0].phase).toBe("feasibility");
    if (result.ok) {
      expect(runSimulation(result.config, { timeStep: 0.01 }).verdict.approved).toBe(true);
    } else {
      expect(result.reason).toMatch(/no aprueba|ninguna/i);
    }
  }, 60_000);

  test("si las correcciones no dan un punto de partida, lo busca con los valores elegidos", () => {
    // El anexo con H = 5 m no llega a la cima del loop; con H ≈ 26 m aprueba.
    const config = resolveConfig({ ...findScenario("certification").config, initialHeight: 5 });

    const { result } = drain(optimizeDesign(config, { objective: "height", variables: ["initialHeight"] }));

    expect(result.ok).toBe(true);
    expect(result.corrected).toBe(true);
    expect(result.config.initialHeight).toBeGreaterThan(20);
    expect(runSimulation(result.config, { timeStep: 0.01 }).verdict.approved).toBe(true);
  }, 90_000);

  test("nunca pasa del presupuesto de simulaciones", () => {
    const config = annex();
    const run = runSimulation(config, { timeStep: 0.02 });

    const { result } = drain(optimizeDesign(config, { objective: "maxLoad", variables: defaultVariables(config, run, "maxLoad"), budget: 15 }));

    expect(result.tested).toBeLessThanOrEqual(15);
    expect(OPTIMIZATION_BUDGET).toBe(300);
  }, 60_000);

  test("sin variables elegidas no hay nada que optimizar", () => {
    const { result } = drain(optimizeDesign(annex(), { objective: "maxLoad", variables: [] }));

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/elegí al menos un valor/i);
  });

  test("las variables leen y escriben el elemento correcto, sin tocar el original", () => {
    const config = annex();
    const variables = optimizationVariables(config);
    const loop = variables.find(variable => variable.key === "loopHeight");

    const next = writeVariable(config, loop.id, 18);

    expect(readVariable(next, loop.id)).toBe(18);
    expect(readVariable(config, loop.id)).not.toBe(18);
    expect(variables.map(variable => variable.key)).not.toContain("mass");
    expect(variables.map(variable => variable.key)).not.toContain("friction");
    expect(variables.every(variable => variable.range[0] <= variable.range[1])).toBe(true);
  });
});
