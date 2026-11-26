import { describe, test, expect } from "vitest";
import { buildTrack, resolveConfig, runSimulation } from "../src/physics/index.js";
import { sampleHistory, SAMPLE_INTERVAL } from "../src/lib/sampling.ts";
import { focusRanges } from "../src/lib/track-focus.ts";

describe("Submuestreo del historial", () => {
  test("conserva el primero y el último estado y espacia el resto", () => {
    // Arrange
    const run = runSimulation({ mapId: "slope" });

    // Act
    const sampled = sampleHistory(run.history);

    // Assert
    expect(sampled[0]).toBe(run.history[0]);
    expect(sampled.at(-1)).toBe(run.final);
    expect(sampled.length).toBeLessThan(run.history.length);

    for (let index = 1; index < sampled.length - 1; index++) {
      expect(sampled[index].time - sampled[index - 1].time).toBeGreaterThanOrEqual(SAMPLE_INTERVAL - 1e-9);
    }
  });

  test("no modifica historiales cortos", () => {
    const history = [{ time: 0 }, { time: 1 }];
    expect(sampleHistory(history)).toEqual(history);
  });
});

describe("Tramos resaltados por grupo del diseño", () => {
  const track = buildTrack(resolveConfig({ mapId: "reference" }));

  test("el frenado cubre de E a F", () => {
    expect(focusRanges(track, "braking")).toEqual([{ from: track.brakeStart, to: track.totalLength }]);
  });

  test("el loop cubre el tramo del loop y su salida, antes del frenado", () => {
    // Act
    const ranges = focusRanges(track, "loop");
    const loop = track.sections.find(section => section.kind === "loop");

    // Assert
    expect(ranges.length).toBeGreaterThanOrEqual(1);
    expect(ranges[0].from).toBeLessThanOrEqual(loop.start);
    expect(ranges[0].to).toBeGreaterThanOrEqual(loop.end);
    expect(ranges.every(range => range.to <= track.brakeStart)).toBe(true);
  });

  test("la colina se une en un solo rango contiguo", () => {
    expect(focusRanges(track, "hill")).toHaveLength(1);
  });

  test("las reglas y la precisión no resaltan tramos", () => {
    expect(focusRanges(track, "criteria")).toEqual([]);
    expect(focusRanges(track, null)).toEqual([]);
  });
});
