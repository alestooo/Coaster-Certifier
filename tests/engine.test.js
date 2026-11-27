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
  explainFailure,
  SCENARIOS,
  buildTrack,
  resolveConfig
} from "../src/physics/index.js";
import { IDEAL, simulate, deepFreeze } from "./helpers.js";

/**
 * Límites de tiempo de las pruebas que simulan muchos recorridos. Acá tardan
 * 1–18 s, pero en una compu varias veces más lenta (o con otras pruebas en
 * paralelo) superaban los 5 s por defecto o quedaban justo en el límite.
 */
const SEARCH_TIMEOUT_MS = 60_000;
const SCENARIO_SEARCH_TIMEOUT_MS = 120_000;
const LONG_RUN_TIMEOUT_MS = 30_000;

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
  }, SEARCH_TIMEOUT_MS);

  it("un resorte que devuelve al tren fuera de la zona de frenado recibe una corrección verificada", () => {
    const search = recommendationSearch({ mapId: "slope", initialHeight: 20, trackWidth: 220, friction: 0.01, brakeMode: "spring", springConstant: 6000, springDamping: 2600, maxCompression: 8, brakingLength: 80, maxTime: 120 });

    let result = search.next();
    while (!result.done) result = search.next();

    expect(result.value.recommendations.length, result.value.reason).toBeGreaterThan(0);
    for (const option of result.value.recommendations) {
      expect(runSimulation(option.config).verdict.approved).toBe(true);
    }
  }, SCENARIO_SEARCH_TIMEOUT_MS);

  /** Corre la búsqueda de correcciones hasta el final. */
  function searchAll(input) {
    const search = recommendationSearch(input);
    let result = search.next();
    while (!result.done) result = search.next();
    return result.value;
  }

  it("un loop circular sobre un punto del personalizado recibe una corrección verificada que cambia ese loop", () => {
    const input = {
      mapId: "custom",
      initialHeight: 30,
      initialSpeed: 2,
      track: [{ type: "start" }, { type: "point", x: 80, y: 0 }, { type: "point", x: 150, y: 0, loop: { height: 21.5, topRadius: 10.75 } }, { type: "end", x: 300 }]
    };
    const { recommendations } = searchAll(input);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.some(option => option.changes.some(change => change.element === 2 && ["loopTopRadius", "loopHeight"].includes(change.key)))).toBe(true);
    for (const option of recommendations) expect(runSimulation(option.config).verdict.approved).toBe(true);
  }, SCENARIO_SEARCH_TIMEOUT_MS);

  it("con dos loops, el parche apunta al loop que falla", () => {
    const input = {
      mapId: "custom",
      initialHeight: 30,
      initialSpeed: 2,
      track: [
        { type: "start" },
        // El primero es el loop del anexo (aprueba); el segundo, circular (supera 5 g).
        { type: "point", x: 70, y: 0, loop: { height: 21.5, topRadius: 5 } },
        { type: "point", x: 150, y: 0 },
        { type: "point", x: 230, y: 0, loop: { height: 21.5, topRadius: 10.75 } },
        { type: "end", x: 380 }
      ]
    };
    const run = runSimulation(input);
    expect(run.verdict.violations[0].section).toBe("Loop 2");

    const { recommendations } = searchAll(input);
    const loopChanges = recommendations.flatMap(option => option.changes).filter(change => ["loopTopRadius", "loopHeight"].includes(change.key));

    expect(loopChanges.length).toBeGreaterThan(0);
    expect(loopChanges.every(change => change.element === 3)).toBe(true);
  }, SCENARIO_SEARCH_TIMEOUT_MS);

  it.each(["circular-loop", "loop-contact", "stall", "brake-short", "spring-ideal"])(
    "el escenario que falla «%s» recibe al menos una corrección verificada",
    id => {
      const scenario = SCENARIOS.find(candidate => candidate.id === id);
      const search = recommendationSearch(scenario.config);

      let result = search.next();
      while (!result.done) result = search.next();

      expect(result.value.recommendations.length, result.value.reason).toBeGreaterThan(0);
      for (const option of result.value.recommendations) {
        expect(runSimulation(option.config).verdict.approved).toBe(true);
      }
    },
    SCENARIO_SEARCH_TIMEOUT_MS
  );

  it("explica la pérdida de contacto en el loop", () => {
    const run = simulate({ mapId: "loop", initialHeight: 12, loopHeight: 16, loopTopRadius: 4 });
    const detail = explainFailure(run.final, run.config);

    expect(detail.title).toMatch(/Contacto/);
    expect(detail.explanation).toMatch(/v² > gR/);
  });
});

describe("Robustez (hallazgos de revisión)", () => {
  it("un tren que la fricción frena en una recta queda en reposo, no se arrastra a velocidad constante", () => {
    // Resorte amortiguado que lo devuelve a la recta: ahí la fricción lo frena antes de la estación.
    // Con |v| < a·h/2, las etapas de RK4 cambian el signo de la fricción y se anulan: v quedaba fija (~3e-5 m/s)
    // y el recorrido terminaba en «tiempo agotado» en lugar de «detenido antes de la estación».
    const run = runSimulation(
      { mapId: "slope", initialHeight: 20, trackWidth: 220, friction: 0.01, brakeMode: "spring", springConstant: 6000, springDamping: 2078, maxCompression: 8, brakingLength: 80, maxTime: 120 },
      { timeStep: 0.02 }
    );

    expect(run.verdict.status).toBe("stalled");
    expect(run.final.speed).toBe(0);
    expect(run.final.time).toBeLessThan(60);
  });

  it("un tren en reposo antes de E se rechaza: no llegó a la zona de frenado", () => {
    // Caso del relevamiento: se detiene en s = 8,06 m, dentro de la aproximación (E = 13,06 m).
    const run = runSimulation({ mapId: "incline", initialHeight: 0.8, friction: 0.1, trackWidth: 5 }, { timeStep: 0.02 });

    expect(run.final.distance).toBeCloseTo(8.06, 2);
    expect(run.final.status).toBe("stalled");
    expect(run.verdict.approved).toBe(false);
    expect(run.verdict.violations.map(violation => violation.condition)).toEqual(["Recorrido completo: el tren debe llegar a la zona de frenado"]);
  });

  it("un tren que el resorte devuelve y queda antes de E se rechaza: quedó fuera de la zona de frenado", () => {
    // Amortiguador justo: el rebote lo deja en la aproximación, entre E − 8 m y E.
    const input = { mapId: "slope", initialHeight: 20, trackWidth: 220, friction: 0.01, brakeMode: "spring", springConstant: 6000, springDamping: 2600, maxCompression: 8, brakingLength: 80, maxTime: 120 };
    const run = runSimulation(input, { timeStep: 0.02 });
    const { brakeStart } = buildTrack(resolveConfig(input));

    expect(run.final.distance).toBeLessThan(brakeStart);
    expect(run.final.status).toBe("stalled");
    expect(run.verdict.approved).toBe(false);
    expect(run.verdict.violations.map(violation => [violation.code, violation.condition])).toEqual([
      ["outside-braking", "Recorrido completo: el tren quedó fuera de la zona de frenado tras el rebote"]
    ]);
  });

  it("explica el rebote fuera de la zona y el reposo antes de E con el incumplimiento del dictamen", () => {
    const rebound = runSimulation({ mapId: "slope", initialHeight: 20, trackWidth: 220, friction: 0.01, brakeMode: "spring", springConstant: 6000, springDamping: 2600, maxCompression: 8, brakingLength: 80, maxTime: 120 }, { timeStep: 0.02 });
    const short = runSimulation({ mapId: "incline", initialHeight: 0.8, friction: 0.1, trackWidth: 5 }, { timeStep: 0.02 });

    const reboundText = explainFailure(rebound.final, rebound.config, rebound.verdict.violations[0]).explanation;
    const shortText = explainFailure(short.final, short.config, short.verdict.violations[0]).explanation;

    expect(reboundText).toMatch(/resorte lo devolvió/);
    expect(reboundText).not.toMatch(/estación/);
    expect(shortText).toMatch(/antes de llegar a la zona de frenado/);
    expect(shortText).not.toMatch(/estación/);
  });

  it("resume historiales de más de 150 000 estados sin desbordar la pila", () => {
    const run = runSimulation({ ...IDEAL, mapId: "slope", initialHeight: 20, brakeMode: "spring", springConstant: 6000, maxCompression: 60, maxTime: 90 }, { timeStep: 0.0005 });

    expect(run.history.length).toBeGreaterThan(150000);
    expect(Number.isFinite(run.verdict.summary.braking.maxCompression)).toBe(true);
    expect(Number.isFinite(run.verdict.summary.maxSpeed.value)).toBe(true);
  }, LONG_RUN_TIMEOUT_MS);

  it("registra una sola causa cuando el tren se detiene por rapidez insuficiente", () => {
    const run = simulate({ mapId: "valley", initialHeight: 10, trackWidth: 260, hillHeight: 14, hillCrestRadius: 30, friction: 0.02 });

    expect(run.verdict.violations).toHaveLength(1);
    expect(run.verdict.violations[0].code).toBe(CRITERIA.MIN_SPEED);
  });

  it("marca las crestas interiores de un trazado personalizado y evalúa su energía", () => {
    const run = simulate({
      mapId: "custom",
      initialHeight: 20,
      trackWidth: 200,
      customPoints: [
        { x: 0, y: 1, loopHeight: 0, loopTopRadius: 0 },
        { x: 0.3, y: 0, loopHeight: 0, loopTopRadius: 0 },
        { x: 0.55, y: 0.5, loopHeight: 0, loopTopRadius: 0 },
        { x: 0.8, y: 0, loopHeight: 0, loopTopRadius: 0 },
        { x: 1, y: 0, loopHeight: 0, loopTopRadius: 0 }
      ]
    });

    expect(run.track.markers.map(marker => marker.label)).toEqual(["A", "D", "E", "F"]);
    expect(run.verdict.designChecks.some(check => check.id.startsWith("crest"))).toBe(true);
  });

  it("rechaza dos loops personalizados que se solapan", () => {
    expect(() =>
      simulate({
        mapId: "custom",
        trackWidth: 120,
        customPoints: [
          { x: 0, y: 1, loopHeight: 0, loopTopRadius: 0 },
          { x: 0.3, y: 0, loopHeight: 30, loopTopRadius: 6 },
          { x: 0.45, y: 0, loopHeight: 30, loopTopRadius: 6 },
          { x: 1, y: 0, loopHeight: 0, loopTopRadius: 0 }
        ]
      })
    ).toThrow(/espacio horizontal/);
  });
});
