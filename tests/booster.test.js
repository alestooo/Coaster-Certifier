import { describe, test, expect } from "vitest";
import { runSimulation, resolveConfig, buildTrack, calculateForces, checkDesignConditions, boosterWork, CRITERIA, CSV_COLUMNS, DEFAULT_CONFIG } from "../src/physics/index.js";

const MASS = 600;
const POWER = 150_000;
const MAX_ACCELERATION = 12;
const HEIGHT = 5;

const start = { type: "start" };
const point = (x, y) => ({ type: "point", x, y });
const booster = (x, y, length, extra = {}) => ({ type: "booster", x, y, length, power: POWER, maxAcceleration: MAX_ACCELERATION, ...extra });
const end = x => ({ type: "end", x });

/** Lanzador plano de 60 m después de una bajada de 5 m, sin fricción ni aire. */
const flatLaunch = (extra = {}) =>
  resolveConfig({ ...DEFAULT_CONFIG, mass: MASS, friction: 0, initialHeight: HEIGHT, initialSpeed: 0, track: [start, point(30, 0), booster(40, 0, 60), point(150, 0), end(160)], ...extra });

/** Rapidez ideal a `distance` m de la entrada: fuerza constante hasta v₁ = P/(m·a_máx), después potencia constante. */
function idealSpeed(entrySpeed, distance) {
  const switchSpeed = POWER / (MASS * MAX_ACCELERATION);
  const forceStretch = Math.max(0, (switchSpeed ** 2 - entrySpeed ** 2) / (2 * MAX_ACCELERATION));
  if (distance <= forceStretch) return Math.sqrt(entrySpeed ** 2 + 2 * MAX_ACCELERATION * distance);
  return Math.cbrt(Math.max(entrySpeed, switchSpeed) ** 3 + 3 * (POWER / MASS) * (distance - forceStretch));
}

describe("Lanzador LSM", () => {
  test("la rapidez de salida del lanzador sigue las dos fases: fuerza constante y potencia constante", () => {
    // Arrange
    const config = flatLaunch();
    const zone = buildTrack(config).zones[0];
    const entrySpeed = Math.sqrt(2 * config.gravity * HEIGHT);

    // Act
    const { history } = runSimulation(config, { timeStep: 0.005 });
    const inside = history.filter(state => state.distance > zone.start && state.distance < zone.end);

    // Assert: dentro de la zona hay estados de las dos fases.
    expect(inside.length).toBeGreaterThan(10);
    for (const state of inside) {
      const expected = idealSpeed(entrySpeed, state.distance - zone.start);
      expect(Math.abs(state.velocity - expected) / expected).toBeLessThan(1e-4);
    }
    const work = boosterWork(zone, MASS, entrySpeed);
    expect(work.exitSpeed).toBeCloseTo(idealSpeed(entrySpeed, 60), 6);
    expect(work.work).toBeCloseTo(0.5 * MASS * (work.exitSpeed ** 2 - entrySpeed ** 2), 3);
  });

  test("el balance E_m + E_dis − E₀ − W_entrada se mantiene < 1e-3 J por kJ", () => {
    const { history } = runSimulation(flatLaunch({ friction: 0.01 }), { timeStep: 0.01 });
    const last = history.at(-1);

    expect(last.energies.input).toBeGreaterThan(0);
    for (const state of history) {
      const scale = (state.energies.initial + Math.abs(state.energies.input)) / 1000;
      expect(Math.abs(state.energies.balanceError) / scale).toBeLessThan(1e-3);
    }
    expect(CSV_COLUMNS.some(column => column.header === "lanzador_N")).toBe(true);
  });

  test("el lanzador arranca un tren en reposo con m·a_máx", () => {
    const config = flatLaunch();
    const track = buildTrack(config);
    const middle = (track.zones[0].start + track.zones[0].end) / 2;

    expect(calculateForces(track, config, middle, 0).booster).toBeCloseTo(MASS * MAX_ACCELERATION, 9);
    expect(calculateForces(track, config, middle, 1e-12).booster).toBeCloseTo(MASS * MAX_ACCELERATION, 9);
    expect(calculateForces(track, config, middle, 40).booster).toBeCloseTo(POWER / 40, 9);
    expect(calculateForces(track, config, track.zones[0].end + 1, 10).booster).toBe(0);
  });

  test("un lanzador de 3 g se rechaza con la regla de 1,5 g", () => {
    const config = flatLaunch({ track: [start, point(30, 0), booster(40, 0, 60, { maxAcceleration: 3 * 9.81, power: 2_000_000 }), point(150, 0), end(160)] });

    const { final } = runSimulation(config);

    expect(config.maxLaunchAcceleration).toBe(1.5);
    expect(final.status).toBe("rejected");
    expect(final.events[0].code).toBe(CRITERIA.LAUNCH);
    expect(final.events[0].section).toBe("Lanzador 1");
  });

  test("con un lanzador antes del loop, la condición de energía del loop se cumple", () => {
    const loopTrack = extra => [start, point(30, 0), ...extra, { type: "point", x: 170, y: 0, loop: { height: 20, topRadius: 5 } }, end(320)];
    const without = checkDesignConditions({ ...DEFAULT_CONFIG, initialHeight: 10, track: loopTrack([]) });
    const withBooster = checkDesignConditions({ ...DEFAULT_CONFIG, initialHeight: 10, track: loopTrack([booster(40, 0, 60)]) });

    expect(without.find(check => check.id.startsWith("loop"))?.ok).toBe(false);
    expect(withBooster.find(check => check.id.startsWith("loop"))?.ok).toBe(true);
  });

  test("un lanzador al que el tren no puede llegar no suma energía a las condiciones de diseño", () => {
    // A a 10 m y el lanzador a 40 m de altura: el tren nunca llega, así que el loop sigue sin energía.
    const track = [start, point(30, 0), booster(60, 40, 40), point(140, 0), { type: "point", x: 220, y: 0, loop: { height: 20, topRadius: 5 } }, end(360)];

    const checks = checkDesignConditions({ ...DEFAULT_CONFIG, initialHeight: 10, track });

    expect(checks.find(check => check.id.startsWith("loop"))?.ok).toBe(false);
  });

  test("una montaña rusa lanzada arranca en reposo desde la estación: el lanzador empieza en A", () => {
    // Sin subida, A a 1 m, v₀ = 0 y el lanzador desde A: 6 m/s² en fuerza constante (P/(m·a) = 100 m/s).
    const config = resolveConfig({
      ...DEFAULT_CONFIG,
      mass: 500,
      friction: 0,
      initialHeight: 1,
      initialSpeed: 0,
      brakingLength: 120,
      track: [{ type: "start" }, booster(0, 1, 40, { power: 300_000, maxAcceleration: 6 }), point(140, 1), end(180)]
    });
    const track = buildTrack(config);

    const { history, final } = runSimulation(config, { timeStep: 0.01 });
    const at = history.find(state => state.distance >= 20);

    expect(track.zones[0].start).toBe(0);
    expect(track.sections[0].name).toBe("Lanzador 1");
    expect(Math.abs(at.velocity - Math.sqrt(2 * 6 * at.distance))).toBeLessThan(1e-6);
    expect(final.status).toBe("finished");
  });
});
