import { describe, test, expect } from "vitest";
import { runSimulation, recommendationSearch, resolveConfig, checkDesignConditions, DEFAULT_CONFIG, DEFAULT_LIFT, CRITERIA } from "../src/physics/index.js";
import { buildAudit } from "../src/lib/audit.ts";
import { elementRows, liftText, energyRows } from "../src/lib/report-text.ts";

/** Búsquedas que simulan muchos recorridos completos. */
const SEARCH_TIMEOUT_MS = 60_000;

const start = { type: "start", lift: DEFAULT_LIFT };
const point = (x, y, loop) => (loop ? { type: "point", x, y, loop } : { type: "point", x, y });
const end = x => ({ type: "end", x });

/** Corre la búsqueda de correcciones hasta el final. */
function searchAll(input) {
  const search = recommendationSearch(input);
  let result = search.next();
  while (!result.done) result = search.next();
  return result.value;
}

/** Cambios de todas las correcciones propuestas. */
const allChanges = recommendations => recommendations.flatMap(option => option.changes);

describe("Correcciones en lanzadores y frenos de ajuste", () => {
  test("un lanzador demasiado fuerte se explica y su corrección baja la aceleración del lanzador 1", () => {
    // Arrange: hasta 3 g de empuje con la regla de 1,5 g (a 14 m/s, P/(m·v) ≈ 2,1 g).
    // La zona de frenado alcanza para la salida del lanzador: el único problema es el empuje.
    const input = {
      ...DEFAULT_CONFIG,
      initialHeight: 10,
      brakingLength: 150,
      brakeDeceleration: 6,
      track: [start, point(40, 0), { type: "booster", x: 50, y: 0, length: 40, power: 150_000, maxAcceleration: 3 * 9.81 }, point(160, 0), end(200)]
    };
    const run = runSimulation(input);

    // Act
    const audit = buildAudit(run.verdict, resolveConfig(input));
    const { recommendations } = searchAll(input);

    // Assert
    expect(run.verdict.violations[0].code).toBe(CRITERIA.LAUNCH);
    expect(audit.issues[0].title).toMatch(/lanzamiento/i);
    expect(audit.issues[0].detail).toMatch(/Lanzador 1/);
    const accelerations = allChanges(recommendations).filter(change => change.key === "boosterAcceleration");
    expect(accelerations.length).toBeGreaterThan(0);
    for (const change of accelerations) {
      expect(change.element).toBe(2);
      expect(change.after).toBeLessThan(change.before);
    }
    for (const option of recommendations) expect(runSimulation(option.config).verdict.approved).toBe(true);
  }, SEARCH_TIMEOUT_MS);

  test("unos frenos de ajuste demasiado fuertes proponen bajar su c", () => {
    const input = {
      ...DEFAULT_CONFIG,
      initialHeight: 20,
      track: [start, point(60, 0), { type: "trim", x: 70, y: 0, length: 30, damping: 2000 }, point(160, 0), end(200)]
    };
    const run = runSimulation(input);

    const audit = buildAudit(run.verdict, resolveConfig(input));
    const { recommendations } = searchAll(input);

    expect(run.verdict.violations[0].code).toBe(CRITERIA.TRIM);
    expect(audit.issues[0].title).toMatch(/frenos de ajuste/i);
    const dampings = allChanges(recommendations).filter(change => change.key === "trimDamping");
    expect(dampings.length).toBeGreaterThan(0);
    for (const change of dampings) expect(change.after).toBeLessThan(change.before);
    for (const option of recommendations) expect(runSimulation(option.config).verdict.approved).toBe(true);
  }, SEARCH_TIMEOUT_MS);

  test("un loop sin energía con un lanzador antes propone subir su potencia", () => {
    // Arrange: A a 12 m y un loop de 20 m: el lanzador de 10 kW no alcanza.
    const input = {
      ...DEFAULT_CONFIG,
      initialHeight: 12,
      track: [start, point(40, 0), { type: "booster", x: 50, y: 0, length: 40, power: 10_000, maxAcceleration: 8 }, point(150, 0, { height: 20, topRadius: 5 }), end(300)]
    };
    expect(runSimulation(input).verdict.approved).toBe(false);

    const { recommendations } = searchAll(input);

    const powers = allChanges(recommendations).filter(change => change.key === "boosterPower");
    expect(powers.length).toBeGreaterThan(0);
    for (const change of powers) expect(change.after).toBeGreaterThan(change.before);
  }, SEARCH_TIMEOUT_MS);

  test("el informe lista el lanzador y la subida con su potencia", () => {
    const config = resolveConfig({
      ...DEFAULT_CONFIG,
      initialHeight: 20,
      mass: 600,
      track: [start, point(60, 0), { type: "booster", x: 70, y: 0, length: 30, power: 300_000, maxAcceleration: 12 }, end(200)]
    });

    const rows = elementRows(config);

    expect(rows.find(row => row.type === "Lanzador")?.detail).toMatch(/300 kW/);
    expect(liftText(config)).toMatch(/kW/);
    expect(liftText(resolveConfig({ ...config, track: [{ type: "start" }, ...config.track.slice(1)] }))).toMatch(/sin subida/i);
  });

  test("con un lanzador, el informe y «Salida» cuentan su trabajo: los porcentajes van sobre E₀ + W_entrada", () => {
    // Montaña rusa lanzada desde la estación: casi toda la energía viene del lanzador.
    const input = {
      ...DEFAULT_CONFIG,
      initialHeight: 1,
      initialSpeed: 0,
      brakingLength: 120,
      track: [{ type: "start" }, { type: "booster", x: 0, y: 1, length: 40, power: 300_000, maxAcceleration: 6 }, point(140, 1), end(180)]
    };
    const config = resolveConfig(input);
    const run = runSimulation(config);

    const rows = energyRows(run.verdict.summary);
    const audit = buildAudit(run.verdict, config);

    expect(run.verdict.summary.inputEnergy).toBeGreaterThan(0);
    expect(rows.map(row => row.label)).toContain("Energía de entrada (lanzadores)");
    const dissipated = rows.find(row => row.label === "Energía disipada");
    const percent = Number(dissipated.detail.match(/([\d,]+) %/)[1].replace(",", "."));
    // Al final, detenido en E a nivel del suelo, se disipó toda la energía disponible: 100 %, no miles.
    expect(percent).toBeGreaterThan(90);
    expect(percent).toBeLessThanOrEqual(100.1);
    expect(audit.areas.start.text).toMatch(/lanzador/i);
    expect(audit.areas.start.text).not.toMatch(/\d{3,} %/);
  });

  test("las fórmulas de las condiciones de diseño nombran el trabajo del lanzador cuando cuenta", () => {
    const track = [start, point(30, 0), { type: "booster", x: 40, y: 0, length: 60, power: 150_000, maxAcceleration: 12 }, point(170, 0, { height: 20, topRadius: 5 }), end(320)];

    const checks = checkDesignConditions({ ...DEFAULT_CONFIG, initialHeight: 10, track });

    expect(checks.find(check => check.id.startsWith("loop"))?.formula).toMatch(/W_lanz/);
    expect(checkDesignConditions({ mapId: "reference" }).every(check => !/W_lanz/.test(check.formula))).toBe(true);
  });
});
