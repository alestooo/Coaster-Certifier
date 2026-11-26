import { describe, test, expect } from "vitest";
import { trailUntil } from "../src/ui/renderer/trail.js";

const history = Array.from({ length: 40 }, (_, index) => ({ time: index * 0.1, distance: index, speed: index / 4, position: { x: index, y: 0 } }));

describe("Estela del tren", () => {
  test("la estela no pasa del instante elegido", () => {
    expect(trailUntil(history, 10)).toHaveLength(11);
    expect(trailUntil(history, 10).at(-1)).toBe(history[10]);
  });

  test("sin instante elegido, la estela usa todo el historial", () => {
    expect(trailUntil(history, null)).toBe(history);
  });

  test("un índice fuera de rango se recorta al historial", () => {
    expect(trailUntil(history, 500)).toHaveLength(40);
    expect(trailUntil(history, -3)).toHaveLength(1);
  });
});
