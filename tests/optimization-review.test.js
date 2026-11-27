import { describe, test, expect } from "vitest";
import { runSimulation, resolveConfig, findScenario, optimizeDesign, optimizationVariables, defaultVariables, readVariable, ANNEX_RANGES, CONFIG_LIMITS } from "../src/physics/index.js";
import { sectionPhrase, ofPhrase } from "../src/physics/optimization/limit.js";

/** Recorre el generador hasta el final y devuelve el resultado. */
function drain(generator) {
  let step = generator.next();
  while (!step.done) step = generator.next();
  return step.value;
}

const scenario = id => resolveConfig(findScenario(id).config);
const loops = config => config.track.flatMap((element, index) => (element.type === "point" && element.loop ? [index] : []));

describe("Optimizador: correcciones de la revisión", () => {
  test("la búsqueda refina hasta el paso de la prueba: H mínima del anexo a menos de 0,1 m de la verdadera (25,67 m)", () => {
    const result = drain(optimizeDesign(scenario("certification"), { objective: "height", variables: ["initialHeight"] }));

    expect(result.ok).toBe(true);
    expect(result.config.initialHeight).toBeLessThan(25.77);
  }, 90_000);

  test("en la bajada simple, H baja hasta casi el mínimo del anexo y el texto no contradice el valor", () => {
    const result = drain(optimizeDesign(scenario("line"), { objective: "height", variables: ["initialHeight", "initialSpeed"] }));

    expect(result.config.initialHeight).toBeLessThanOrEqual(10.05);
    if (/llegó al mínimo/.test(result.limiting.text)) expect(result.config.initialHeight).toBeCloseTo(10, 2);
  }, 90_000);

  test("con los rangos del anexo, la factibilidad no saca valores de la Tabla 2", () => {
    const config = scenario("brake-short");

    const result = drain(optimizeDesign(config, { objective: "length", variables: ["brakingLength", "brakeDeceleration", "initialHeight"] }));

    expect(result.ok).toBe(true);
    for (const key of ["brakingLength", "brakeDeceleration", "initialHeight"]) {
      const [lo, hi] = ANNEX_RANGES[key];
      const before = readVariable(config, key);
      const after = readVariable(result.config, key);
      // Dentro de la Tabla 2, o sin alejarse más si ya estaba afuera.
      expect(after).toBeGreaterThanOrEqual(Math.min(lo, before) - 1e-9);
      expect(after).toBeLessThanOrEqual(Math.max(hi, before) + 1e-9);
    }
  }, 90_000);

  test("un diseño rechazado que se corrige se puede aplicar aunque después no mejore", () => {
    const config = scenario("loop-contact");
    expect(runSimulation(config).verdict.approved).toBe(false);

    const result = drain(optimizeDesign(config, { objective: "height", variables: ["initialSpeed"] }));

    expect(result.ok).toBe(true);
    expect(result.corrected).toBe(true);
    expect(result.startReason).toBe("rejected");
    expect(result.applicable).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(runSimulation(result.config, { timeStep: 0.01 }).verdict.approved).toBe(true);
  }, 90_000);

  test("una mejora del tamaño del ruido no se ofrece: el diseño ya está en su mejor punto", () => {
    const config = scenario("three-loops");
    const [first, second] = loops(config);
    const variables = [`loopHeight:${first}`, `loopTopRadius:${first}`, `loopHeight:${second}`, `loopTopRadius:${second}`];

    const result = drain(optimizeDesign(config, { objective: "maxLoad", variables }));

    expect(result.ok).toBe(true);
    expect(result.applicable).toBe(false);
    expect(result.changes).toEqual([]);
    expect(result.reason).toMatch(/mejor punto/);
    // La fuerza g máxima está en el loop 3, que no depende de los valores elegidos: no hay equilibrio que afirmar.
    expect(result.limiting.text).not.toMatch(/equilibr/);
    expect(result.limiting.text).toMatch(/no depende de los valores elegidos/);
  }, 90_000);

  test("en un diseño rechazado, los valores por defecto incluyen los del incumplimiento y alcanzan para corregirlo", () => {
    const config = scenario("brake-short");
    const run = runSimulation(config, { timeStep: 0.02 });

    const variables = defaultVariables(config, run, "maxLoad");
    const result = drain(optimizeDesign(config, { objective: "maxLoad", variables }));

    expect(variables).toEqual(expect.arrayContaining(["brakingLength", "brakeDeceleration", "initialHeight"]));
    expect(variables.length).toBeLessThanOrEqual(4);
    expect(result.ok).toBe(true);
    expect(result.applicable).toBe(true);
  }, 90_000);

  test("el ancho del trazado no tiene un tope relativo: su dominio es el de la configuración", () => {
    const config = scenario("line");
    const width = optimizationVariables(config).find(variable => variable.id === "trackWidth");

    expect(width.range[0]).toBeLessThanOrEqual(CONFIG_LIMITS.trackWidth[0]);
    expect(width.range[1]).toBeGreaterThanOrEqual(CONFIG_LIMITS.trackWidth[1]);
  });

  test("los textos de los tramos llevan su artículo y contraen «de el» en «del»", () => {
    expect(sectionPhrase("Loop 1")).toBe("el loop 1");
    expect(sectionPhrase("Descenso")).toBe("el descenso");
    expect(sectionPhrase("Plano inclinado")).toBe("el plano inclinado");
    expect(sectionPhrase("Resorte de tope")).toBe("el resorte de tope");
    expect(sectionPhrase("Frenos de ajuste 1")).toBe("los frenos de ajuste 1");
    expect(sectionPhrase("Colina (subida)")).toBe("la colina (subida)");
    expect(ofPhrase("Loop 3")).toBe("del loop 3");
    expect(ofPhrase("Frenos de ajuste 1")).toBe("de los frenos de ajuste 1");
    expect(ofPhrase("Caída inicial")).toBe("de la caída inicial");
  });

  test("los textos de qué limita no terminan en punto (lo pone la interfaz) y no muestran símbolos con guion bajo", () => {
    const results = [
      drain(optimizeDesign(scenario("line"), { objective: "height", variables: ["initialHeight"], budget: 60 })),
      drain(optimizeDesign(scenario("valley"), { objective: "margin", variables: ["hillCrestRadius:2", "initialHeight"], budget: 60 }))
    ];

    for (const result of results) {
      expect(result.limiting.text).not.toMatch(/\.$/);
      expect(result.limiting.text).not.toMatch(/[a-zρ]_[A-Za-zá]/);
    }
  }, 90_000);
});
