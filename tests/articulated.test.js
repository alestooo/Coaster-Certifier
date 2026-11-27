import { describe, test, expect } from "vitest";
import { runSimulation, resolveConfig, buildTrack, calculateForces, DEFAULT_CONFIG } from "../src/physics/index.js";
import { energyRows } from "../src/lib/report-text.ts";
import { loadProfile } from "../src/lib/load-profile.ts";
import { estimateRide, findScenario } from "../src/physics/index.js";
import { mapTemplate } from "../src/game/maps.ts";

/** Trazado del anexo con N carros (masa total 600 kg). */
const annex = (cars, extra = {}) => resolveConfig({ mapId: "reference", mass: 600, trainCars: cars, ...extra });

describe("Tren articulado", () => {
  test("con un carro, la corrida es idéntica a la partícula", () => {
    const particle = runSimulation({ mapId: "reference", mass: 600 });
    const single = runSimulation(annex(1));

    expect(single.history.length).toBe(particle.history.length);
    expect(single.final).toEqual(particle.final);
    expect(single.verdict.summary.maxLoad.value).toBe(particle.verdict.summary.maxLoad.value);
  });

  test("con dos carros la diferencia de fuerza g máxima es chica", () => {
    const particle = runSimulation(annex(1)).verdict.summary.maxLoad.value;
    const two = runSimulation(annex(2)).verdict.summary.maxLoad.value;

    expect(Math.abs(two - particle) / particle).toBeLessThan(0.05);
  });

  test("con seis carros la fuerza g cambia a lo largo del tren: el delantero es el más cargado en la base del loop", () => {
    const run = runSimulation(annex(6, { initialSpeed: 2 }));
    const peak = index => Math.max(...run.history.map(state => state.cars[index].load));

    expect(run.final.status).toBe("finished");
    expect(peak(0)).toBeGreaterThan(peak(5) + 0.1);
    expect(run.verdict.summary.maxLoad.value).toBeCloseTo(peak(0), 9);
  });

  test("el centro de masa de un tren largo sale por debajo de A: llega con menos energía que la partícula", () => {
    // Con el delantero en A, los de atrás todavía van por la rampa de la subida.
    const particle = runSimulation(annex(1, { initialSpeed: 2 }));
    const six = runSimulation(annex(6, { initialSpeed: 2 }));

    expect(six.history[0].energies.initial).toBeLessThan(particle.history[0].energies.initial);
    expect(six.verdict.summary.maxLoad.value).toBeLessThan(particle.verdict.summary.maxLoad.value);
  });

  test("al arrancar, los carros en la subida no tiran el tren hacia atrás: la cadena lo sostiene a v_c", () => {
    const config = annex(6, { initialSpeed: 2 });
    const { history, verdict } = runSimulation(config);

    const onChain = history.filter(state => state.distance < 5 * config.carSpacing);
    expect(onChain.length).toBeGreaterThan(5);
    for (const state of onChain) expect(state.velocity).toBeGreaterThanOrEqual(2 - 1e-6);
    expect(verdict.violations.every(violation => violation.code !== "reverse")).toBe(true);
    // El trabajo de la cadena entra al balance.
    for (const state of history) expect(Math.abs(state.energies.balanceError) / (state.energies.initial / 1000)).toBeLessThan(1);
  });

  test("los frenos actúan solo sobre los carros que están en la zona", () => {
    const config = annex(4);
    const track = buildTrack(config);
    const leadInside = track.brakeStart + config.carSpacing / 2;
    const allInside = track.brakeStart + 4 * config.carSpacing;

    const lead = calculateForces(track, config, leadInside, 10);
    const all = calculateForces(track, config, allInside, 10);

    expect(lead.brake).toBeCloseTo(-(config.mass / 4) * config.brakeDeceleration, 6);
    expect(all.brake).toBeCloseTo(-config.mass * config.brakeDeceleration, 6);
  });

  test("la fuerza g de cada carro sale de su propia posición; los criterios miran el peor", () => {
    const config = annex(3);
    const track = buildTrack(config);
    const loop = track.loops[0];

    const forces = calculateForces(track, config, loop.start + 10, 15);

    expect(forces.cars).toHaveLength(3);
    expect(forces.load).toBe(Math.max(...forces.cars.map(car => car.load)));
    expect(forces.minLoad).toBe(Math.min(...forces.cars.map(car => car.load)));
    expect(new Set(forces.cars.map(car => car.load.toFixed(6))).size).toBe(3);
  });

  test("sin subida, los carros detrás de A esperan en el andén horizontal", () => {
    const config = resolveConfig({ ...DEFAULT_CONFIG, mass: 600, trainCars: 3, initialHeight: 20, initialSpeed: 0, track: [{ type: "start" }, { type: "point", x: 60, y: 0 }, { type: "end", x: 200 }] });
    const track = buildTrack(config);

    const forces = calculateForces(track, config, 0, 0);

    expect(forces.cars[1].y).toBeCloseTo(20, 9);
    expect(forces.cars[2].angle).toBeCloseTo(0, 9);
  });

  test("el trabajo de la cadena va aparte: no se cuenta como energía de lanzadores", () => {
    const config = resolveConfig({ ...mapTemplate("reference"), mass: 1071, trainCars: 2 });
    const run = runSimulation(config);
    const summary = run.verdict.summary;

    const rows = energyRows(summary, config.trainCars);

    expect(summary.inputEnergy).toBe(0);
    expect(summary.chainEnergy).toBeGreaterThan(0);
    expect(rows.map(row => row.label)).not.toContain("Energía de entrada (lanzadores)");
    expect(rows.map(row => row.label)).toContain("Trabajo de la cadena (carros en la subida)");
    expect(rows[0].detail).toMatch(/centro de masa/);
    const last = run.history.at(-1).energies;
    // Balance con la cadena incluida: < 0,01 J por kJ.
    expect(Math.abs(last.mechanical + last.dissipated - last.initial - last.input - last.chainWork) / (last.initial / 1000)).toBeLessThan(1e-2);
    expect(last.balanceError).toBeCloseTo(last.mechanical + last.dissipated - last.initial - last.input - last.chainWork, 6);
  });

  test("con varios carros los valores no se contradicen: tramos, normal y fuerza g del mismo carro", () => {
    const config = resolveConfig({ ...findScenario("airtime").config, contactModel: "safety-wheels", trainCars: 3 });
    const run = runSimulation(config);
    const summary = run.verdict.summary;

    // La fuerza g mínima por tramo sale del carro más liviano, como la global.
    expect(Math.min(...summary.sections.filter(section => section.reached).map(section => section.minLoad))).toBeCloseTo(summary.minLoad.value, 9);
    // La normal informada es la del carro más cargado, para todo el tren: N = n·m·g.
    for (const state of run.history.slice(0, 200)) expect(state.forces.normal).toBeCloseTo(state.load * config.mass * config.gravity, 6);
  });

  test("con varios carros, la franja pinta la fuerza g de cada carro en su propia posición", () => {
    const track = buildTrack({ mapId: "reference" });
    const at = (distance, lead, rear) => ({ distance, load: lead, cars: [{ distance, load: lead }, { distance: distance - 3.25, load: rear }] });

    const bins = loadProfile([at(10, 2, 1), at(10.2, 2, 1)], track, 0.5);

    expect(bins.find(bin => bin.from <= 10 && bin.to > 10).max).toBe(2);
    expect(bins.find(bin => bin.from <= 6.8 && bin.to > 6.8).max).toBe(1);
  });

  test("la flotación cuenta cuando flota cualquier carro", () => {
    const state = (time, load, minCarLoad) => ({ time, load, minCarLoad, distance: time, speed: 10, velocity: 10, forces: { brake: 0, damper: 0 }, energies: { dissipated: 0 } });
    const history = [state(0, 1, 1), state(1, 0.5, 0.1), state(2, 1, 1), state(3, 1, 1)];
    const run = { history, final: { ...history.at(-1), status: "running" }, track: buildTrack({ mapId: "reference" }), verdict: { summary: { maxSpeed: { value: 10 }, maxLoad: { value: 1 }, minLoad: { value: 0.1 }, inputEnergy: 0 } } };

    expect(estimateRide(resolveConfig({ mapId: "reference" }), run).motion.floatSeconds).toBeCloseTo(1, 9);
  });

  test("la cadena no sostiene a un tren que retrocede: su trabajo nunca baja", () => {
    // Colina más alta que A: el tren vuelve y los carros de atrás retroceden hacia la subida.
    const config = resolveConfig({
      ...DEFAULT_CONFIG,
      mass: 600,
      trainCars: 3,
      friction: 0,
      minSpeed: 0,
      maxTime: 60,
      initialHeight: 8,
      track: [{ type: "start", lift: { angle: 0.6, efficiency: 0.8, chainSpeed: 2 } }, { type: "point", x: 40, y: 0 }, { type: "hill", x: 110, height: 14, crestRadius: 30 }, { type: "end", x: 240 }]
    });

    const { history } = runSimulation(config, { timeStep: 0.02 });

    expect(history.some(state => state.velocity < 0 && state.distance < 2 * config.carSpacing)).toBe(true);
    for (let index = 1; index < history.length; index++) {
      expect(history[index].energies.chainWork).toBeGreaterThanOrEqual(history[index - 1].energies.chainWork - 1e-9);
    }
  });
});
