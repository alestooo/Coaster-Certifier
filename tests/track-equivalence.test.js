import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { equivalenceCases, normalize } from "./fixtures/track-equivalence-cases.mjs";

/** Referencia capturada con el modelo viejo (antes de los elementos). */
const REFERENCE = JSON.parse(readFileSync(new URL("./fixtures/track-equivalence.json", import.meta.url), "utf8"));

/** Compara números con 1e-9 y el resto exacto, recorriendo objetos y listas. */
function expectSame(actual, expected, path) {
  if (typeof expected === "number") {
    expect(actual, path).toBeCloseTo(expected, 9);
  } else if (Array.isArray(expected)) {
    expect(actual, path).toHaveLength(expected.length);
    expected.forEach((item, index) => expectSame(actual[index], item, `${path}[${index}]`));
  } else if (expected && typeof expected === "object") {
    expect(Object.keys(actual).sort(), path).toEqual(Object.keys(expected).sort());
    for (const key of Object.keys(expected)) expectSame(actual[key], expected[key], `${path}.${key}`);
  } else {
    expect(actual, path).toBe(expected);
  }
}

describe("Equivalencia del modelo por elementos", () => {
  test("hay referencia para cada caso", () => {
    expect(Object.keys(REFERENCE).sort()).toEqual(equivalenceCases().map(item => item.name).sort());
  });

  test.each(equivalenceCases().map(item => [item.name, item.config]))(
    "el trazado y el dictamen de cada caso coinciden con la referencia (1e-9): %s",
    (name, config) => {
      expectSame(normalize(config), REFERENCE[name], name);
    },
    30_000
  );
});

import { buildTrack, resolveConfig } from "../src/physics/index.js";

describe("config.track como fuente única de la geometría", () => {
  test("resolveConfig deriva track de una configuración vieja y trackWidth de end.x", () => {
    const config = resolveConfig({ mapId: "reference", trackWidth: 320 });

    expect(config.track[0]).toEqual({ type: "start" });
    expect(config.track.at(-1)).toEqual({ type: "end", x: 320 });

    const explicit = resolveConfig({ track: [{ type: "start" }, { type: "point", x: 40, y: 0 }, { type: "end", x: 210 }] });
    expect(explicit.trackWidth).toBe(210);
  });

  test.each(equivalenceCases().map(item => [item.name, item.config]))(
    "una configuración con track explícito construye la misma pista que su forma vieja: %s",
    (name, config) => {
      const track = resolveConfig(config).track;
      expectSame(normalize({ ...config, track }), REFERENCE[name], name);
    },
    30_000
  );

  test("con track, cambiar loopHeight o customPoints no cambia la geometría", () => {
    const base = resolveConfig({ mapId: "reference" });
    const track = base.track;

    const a = buildTrack({ ...base, track });
    const b = buildTrack({ ...base, track, loopHeight: 30, customPoints: [{ x: 0, y: 1, loopHeight: 0, loopTopRadius: 0 }, { x: 0.5, y: 0, loopHeight: 0, loopTopRadius: 0 }, { x: 1, y: 0, loopHeight: 0, loopTopRadius: 0 }] });

    expect(b.nodes).toEqual(a.nodes);
    expect(b.totalLength).toBe(a.totalLength);
  });
});
