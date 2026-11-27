import { describe, test, expect } from "vitest";
import { resolveConfig, buildTrack, runSimulation, liftMetrics, DEFAULT_CONFIG, DEFAULT_LIFT } from "../src/physics/index.js";

describe("Subida por cadena", () => {
  test("liftMetrics da largo, tiempo, potencia y energía del motor", () => {
    // Arrange: H = 30 m, α = 30°, η = 0,8, v_c = 2 m/s, m = 600 kg, μ = 0,01, sin aire.
    const angle = Math.PI / 6;
    const config = resolveConfig({ ...DEFAULT_CONFIG, mapId: "reference", initialHeight: 30, mass: 600, friction: 0.01 });
    const withLift = resolveConfig({ ...config, track: [{ type: "start", lift: { angle, efficiency: 0.8, chainSpeed: 2 } }, ...config.track.slice(1)] });

    // Act
    const metrics = liftMetrics(withLift);

    // Assert
    const g = withLift.gravity;
    const power = ((600 * g * Math.sin(angle) + 0.01 * 600 * g * Math.cos(angle)) * 2) / 0.8;
    expect(metrics.length).toBeCloseTo(60, 9);
    expect(metrics.time).toBeCloseTo(30, 9);
    expect(metrics.power).toBeCloseTo(power, 6);
    expect(metrics.energy).toBeCloseTo(power * 30, 3);
  });

  test("sin subida, un primer tramo plano construye y un tren sin v₀ queda detenido antes de E", () => {
    const config = resolveConfig({ ...DEFAULT_CONFIG, initialHeight: 2, initialSpeed: 0, track: [{ type: "start" }, { type: "point", x: 40, y: 2 }, { type: "end", x: 100 }] });

    expect(() => buildTrack(config)).not.toThrow();
    expect(liftMetrics(config)).toBeNull();
    expect(runSimulation(config).final.status).toBe("stalled");
  });

  test("con subida, el primer tramo sigue teniendo que descender", () => {
    expect(() => buildTrack({ ...DEFAULT_CONFIG, initialHeight: 2, track: [{ type: "start", lift: DEFAULT_LIFT }, { type: "point", x: 40, y: 2 }, { type: "end", x: 100 }] })).toThrow(/descender/);
  });

  test("las configuraciones viejas traen la subida de siempre", () => {
    const config = resolveConfig({ mapId: "loop" });

    expect(config.track[0].lift).toEqual(DEFAULT_LIFT);
    expect(DEFAULT_LIFT.angle).toBeCloseTo(Math.atan2(1, 1.35), 12);
    expect(buildTrack(config).lift).toEqual(DEFAULT_LIFT);
  });

  test("una subida con valores fuera de rango se rechaza", () => {
    const base = resolveConfig({ mapId: "loop" });
    const steep = { type: "start", lift: { ...DEFAULT_LIFT, angle: (80 * Math.PI) / 180 } };

    expect(() => resolveConfig({ ...base, track: [steep, ...base.track.slice(1)] })).toThrow(/ángulo/);
  });
});
