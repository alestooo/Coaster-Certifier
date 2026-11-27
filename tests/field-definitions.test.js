import { describe, test, expect } from "vitest";
import { resolveConfig, ConfigError } from "../src/physics/index.js";
import { friendlyConfigMessage, fieldByKey, visibleFields, FIELD_GROUPS } from "../src/lib/field-definitions.ts";

describe("Mensajes de validación legibles", () => {
  test("reemplaza la clave interna por la etiqueta y agrega la unidad", () => {
    // Arrange
    let problem;
    try {
      resolveConfig({ brakingLength: 500 });
    } catch (error) {
      problem = error;
    }

    // Act
    const message = friendlyConfigMessage(problem.field, problem.message);

    // Assert
    expect(problem).toBeInstanceOf(ConfigError);
    expect(message).not.toContain("brakingLength");
    expect(message).toContain(fieldByKey("brakingLength")?.label);
    expect(message).toMatch(/entre 1 y 150 m/);
  });

  test("deja intactos los mensajes que no son de rango", () => {
    // Arrange
    const message = "El radio en la cima no puede superar la mitad de la altura del loop (h_L ≥ 2R).";

    // Act / Assert
    expect(friendlyConfigMessage("loopTopRadius", message)).toBe(message);
  });
});

describe("Pistas calculadas junto a cada control", () => {
  test("la desaceleración de los frenos se expresa en g y en m/s perdidos por segundo", () => {
    // Arrange
    const config = resolveConfig({ brakeDeceleration: 5 });
    const field = fieldByKey("brakeDeceleration");

    // Act
    const hint = field?.hint?.(config);

    // Assert
    expect(hint).toMatch(/0,51 g/);
    expect(hint).toMatch(/5,0 m\/s cada segundo/);
  });
});

describe("Campos visibles según el trazado y los sistemas elegidos", () => {
  const keysFor = input => visibleFields(resolveConfig(input)).map(field => field.key);

  test("no hay grupo de campos para W, loop ni colina: se editan por elemento", () => {
    const ids = FIELD_GROUPS.map(group => group.id);
    const keys = keysFor({ mapId: "reference" });

    expect(ids).not.toEqual(expect.arrayContaining(["layout"]));
    expect(ids).not.toContain("loop");
    expect(ids).not.toContain("hill");
    expect(keys).not.toContain("trackWidth");
    expect(keys).not.toContain("loopHeight");
    expect(keys).not.toContain("hillHeight");
  });

  test("μ está en el grupo de la salida y el loop y la colina conservan sus metadatos", () => {
    const start = FIELD_GROUPS.find(group => group.id === "start");

    expect(start?.fields.map(field => field.key)).toContain("friction");
    expect(fieldByKey("loopTopRadius")?.label).toBe("Radio en la cima");
    expect(fieldByKey("hillCrestRadius")?.symbol).toBe("ρ_c");
  });

  test("con resorte se ocultan los frenos y aparecen rigidez, amortiguador y compresión", () => {
    const keys = keysFor({ mapId: "slope", brakeMode: "spring" });

    expect(keys).not.toContain("brakeDeceleration");
    expect(keys).toEqual(expect.arrayContaining(["springConstant", "springDamping", "maxCompression"]));
  });

  test("la fuerza g mínima solo aparece con ruedas anti-levantamiento", () => {
    expect(keysFor({ contactModel: "strict" })).not.toContain("minLoad");
    expect(keysFor({ contactModel: "safety-wheels" })).toContain("minLoad");
  });
});
