import { describe, test, expect } from "vitest";
import { runSimulation, findScenario, resolveConfig } from "../src/physics/index.js";
import { buildAudit, areaForSection } from "../src/lib/audit.ts";

/**
 * Simula un escenario de referencia y construye su auditoría.
 * @param {string} id
 * @param {Record<string, unknown>} [overrides]
 */
function auditScenario(id, overrides = {}) {
  const scenario = findScenario(id);
  const config = resolveConfig({ ...scenario.config, ...overrides });
  const run = runSimulation(config);
  return { audit: buildAudit(run.verdict, config), config, run };
}

describe("Tramos asignados a cada grupo del diseño", () => {
  test.each([
    ["Caída inicial", "start"],
    ["Loop 1", "loop"],
    ["Salida del loop", "loop"],
    ["Colina (subida)", "hill"],
    ["Colina (bajada)", "hill"],
    ["Aproximación", "layout"],
    ["Recta", "layout"],
    ["Zona de frenado", "braking"],
    ["Resorte de tope", "braking"]
  ])("«%s» pertenece al grupo %s", (section, area) => {
    expect(areaForSection(section)).toBe(area);
  });

  test("el rebasamiento y la compresión siempre se atribuyen al frenado", () => {
    expect(areaForSection("Recta", "overrun")).toBe("braking");
    expect(areaForSection("Recta", "compression")).toBe("braking");
  });
});

describe("Auditoría en lenguaje claro", () => {
  test("un trazado aprobado explica dónde se detiene y no reporta problemas", () => {
    // Arrange / Act
    const { audit, config } = auditScenario("certification");

    // Assert
    expect(audit.approved).toBe(true);
    expect(audit.title).toMatch(/^Aprobado/);
    expect(audit.issues).toEqual([]);
    expect(audit.braking.outcome).toBe("stopped");
    expect(audit.braking.stoppingDistance).toBeGreaterThan(0);
    expect(audit.braking.stoppingDistance).toBeLessThan(config.brakingLength);
    expect(audit.areas.braking?.tone).not.toBe("bad");
    expect(audit.maxG.limit).toBe(config.maxLoad);
  });

  test("la distancia de frenado necesaria coincide con v_E²/(2·(a_f + μ·g))", () => {
    // Arrange / Act
    const { audit, config } = auditScenario("certification");
    const deceleration = config.brakeDeceleration + config.friction * config.gravity;
    const expected = audit.braking.entrySpeed ** 2 / (2 * deceleration);

    // Assert: en la recta el movimiento es un MRUA exacto (ver pruebas analíticas).
    // Tolerancia de 5 cm: v_E del resumen se interpola entre muestras de 0,01 s.
    expect(audit.braking.requiredDistance).toBeCloseTo(expected, 9);
    expect(Math.abs(audit.braking.stoppingDistance - expected)).toBeLessThan(0.05);
  });

  test("un loop circular se rechaza por fuerza g en el grupo del loop", () => {
    // Arrange / Act
    const { audit, config } = auditScenario("circular-loop");

    // Assert
    expect(audit.approved).toBe(false);
    expect(audit.title).toMatch(/^Rechazado/);
    expect(audit.issues[0].code).toBe("max-load");
    expect(audit.issues[0].area).toBe("loop");
    expect(audit.issues[0].title).toMatch(/Fuerza g/);
    expect(audit.issues[0].detail).toContain(`${config.maxLoad}`);
    expect(audit.maxG.tone).toBe("bad");
    expect(audit.areas.loop?.tone).toBe("bad");
  });

  test("una zona de frenado corta indica cuánta distancia hacía falta", () => {
    // Arrange / Act
    const { audit, config } = auditScenario("brake-short");

    // Assert
    expect(audit.braking.outcome).toBe("overrun");
    expect(audit.braking.requiredDistance).toBeGreaterThan(config.brakingLength);
    expect(audit.areas.braking?.tone).toBe("bad");
    expect(audit.areas.braking?.text).toMatch(/necesita/);
    expect(audit.issues[0].code).toBe("overrun");
  });

  test("un tren que no supera la colina nunca llega a frenar", () => {
    // Arrange / Act
    const { audit } = auditScenario("stall");

    // Assert
    expect(audit.approved).toBe(false);
    expect(audit.braking.outcome).toBe("not-reached");
    expect(audit.braking.stoppingDistance).toBeNull();
    expect(audit.areas.braking?.text).toMatch(/no llega/i);
    expect(audit.issues.some(issue => issue.area === "hill")).toBe(true);
    expect(audit.issues[0].detail).toMatch(/le falta energía/);
  });

  test("un resorte ideal no detiene al tren y se atribuye al frenado", () => {
    // Arrange / Act
    const { audit } = auditScenario("spring-ideal");

    // Assert
    expect(audit.braking.outcome).toBe("no-stop");
    expect(audit.issues[0].code).toBe("timeout");
    expect(audit.issues[0].area).toBe("braking");
    expect(audit.areas.braking?.tone).toBe("bad");
  });

  test("un fallo después de rebotar en el resorte se atribuye al frenado, no al tramo donde ocurre", () => {
    // Arrange: trazado del anexo con resorte ideal; el tren rebota y vuelve hasta el loop.
    const config = resolveConfig({ mapId: "reference", brakeMode: "spring", springDamping: 0 });
    const run = runSimulation(config);

    // Act
    const audit = buildAudit(run.verdict, config);

    // Assert
    expect(run.verdict.violations[0].section).toMatch(/Loop/);
    expect(audit.issues[0].area).toBe("braking");
    expect(audit.issues[0].title).toMatch(/rebota/i);
    expect(audit.areas.loop?.tone).not.toBe("bad");
  });

  test("un tren que el resorte devuelve antes de E se explica como fuera de la zona de frenado", () => {
    // Arrange: el amortiguador lo detiene en la aproximación, después de rebotar.
    const config = resolveConfig({ mapId: "slope", initialHeight: 20, trackWidth: 220, friction: 0.01, brakeMode: "spring", springConstant: 6000, springDamping: 2600, maxCompression: 8, brakingLength: 80, maxTime: 120 });
    const run = runSimulation(config, { timeStep: 0.02 });

    // Act
    const audit = buildAudit(run.verdict, config);

    // Assert
    expect(audit.issues[0].code).toBe("outside-braking");
    expect(audit.issues[0].area).toBe("braking");
    expect(audit.issues[0].title).toBe("Queda fuera de la zona de frenado");
    expect(audit.issues[0].detail).toMatch(/rebot/i);
    expect(audit.braking.outcome).toBe("returned");
    expect(audit.braking.text).toMatch(/lo devuelve/);
    expect(audit.areas.braking?.text).not.toMatch(/no alcanza a detenerlo/);
  });

  test("un tren que se queda quieto antes de E no llega a la zona de frenado", () => {
    const config = resolveConfig({ mapId: "incline", initialHeight: 0.8, friction: 0.1, trackWidth: 5 });
    const run = runSimulation(config, { timeStep: 0.02 });

    const audit = buildAudit(run.verdict, config);

    expect(audit.issues[0].code).toBe("incomplete");
    expect(audit.braking.outcome).toBe("not-reached");
  });

  test("con contacto estricto el límite inferior de fuerza g es 0 g", () => {
    // Arrange / Act
    const strict = auditScenario("valley");
    const wheels = auditScenario("airtime");

    // Assert
    expect(strict.config.contactModel).toBe("strict");
    expect(strict.audit.minG.limit).toBe(0);
    expect(wheels.audit.minG.limit).toBe(wheels.config.minLoad);
  });
});
