import { describe, test, expect } from "vitest";
import { resolveConfig, layoutNodes, MAP_IDS } from "../src/physics/index.js";
import { compileElements, legacyElements, validateElements, withElement, MAX_TRACK_ELEMENTS } from "../src/physics/track/elements.js";
import { MAPS } from "../src/game/maps.ts";

/** Nodo en forma comparable: posición, cresta y loop. */
const shape = node => ({
  x: node.x,
  y: node.y,
  crest: node.role === "crest",
  loopHeight: node.loopHeight || 0,
  loopTopRadius: node.loopHeight ? node.loopTopRadius : 0
});

const start = { type: "start" };
const end = x => ({ type: "end", x });

describe("Elementos del trazado", () => {
  test.each([...MAP_IDS.map(mapId => [`por defecto ${mapId}`, { mapId }]), ...MAPS.map(map => [`plantilla ${map.id}`, map.template])])(
    "cada trazado viejo compila a los mismos nodos que layoutNodes (%s)",
    (_, input) => {
      const config = resolveConfig(input);
      const nodes = compileElements(legacyElements(config), config.initialHeight);

      expect(nodes.map(shape)).toEqual(layoutNodes(config).map(shape));
    }
  );

  test("el plano inclinado es un tramo recto hasta E", () => {
    const config = resolveConfig({ mapId: "incline" });
    const nodes = compileElements(legacyElements(config), config.initialHeight);

    expect(nodes.at(-1).line).toBe(true);
    expect(nodes).toHaveLength(2);
  });

  test("un punto más alto que sus vecinos es una cresta; con loop, no", () => {
    const nodes = compileElements([start, { type: "point", x: 50, y: 0 }, { type: "point", x: 100, y: 8 }, { type: "point", x: 150, y: 0 }, end(200)], 30);
    const looped = compileElements([start, { type: "point", x: 50, y: 0 }, { type: "point", x: 100, y: 8, loop: { height: 12, topRadius: 3 } }, { type: "point", x: 160, y: 0 }, end(220)], 30);

    expect(nodes[2].role).toBe("crest");
    expect(looped[2].role).not.toBe("crest");
    expect(nodes.map(node => node.element)).toEqual([0, 1, 2, 3, 4]);
  });

  test("una colina se expande a sus tres nodos con ρ_c exacto", () => {
    const nodes = compileElements([start, { type: "point", x: 40, y: 0 }, { type: "hill", x: 120, height: 10, crestRadius: 60 }, end(220)], 25);
    const half = Math.sqrt(6 * 10 * 60);

    expect(nodes.slice(2, 5).map(node => [node.x, node.y, node.role, node.element])).toEqual([
      [120 - half, 0, "plain", 2],
      [120, 10, "crest", 2],
      [120 + half, 0, "plain", 2]
    ]);
  });

  test.each([
    ["sin start", [{ type: "point", x: 10, y: 0 }, end(100)]],
    ["sin end", [start, { type: "point", x: 10, y: 0 }]],
    ["un tipo desconocido", [start, { type: "ramp", x: 10 }, end(100)]],
    ["más de 40 elementos", [start, ...Array.from({ length: MAX_TRACK_ELEMENTS - 1 }, (_, index) => ({ type: "point", x: 5 + index * 5, y: 0 })), end(400)]],
    ["un loop con h_L < 2R", [start, { type: "point", x: 50, y: 0, loop: { height: 10, topRadius: 6 } }, end(200)]],
    ["una altura negativa", [start, { type: "point", x: 50, y: -1 }, end(200)]],
    ["un número no finito", [start, { type: "point", x: Number.NaN, y: 0 }, end(200)]]
  ])("validateElements rechaza un trazado %s, sobre el campo track", (_, elements) => {
    expect(() => validateElements(elements)).toThrow();
    try {
      validateElements(elements);
    } catch (error) {
      expect(error.field).toBe("track");
    }
  });

  test("withElement devuelve una copia y no modifica la entrada", () => {
    const track = Object.freeze([start, Object.freeze({ type: "point", x: 50, y: 0, loop: Object.freeze({ height: 12, topRadius: 3 }) }), Object.freeze(end(200))]);

    const next = withElement(track, 1, { x: 60, loop: { height: 14, topRadius: 3.5 } });

    expect(next).not.toBe(track);
    expect(next[1]).toEqual({ type: "point", x: 60, y: 0, loop: { height: 14, topRadius: 3.5 } });
    expect(track[1].x).toBe(50);
  });
});
