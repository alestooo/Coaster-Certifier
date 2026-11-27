import { describe, test, expect } from "vitest";
import { runSimulation, resolveConfig, buildTrack, geometryAt, DEFAULT_CONFIG, CSV_COLUMNS } from "../src/physics/index.js";

const start = { type: "start" };
const point = (x, y) => ({ type: "point", x, y });
const booster = (x, y, length = 30) => ({ type: "booster", x, y, length, power: 300_000, maxAcceleration: 12 });
const trim = (x, y, length = 20, damping = 100) => ({ type: "trim", x, y, length, damping });
const end = x => ({ type: "end", x });

/** Configuración con ese trazado (H 20 m salvo que se pida otra). */
const withTrack = (track, extra = {}) => resolveConfig({ ...DEFAULT_CONFIG, initialHeight: 20, ...extra, track });

describe("Zonas del trazado", () => {
  test("un lanzador y unos frenos de ajuste compilan a un tramo recto horizontal con su nombre y su zona", () => {
    // Arrange / Act
    const config = withTrack([start, point(60, 0), booster(80, 0), trim(150, 0), end(260)]);
    const track = buildTrack(config);

    // Assert
    const names = track.sections.map(section => section.name);
    expect(names).toContain("Lanzador 1");
    expect(names).toContain("Frenos de ajuste 1");
    expect(track.zones.map(zone => [zone.kind, zone.element, zone.name])).toEqual([
      ["booster", 2, "Lanzador 1"],
      ["trim", 3, "Frenos de ajuste 1"]
    ]);

    for (const zone of track.zones) {
      const section = track.sections.find(candidate => candidate.name === zone.name);
      expect(section.kind).toBe("line");
      expect([zone.start, zone.end]).toEqual([section.start, section.end]);
      const middle = geometryAt(track, (zone.start + zone.end) / 2);
      expect(middle.angle).toBeCloseTo(0, 9);
      expect(middle.y).toBeCloseTo(0, 9);
    }

    expect(track.zones[0].end - track.zones[0].start).toBeCloseTo(30, 9);
  });

  test("las zonas se validan: largo, potencia, aceleración y c fuera de rango se rechazan", () => {
    expect(() => withTrack([start, point(60, 0), { ...booster(80, 0), length: 0.5 }, end(260)])).toThrow(/largo/i);
    expect(() => withTrack([start, point(60, 0), { ...booster(80, 0), power: 0 }, end(260)])).toThrow(/potencia/i);
    expect(() => withTrack([start, point(60, 0), { ...trim(80, 0), damping: -1 }, end(260)])).toThrow(/c/);
  });

  test("un tren que entra y vuelve a salir de una zona por el mismo borde", () => {
    // Arrange: los frenos de ajuste están en el valle; la colina siguiente es más alta que A, así que el tren vuelve
    // (sin rapidez mínima, para que no se rechace al frenarse en la subida).
    const config = withTrack([start, point(60, 0), trim(80, 0, 20, 10), { type: "hill", x: 180, height: 25, crestRadius: 40 }, end(320)], { maxTime: 60, minSpeed: 0 });
    const zone = buildTrack(config).zones[0];

    // Act
    const { history, final } = runSimulation(config, { timeStep: 0.02 });

    // Assert
    expect(final.status).not.toBe("running");
    expect(history.every(state => Number.isFinite(state.distance) && Number.isFinite(state.velocity))).toBe(true);
    expect(history.some(state => state.velocity > 0 && state.distance > zone.start && state.distance < zone.end)).toBe(true);
    expect(history.some(state => state.velocity < 0 && state.distance > zone.start && state.distance < zone.end)).toBe(true);
    expect(history.some(state => state.velocity < 0 && state.distance < zone.start)).toBe(true);
  });

  test("sin zonas, W_entrada es 0 y el balance es el de antes; E_entrada_J va al final del CSV", () => {
    const run = runSimulation({ mapId: "reference" });

    expect(run.history.every(state => state.energies.input === 0)).toBe(true);
    for (const state of run.history.slice(0, 50)) {
      const { mechanical, dissipated, initial, balanceError } = state.energies;
      expect(balanceError).toBe(mechanical + dissipated - initial);
    }
    expect(CSV_COLUMNS.findIndex(column => column.header === "E_entrada_J")).toBeGreaterThan(24);
  });
});
