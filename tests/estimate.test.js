import { describe, test, expect } from "vitest";
import { runSimulation, resolveConfig, buildTrack, geometryAt, liftMetrics, estimateRide, findScenario, DEFAULT_CONFIG } from "../src/physics/index.js";

/** Todos los números de un objeto (recursivo), para buscar NaN o infinitos. */
function numbersIn(value) {
  if (typeof value === "number") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(numbersIn);
  return [];
}

/** Estado mínimo para un historial sintético. */
const state = (time, load, extra = {}) => ({
  time,
  load,
  distance: time,
  speed: 10,
  velocity: 10,
  forces: { brake: 0, spring: 0, damper: 0 },
  energies: { dissipated: 0, input: 0 },
  ...extra
});

describe("Estimador de la atracción", () => {
  test("el ciclo suma estación, subida y recorrido, y los pasajeros por hora salen de los asientos", () => {
    // Arrange
    const config = resolveConfig({ mapId: "reference" });
    const run = runSimulation(config);
    const lift = liftMetrics(config);

    // Act
    const estimate = estimateRide(config, run, { stationSeconds: 45, seats: 4 });

    // Assert
    expect(estimate.path.trackLength).toBeCloseTo(run.track.totalLength, 9);
    expect(estimate.path.liftLength).toBeCloseTo(lift.length, 9);
    expect(estimate.times.lift).toBeCloseTo(lift.time, 9);
    expect(estimate.times.ride).toBeCloseTo(run.final.time, 9);
    expect(estimate.times.cycle).toBeCloseTo(45 + lift.time + run.final.time, 9);
    expect(estimate.times.throughput).toBeCloseTo((3600 * 4) / estimate.times.cycle, 9);
    expect(estimate.energy.liftEnergyKWh).toBeCloseTo(lift.energy / 3.6e6, 12);
    expect(estimate.energy.brakeEnergy).toBeGreaterThan(0);
  });

  test("los segundos de flotación y por encima de 4 g salen del historial", () => {
    // Arrange: 1 s a 0,1 g y 2 s a 4,5 g.
    const history = [state(0, 1), state(1, 0.1), state(2, 4.5), state(4, 1), state(5, 1)];
    const run = {
      history,
      final: history.at(-1),
      track: buildTrack({ mapId: "reference" }),
      verdict: { summary: { maxSpeed: { value: 10 }, maxLoad: { value: 4.5 }, minLoad: { value: 0.1 }, inputEnergy: 0 } }
    };

    // Act
    const estimate = estimateRide(resolveConfig({ mapId: "reference" }), run);

    // Assert
    expect(estimate.motion.floatSeconds).toBeCloseTo(1, 9);
    expect(estimate.motion.highLoadSeconds).toBeCloseTo(2, 9);
  });

  test("sin subida y con resorte, el estimador no da NaN", () => {
    const config = resolveConfig({ ...DEFAULT_CONFIG, brakeMode: "spring", springDamping: 3000, track: [{ type: "start" }, { type: "point", x: 60, y: 0 }, { type: "end", x: 160 }] });
    const run = runSimulation(config);

    const estimate = estimateRide(config, run);

    expect(estimate.path.liftLength).toBeNull();
    expect(estimate.times.lift).toBeNull();
    expect(estimate.energy.liftPower).toBeNull();
    expect(numbersIn(estimate).every(Number.isFinite)).toBe(true);
  });

  test("los supuestos fuera de rango se recortan", () => {
    const config = resolveConfig({ mapId: "reference" });

    const estimate = estimateRide(config, runSimulation(config), { supportSpacing: 0, stationSeconds: -5, seats: 0 });

    expect(estimate.assumptions).toEqual({ supportSpacing: 2, stationSeconds: 0, seats: 1 });
  });

  test("las columnas van cada separación de recorrido, sin loops ni zapatas, y la subida suma las suyas", () => {
    // Arrange
    const config = resolveConfig({ mapId: "reference" });
    const run = runSimulation(config);
    const spacing = 10;
    const track = run.track;
    const lift = config.track[0].lift;

    // Act
    const { structure } = estimateRide(config, run, { supportSpacing: spacing });

    // Assert: columnas sobre la vía evaluada (sin loops ni puntos a menos de 0,5 m) más las de la rampa.
    const onTrack = [];
    for (let s = spacing; s < track.stationStart; s += spacing) {
      const point = geometryAt(track, s);
      if (point.kind !== "loop" && point.y >= 0.5) onTrack.push(point.y);
    }
    const onLift = [];
    for (let d = spacing; d * Math.sin(lift.angle) <= config.initialHeight - 0.5; d += spacing) onLift.push(config.initialHeight - d * Math.sin(lift.angle));
    const heights = [...onTrack, ...onLift];
    expect(structure.supports).toBe(heights.length);
    expect(structure.totalColumnHeight).toBeCloseTo(heights.reduce((sum, height) => sum + height, 0), 6);
    expect(structure.tallestColumn).toBeCloseTo(Math.max(...heights), 6);
    expect(structure.footprint).toBeCloseTo(track.endX + config.initialHeight / Math.tan(lift.angle), 6);
  });

  test("un recorrido que no termina no da tiempos ni capacidad: dice que no termina", () => {
    // Loop circular: se rechaza en el loop, antes de frenar.
    const config = resolveConfig({ mapId: "loop", loopTopRadius: 7, loopHeight: 14, initialHeight: 30, initialSpeed: 2 });
    const run = runSimulation(config);
    expect(["finished", "stopped"]).not.toContain(run.final.status);

    const estimate = estimateRide(config, run);

    expect(estimate.complete).toBe(false);
    expect(estimate.times.ride).toBeNull();
    expect(estimate.times.cycle).toBeNull();
    expect(estimate.times.throughput).toBeNull();
    expect(estimate.energy.brakeEnergy).toBeNull();
    expect(numbersIn(estimate).every(Number.isFinite)).toBe(true);
  });

  test("la potencia pico de frenado no cuenta la fuerza conservativa del resorte", () => {
    const config = resolveConfig(findScenario("spring-damped").config);
    const run = runSimulation(config);
    expect(run.final.status).toBe("stopped");
    const zone = run.history.filter(state => state.distance >= run.track.brakeStart);
    const damperPeak = Math.max(...zone.map(state => Math.abs(state.forces.damper * state.velocity)));

    expect(estimateRide(config, run).energy.peakBrakePower).toBeCloseTo(damperPeak, 6);
  });
});
