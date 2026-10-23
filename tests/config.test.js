import { describe, it, expect } from "vitest";
import {
  resolveConfig,
  DEFAULT_CONFIG,
  CONFIG_LIMITS,
  ConfigError
} from "../src/physics/index.js";

describe("resolveConfig", () => {
  it("completa con los valores por defecto y devuelve un objeto nuevo", () => {
    const input = { initialHeight: 30 };
    const config = resolveConfig(input);

    expect(config.initialHeight).toBe(30);
    expect(config.mass).toBe(DEFAULT_CONFIG.mass);
    expect(config).not.toBe(input);
    expect(config.customPoints).not.toBe(DEFAULT_CONFIG.customPoints);
    expect(input).toEqual({ initialHeight: 30 });
  });

  it("rechaza valores fuera de rango con el campo identificado", () => {
    for (const [key, [min, max]] of Object.entries(CONFIG_LIMITS)) {
      const below = resolveSafe({ [key]: min - 1 });
      const above = resolveSafe({ [key]: max + 1 });

      expect(below).toBeInstanceOf(ConfigError);
      expect(below.field).toBe(key);
      expect(above).toBeInstanceOf(ConfigError);
    }
  });

  it("rechaza valores no numéricos", () => {
    expect(() => resolveConfig({ mass: "500" })).toThrow(ConfigError);
    expect(() => resolveConfig({ friction: Number.NaN })).toThrow(/finito/);
  });

  it("valida los enumerados", () => {
    expect(() => resolveConfig({ mapId: "mars" })).toThrow(/Recorrido/);
    expect(() => resolveConfig({ brakeMode: "magnet" })).toThrow(/frenado/);
    expect(() => resolveConfig({ contactModel: "glue" })).toThrow(/contacto/);
  });

  it("exige h_L ≥ 2R y una forma de loop acotada", () => {
    expect(() => resolveConfig({ mapId: "loop", loopHeight: 10, loopTopRadius: 6 })).toThrow(/h_L ≥ 2R/);
    expect(() => resolveConfig({ mapId: "loop", loopHeight: 40, loopTopRadius: 1 })).toThrow(/al menos/);
    expect(() => resolveConfig({ mapId: "loop", loopHeight: 20, loopTopRadius: 10 })).not.toThrow();
  });

  it("valida los puntos personalizados", () => {
    const point = (x, y, loopHeight = 0, loopTopRadius = 0) => ({ x, y, loopHeight, loopTopRadius });

    expect(() => resolveConfig({ mapId: "custom", customPoints: [point(0, 1), point(1, 0)] })).toThrow(/entre 3 y 9/);
    expect(() => resolveConfig({ mapId: "custom", customPoints: [point(0, 0.5), point(0.5, 0), point(1, 0)] })).toThrow(/fijas/);
    expect(() => resolveConfig({ mapId: "custom", customPoints: [point(0, 1), point(0.02, 0), point(1, 0)] })).toThrow(/Separá/);
    expect(() =>
      resolveConfig({
        mapId: "custom",
        customPoints: [point(0, 1), point(0.3, 0, 10, 3), point(0.5, 0, 10, 3), point(0.7, 0, 10, 3), point(0.85, 0, 10, 3), point(1, 0)]
      })
    ).toThrow(/hasta 3 loops/);
    expect(() =>
      resolveConfig({ mapId: "custom", customPoints: [point(0, 1), point(0.5, 0, 10, 8), point(1, 0)] })
    ).toThrow(/h_L ≥ 2R/);
  });

  it("exige coherencia entre límites de carga, pasos y compresión", () => {
    expect(() => resolveConfig({ minLoad: 1, maxLoad: 1 })).toThrow(/carga mínima/i);
    expect(() => resolveConfig({ timeStep: 0.001, maxSubstep: 0.01 })).toThrow(/integrador/);
    expect(() => resolveConfig({ brakeMode: "spring", maxCompression: 50, brakingLength: 20 })).toThrow(/compresión/i);
  });
});

/** @param {Record<string, unknown>} patch */
function resolveSafe(patch) {
  try {
    resolveConfig(patch);
    return null;
  } catch (error) {
    return error;
  }
}
