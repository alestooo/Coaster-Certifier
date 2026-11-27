import { describe, test, expect } from "vitest";
import { runSimulation, resolveConfig, buildTrack, DEFAULT_CONFIG, CSV_COLUMNS } from "../src/physics/index.js";
import { mapTemplate } from "../src/game/maps.ts";

const MASS = 600;
const DRAG_AREA = 2;
const DENSITY = 1.2;
/** k = ρ·C_dA/(2m) (1/m): a = −k·v² por el aire. */
const K = (DENSITY * DRAG_AREA) / (2 * MASS);

/** Estados del historial con s dentro de (desde, hasta). */
function statesBetween(history, from, to) {
  return history.filter(state => state.distance > from && state.distance < to);
}

describe("Resistencia del aire", () => {
  test("en un plano inclinado, v² sigue v_t² + (v₀² − v_t²)·e^(−2k·s), con v_t² = g·sin θ/k", () => {
    // Arrange: el «Plano inclinado» es una recta de A a E; sin fricción, solo el aire frena.
    const config = resolveConfig({ ...mapTemplate("incline"), friction: 0, initialSpeed: 0, mass: MASS, airDragArea: DRAG_AREA, airDensity: DENSITY });
    const track = buildTrack(config);
    const slope = track.sections[0];
    const sine = config.initialHeight / slope.length;
    const terminalSquared = (config.gravity * sine) / K;

    // Act
    const { history } = runSimulation(config, { timeStep: 0.01 });
    const samples = statesBetween(history, 5, slope.end - 2);

    // Assert
    expect(samples.length).toBeGreaterThan(20);
    for (const state of [samples[0], samples[Math.floor(samples.length / 2)], samples.at(-1)]) {
      const expected = terminalSquared * (1 - Math.exp(-2 * K * state.distance));
      expect(Math.abs(state.velocity ** 2 - expected) / expected).toBeLessThan(1e-4);
    }
  });

  test("en un tramo plano, v(s) = v₀·e^(−k·s)", () => {
    // Arrange: bajada suave y una recta horizontal de 290 m sin fricción.
    const config = resolveConfig({
      ...DEFAULT_CONFIG,
      friction: 0,
      mass: MASS,
      airDragArea: DRAG_AREA,
      airDensity: DENSITY,
      initialHeight: 20,
      track: [{ type: "start" }, { type: "point", x: 60, y: 0 }, { type: "point", x: 350, y: 0 }, { type: "end", x: 360 }]
    });
    const track = buildTrack(config);
    const flat = track.sections[1];

    // Act
    const { history } = runSimulation(config, { timeStep: 0.01 });
    const entry = statesBetween(history, flat.start, flat.start + 2)[0];
    const later = [100, 250].map(distance => statesBetween(history, flat.start + distance, flat.end)[0]);

    // Assert
    for (const state of later) {
      const expected = entry.velocity * Math.exp(-K * (state.distance - entry.distance));
      expect(Math.abs(state.velocity - expected) / expected).toBeLessThan(1e-4);
    }
  });

  test("con frenos y aire, el tren se detiene en s = ln(1 + k·v_E²/a_f)/(2k) desde E", () => {
    // Arrange: frenos de estación largos, sin fricción: dv/dt = −(a_f + k·v²).
    const config = resolveConfig({ ...mapTemplate("incline"), friction: 0, mass: MASS, airDragArea: DRAG_AREA, airDensity: DENSITY, brakingLength: 150, brakeDeceleration: 3 });
    const track = buildTrack(config);

    // Act
    const { history, final } = runSimulation(config, { timeStep: 0.01 });
    const entry = history.find(state => state.distance >= track.brakeStart);
    const before = history[history.indexOf(entry) - 1];
    // Rapidez exacta en E: la del estado justo antes, con el aire en la aproximación horizontal.
    const speedAtE = before.velocity * Math.exp(-K * (track.brakeStart - before.distance));
    const expected = Math.log(1 + (K * speedAtE ** 2) / config.brakeDeceleration) / (2 * K);

    // Assert
    expect(final.status).toBe("finished");
    expect(Math.abs(final.distance - track.brakeStart - expected) / expected).toBeLessThan(1e-4);
  });

  test("con un C_dA diminuto, la zona de frenado da la misma distancia que sin aire (sin cancelación numérica)", () => {
    const base = { mapId: "reference" };
    const without = runSimulation(base).final.distance;
    const tiny = runSimulation({ ...base, airDragArea: 1e-12 }).final.distance;

    expect(Math.abs(tiny - without)).toBeLessThan(1e-3);
  });

  test("sin aire nada cambia y la fuerza del aire va al final del CSV", () => {
    const run = runSimulation({ mapId: "reference" });

    expect(run.history.every(state => state.forces.air === 0)).toBe(true);
    expect(CSV_COLUMNS.findIndex(column => column.header === "estado")).toBe(24);
    expect(CSV_COLUMNS.findIndex(column => column.header === "aire_N")).toBe(25);
  });
});
