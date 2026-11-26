import { describe, test, expect } from "vitest";
import { runSimulation, resolveConfig, buildTrack } from "../src/physics/index.js";
import { probeAt, probeLines } from "../src/lib/probe.ts";

const config = resolveConfig({ mapId: "reference" });
const track = buildTrack(config);
const run = runSimulation(config);

describe("Lectura al pasar el cursor por la vía", () => {
  test("la lectura en la cima del loop coincide con el resumen del punto C", () => {
    // Arrange
    const top = run.verdict.summary.criticalPoints.find(point => point.label === "C");

    // Act
    const readout = probeAt(run.history, track, top.distance);

    // Assert
    expect(readout.speed).toBeCloseTo(top.speed, 9);
    expect(readout.load).toBeCloseTo(top.load, 9);
    expect(readout.normalKn).toBeCloseTo(top.normal / 1000, 9);
    expect(readout.section).toBe("Loop 1");
  });

  test("más allá de la detención no hay lectura", () => {
    expect(probeAt(run.history, track, run.final.distance + 5)).toBeNull();
  });

  test("probeLines da formato con coma decimal y unidades", () => {
    const readout = { distance: 84.23, time: 3.14, speed: 14.2, load: 3.123, normalKn: 17.8, section: "Loop 1" };

    expect(probeLines(readout)).toEqual(["s = 84,2 m · t = 3,1 s", "v = 14,2 m/s · 3,12 g · N = 17,8 kN"]);
    expect(probeLines(null)).toEqual(["El tren no llega hasta aquí"]);
  });

  test("si la simulación se detuvo en un incumplimiento, la sonda no dice que el tren no llega", () => {
    expect(probeLines(null, { stoppedByViolation: true })).toEqual(["La simulación se detuvo en el primer incumplimiento, antes de este punto"]);
  });
});
