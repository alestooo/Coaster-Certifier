import { describe, test, expect } from "vitest";
import { runSimulation, resolveConfig, buildTrack, CRITERIA, CSV_COLUMNS, DEFAULT_CONFIG } from "../src/physics/index.js";

const MASS = 600;
const HEIGHT = 5;

/** Frenos de ajuste planos de 60 m después de una bajada de 5 m, sin fricción ni aire. */
const flatTrims = damping =>
  resolveConfig({
    ...DEFAULT_CONFIG,
    mass: MASS,
    friction: 0,
    initialHeight: HEIGHT,
    initialSpeed: 0,
    minSpeed: 0,
    track: [{ type: "start" }, { type: "point", x: 30, y: 0 }, { type: "trim", x: 40, y: 0, length: 60, damping }, { type: "point", x: 150, y: 0 }, { type: "end", x: 160 }]
  });

describe("Frenos de ajuste", () => {
  test("en un tramo plano sin fricción, v(s) = v₀ − (c/m)·s dentro de los frenos de ajuste", () => {
    // Arrange: Δv = c·L/m = 50·60/600 = 5 m/s.
    const damping = 50;
    const config = flatTrims(damping);
    const zone = buildTrack(config).zones[0];
    const entrySpeed = Math.sqrt(2 * config.gravity * HEIGHT);

    // Act
    const { history } = runSimulation(config, { timeStep: 0.005 });
    const inside = history.filter(state => state.distance > zone.start && state.distance < zone.end);

    // Assert
    expect(inside.length).toBeGreaterThan(10);
    for (const state of inside) {
      const expected = entrySpeed - (damping / MASS) * (state.distance - zone.start);
      expect(Math.abs(state.velocity - expected)).toBeLessThan(1e-6);
      expect(state.forces.trim).toBeCloseTo(-damping * state.velocity, 9);
    }
    const after = history.find(state => state.distance > zone.end + 1);
    expect(after.velocity).toBeCloseTo(entrySpeed - (damping * 60) / MASS, 5);
    expect(CSV_COLUMNS.some(column => column.header === "frenos_ajuste_N")).toBe(true);
  });

  test("unos frenos de ajuste que desaceleran más de 1 g se rechazan", () => {
    const { final } = runSimulation(flatTrims(2000));

    expect(final.status).toBe("rejected");
    expect(final.events[0].code).toBe(CRITERIA.TRIM);
    expect(final.events[0].section).toBe("Frenos de ajuste 1");
  });

  test("lo que frenan los frenos de ajuste cuenta como energía disipada", () => {
    const { history } = runSimulation(flatTrims(50), { timeStep: 0.01 });
    const last = history.at(-1);

    expect(last.energies.dissipated).toBeGreaterThan(0);
    for (const state of history) expect(Math.abs(state.energies.balanceError) / (state.energies.initial / 1000)).toBeLessThan(1e-3);
  });
});
