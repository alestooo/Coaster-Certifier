/**
 * Propiedades del motor: pureza, determinismo, convergencia, criterios
 * de aceptación, dictamen y exportación.
 */
import { describe, it, expect } from "vitest";
import {
  createInitialState,
  step,
  runSimulation,
  evaluateRun,
  checkDesignConditions,
  toCsv,
  CSV_COLUMNS,
  CRITERIA,
  recommendationSearch,
  explainFailure
} from "../src/physics/index.js";
import { IDEAL, simulate, deepFreeze } from "./helpers.js";

describe("Pureza y determinismo", () => {
  it("el mismo estado y el mismo dt producen siempre el mismo resultado", () => {
    const config = { ...IDEAL, mapId: "loop", initialHeight: 32, loopHeight: 20, loopTopRadius: 5, friction: 0.015 };
    const first = runSimulation(config);
    const second = runSimulation(config);

    expect(second.history).toEqual(first.history);
    expect(second.verdict).toEqual(first.verdict);
  });

  it("step nunca modifica el estado ni la configuración recibidos", () => {
    const config = deepFreeze({ ...IDEAL, mapId: "valley", initialHeight: 25, hillHeight: 8, hillCrestRadius: 30 });
    const initial = deepFreeze(createInitialState(config));
    const snapshot = JSON.stringify(initial);

    const next = step(initial, config, 0.05);

    expect(JSON.stringify(initial)).toBe(snapshot);
    expect(next).not.toBe(initial);
    expect(next.time).toBeCloseTo(0.05, 12);
  });

  it("devuelve el mismo estado cuando la simulación ya terminó", () => {
    const run = simulate({ mapId: "slope", initialHeight: 20 });
    expect(step(run.final, run.config, 0.01)).toBe(run.final);
  });

  it("rechaza pasos de tiempo inválidos", () => {
    const initial = createInitialState(IDEAL);
    expect(() => step(initial, IDEAL, 0)).toThrow();
    expect(() => step(initial, IDEAL, 2)).toThrow();
    expect(() => step(initial, IDEAL, Number.NaN)).toThrow();
  });
});

describe("Convergencia del integrador", () => {
  // La tabla de longitud de arco hace que el lado derecho de la EDO sea solo
  // continuo (C⁰) en sus nudos; allí RK4 pierde orden y domina el error.
  it("reducir el subpaso de 1 ms a 0,25 ms cambia la rapidez menos de 1e-5 relativo", () => {
    const base = { ...IDEAL, mapId: "loop", initialHeight: 32, loopHeight: 20, loopTopRadius: 5, friction: 0.01 };
    const coarse = runSimulation({ ...base, maxSubstep: 0.001 });
    const fine = runSimulation({ ...base, maxSubstep: 0.00025 });

    expect(coarse.history.length).toBe(fine.history.length);

    coarse.history.forEach((state, index) => {
      const other = fine.history[index];
      expect(Math.abs(state.speed - other.speed) / Math.max(1, other.speed)).toBeLessThan(1e-5);
      expect(Math.abs(state.distance - other.distance)).toBeLessThan(1e-3);
    });
  });
});

describe("Criterios de aceptación", () => {
  it("rechaza por carga máxima en la base de un loop circular (≥ 6 g)", () => {
    const run = simulate({ mapId: "loop", initialHeight: 40, loopHeight: 16, loopTopRadius: 8, maxLoad: 5 });
    const event = run.final.events.at(-1);

    expect(run.final.status).toBe("rejected");
    expect(event.code).toBe(CRITERIA.MAX_LOAD);
    expect(event.value).toBeGreaterThan(5);
    expect(event.limit).toBe(5);
    expect(event.unit).toBe("g");
    expect(event.section).toMatch(/Loop|Caída/);
  });

  it("con ruedas de seguridad permite airtime hasta −1 g y lo rechaza por debajo", () => {
    const base = { mapId: "valley", initialHeight: 30, trackWidth: 300, hillHeight: 6, contactModel: "safety-wheels" };
    const mild = simulate({ ...base, hillCrestRadius: 30 });
    const strict = simulate({ ...base, hillCrestRadius: 30, contactModel: "strict" });
    const harsh = simulate({ ...base, hillCrestRadius: 15 });

    expect(mild.verdict.summary.minLoad.value).toBeLessThan(0);
    expect(mild.verdict.approved).toBe(true);
    expect(strict.final.status).toBe("lost-contact");
    expect(harsh.final.events.at(-1).code).toBe(CRITERIA.MIN_LOAD);
  });

  it("detecta que el tren se queda sin energía antes de la colina", () => {
    const run = simulate({ mapId: "valley", initialHeight: 10, trackWidth: 260, hillHeight: 14, hillCrestRadius: 30, friction: 0.02 });

    expect(run.final.status).toBe("stalled");
    expect(run.final.events.at(-1).code).toBe(CRITERIA.MIN_SPEED);
    expect(run.verdict.approved).toBe(false);
  });

  it("rechaza cuando la zona de frenado es demasiado corta", () => {
    const run = simulate({ mapId: "slope", initialHeight: 30, brakeDeceleration: 2, brakingLength: 20 });
    const event = run.final.events.at(-1);

    expect(event.code).toBe(CRITERIA.OVERRUN);
    expect(event.position).toBeCloseTo(run.track.totalLength, 3);
  });

  it("rechaza la compresión excesiva del resorte", () => {
    const run = simulate({ mapId: "slope", initialHeight: 20, brakeMode: "spring", springConstant: 2000, maxCompression: 3, brakingLength: 40 });
    expect(run.final.events.at(-1).code).toBe(CRITERIA.COMPRESSION);
  });

  it("un resorte amortiguado detiene el tren en la estación", () => {
    const run = simulate({
      mapId: "slope",
      initialHeight: 20,
      brakeMode: "spring",
      springConstant: 6000,
      springDamping: 4000,
      maxCompression: 20,
      brakingLength: 60,
      friction: 0.01,
      maxTime: 60
    });

    expect(["stopped", "finished"]).toContain(run.final.status);
    expect(run.final.distance).toBeGreaterThanOrEqual(run.track.stationStart);
    expect(run.verdict.approved).toBe(true);
    expect(Math.abs(run.final.energies.balanceError) / run.final.energies.initial).toBeLessThan(1e-4);
  });
});

describe("Dictamen", () => {
  it("aprueba un trazado de certificación correcto y reporta los puntos críticos", () => {
    const run = simulate({
      mapId: "reference",
      initialHeight: 30,
      initialSpeed: 2,
      trackWidth: 320,
      loopHeight: 21.5,
      loopTopRadius: 5,
      hillHeight: 10,
      hillCrestRadius: 55,
      friction: 0.01,
      brakeDeceleration: 6,
      brakingLength: 60,
      maxLoad: 5
    });

    expect(run.verdict.approved).toBe(true);
    expect(run.verdict.violations).toHaveLength(0);
    expect(run.verdict.summary.maxLoad.value).toBeLessThanOrEqual(5);
    expect(run.verdict.summary.criticalPoints.map(point => point.label)).toEqual(["A", "B", "C", "D", "E", "F"]);
    const [end, ...points] = [...run.verdict.summary.criticalPoints].reverse();
    expect(points.every(point => point.reached)).toBe(true);
    expect(end.label).toBe("F");
    expect(end.reached).toBe(false);
    expect(run.verdict.summary.braking.remainingLength).toBeGreaterThan(0);
    expect(run.verdict.designChecks.every(check => check.ok)).toBe(true);
    expect(run.verdict.summary.sections.filter(section => section.reached).length).toBe(run.track.sections.length);
  });

  it("registra cada incumplimiento con instante, tramo, posición, valor y límite", () => {
    const run = simulate({ mapId: "loop", initialHeight: 12, loopHeight: 16, loopTopRadius: 4 });
    const [violation] = run.verdict.violations;

    expect(run.verdict.approved).toBe(false);
    expect(violation).toMatchObject({ unit: "N", limit: 0, comparison: ">" });
    expect(violation.time).toBeGreaterThan(0);
    expect(violation.section).toBe("Loop 1");
    expect(violation.position).toBeGreaterThan(0);
    expect(run.verdict.reasons[0]).toMatch(/Loop 1/);
  });

  it("anticipa trazados imposibles con las condiciones de diseño del anexo", () => {
    const checks = checkDesignConditions({ ...IDEAL, mapId: "loop", initialHeight: 10, loopHeight: 16, loopTopRadius: 4 });
    const loopCheck = checks.find(check => check.id.startsWith("loop"));

    expect(loopCheck.ok).toBe(false);
    expect(loopCheck.formula).toContain("h_L + R/2");
  });

  it("evaluateRun reconstruye el dictamen desde un historial", () => {
    const run = simulate({ mapId: "slope", initialHeight: 20 });
    expect(evaluateRun(run.history, run.config)).toEqual(run.verdict);
  });
});

describe("Exportación CSV", () => {
  it("escribe un encabezado con unidades y una fila por estado", () => {
    const run = simulate({ mapId: "slope", initialHeight: 20 });
    const csv = toCsv(run.history);
    const lines = csv.trim().split("\n");

    expect(lines[0]).toBe(CSV_COLUMNS.map(column => column.header).join(","));
    expect(lines[0]).toContain("t_s");
    expect(lines[0]).toContain("E_mecanica_J");
    expect(lines).toHaveLength(run.history.length + 1);
    expect(lines[1].split(",")[0]).toBe("0.00000000");
    expect(lines.at(-1)).toContain("finished");
  });
});

describe("Recomendaciones", () => {
  it("encuentra alternativas verificadas para un loop sin energía", () => {
    const config = { ...IDEAL, mapId: "loop", initialHeight: 14, loopHeight: 16, loopTopRadius: 4, maxLoad: 6 };
    const search = recommendationSearch(config);

    let result = search.next();
    while (!result.done) result = search.next();

    expect(result.value.recommendations.length).toBeGreaterThan(0);

    for (const option of result.value.recommendations) {
      expect(runSimulation(option.config).verdict.approved).toBe(true);
      expect(option.changes.length).toBeGreaterThan(0);
    }
  });

  it("explica la pérdida de contacto en el loop", () => {
    const run = simulate({ mapId: "loop", initialHeight: 12, loopHeight: 16, loopTopRadius: 4 });
    const detail = explainFailure(run.final, run.config);

    expect(detail.title).toMatch(/Contacto/);
    expect(detail.explanation).toMatch(/v² > gR/);
  });
});
