import { describe, test, expect } from "vitest";
import { SimulationRunner, SAMPLE_INTERVAL } from "../src/lib/simulation-runner.svelte.ts";

describe("Reproducción del recorrido", () => {
  test("durante la reproducción el historial se publica a lo sumo 10 veces por segundo", () => {
    // Arrange
    const runner = new SimulationRunner({ mapId: "reference" });
    const published = new Set([runner.history]);
    runner.start();

    // Act: un segundo de cuadros a 60 Hz.
    for (let frame = 0; frame < 60; frame++) {
      runner.tick(1 / 60);
      published.add(runner.history);
    }

    // Assert
    expect(published.size).toBeLessThanOrEqual(11);
    expect(runner.state.time).toBeGreaterThan(0.9);
  });

  test("al pausar el historial incluye todo lo simulado", () => {
    // Arrange
    const runner = new SimulationRunner({ mapId: "reference" });
    runner.start();
    for (let frame = 0; frame < 20; frame++) runner.tick(1 / 60);

    // Act
    runner.pause();

    // Assert
    expect(Math.abs(runner.history.at(-1).time - runner.state.time)).toBeLessThanOrEqual(SAMPLE_INTERVAL + 1e-9);
  });
});
