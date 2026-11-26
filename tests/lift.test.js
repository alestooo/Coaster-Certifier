import { describe, test, expect } from "vitest";
import { buildTrack, resolveConfig } from "../src/physics/index.js";
import { geometryAt } from "../src/physics/track/geometry.js";
import { findScenario } from "../src/physics/scenarios.js";
import { liftPath, pointOnLift, liftHeightAt, LIFT_RUN_PER_RISE } from "../src/ui/renderer/lift.js";
import { createCamera } from "../src/ui/renderer/camera.js";
import { cartPlacements } from "../src/ui/renderer/train.js";
import { MAPS } from "../src/game/maps.ts";

/** Pico máximo del empalme sobre A (m). */
const MAX_FILLET_RISE_M = 0.35;

const TRACKS = [
  ...MAPS.filter(map => map.available).map(map => [map.name, map.template]),
  ["Escenario del anexo", findScenario("certification").config]
].map(([name, input]) => [name, buildTrack(resolveConfig(input))]);

/** Distancia de un punto a la polilínea (m). */
function distanceToPolyline(points, point) {
  let best = Infinity;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(a.x + dx * t - point.x, a.y + dy * t - point.y));
  }
  return best;
}

describe("Subida única hasta A", () => {
  test.each(TRACKS)("la subida termina en A y A es su punto más alto (%s)", (_, track) => {
    const path = liftPath(track);
    const a = geometryAt(track, 0);
    const last = path.points.at(-1);

    expect(last.x).toBeCloseTo(a.x, 9);
    expect(last.y).toBeCloseTo(a.y, 9);
    expect(path.crest).toEqual(last);
    expect(Math.max(...path.points.map(point => point.y))).toBeLessThanOrEqual(a.y + MAX_FILLET_RISE_M);
    expect(path.points[0].y).toBe(0);
    expect(path.base).toEqual(path.points[0]);
  });

  test("la rampa conserva su pendiente: 1,35 m de avance por metro de altura", () => {
    const path = liftPath(TRACKS[0][1]);
    const [, foot, next] = path.points;

    expect((next.x - foot.x) / (next.y - foot.y)).toBeCloseTo(LIFT_RUN_PER_RISE, 6);
  });

  test("los carros detrás de A quedan sobre la subida", () => {
    const track = TRACKS[0][1];
    const path = liftPath(track);

    for (let car = 1; car < 4; car++) {
      const point = pointOnLift(path, car * 3.25);
      expect(distanceToPolyline(path.points, point), `carro ${car}`).toBeLessThan(0.05);
    }
  });

  test.each([
    ["escritorio, anexo", 1440, 900, TRACKS[0][1]],
    ["teléfono, anexo", 390, 520, TRACKS[0][1]],
    ["escritorio, H = 2 m", 1440, 900, buildTrack(resolveConfig({ mapId: "slope", initialHeight: 2, trackWidth: 60 }))],
    ["teléfono, H = 2 m", 390, 520, buildTrack(resolveConfig({ mapId: "slope", initialHeight: 2, trackWidth: 60 }))]
  ])("con el tren en A, los 4 carros dibujados quedan sobre la subida (%s)", (_, width, height, track) => {
    const state = { distance: 0, position: geometryAt(track, 0), time: 0 };
    const camera = createCamera(width, height, { track, state, camera: { mode: "fit", zoom: 1 } });
    const carts = cartPlacements(camera, track, state, 4);

    for (const [index, cart] of carts.entries()) {
      if (index === 0) continue;
      const point = { x: camera.fromX(cart.x), y: camera.fromY(cart.y) };
      expect(distanceToPolyline(camera.lift.points, point), `carro ${index + 1}`).toBeLessThan(0.05);
    }
  });

  test("antes del pie de la subida hay un tramo de embarque a nivel de la vía para todo el tren", () => {
    const path = liftPath(TRACKS[0][1]);

    expect(path.foot.y).toBe(0);
    expect(path.foot.x - path.base.x).toBeGreaterThanOrEqual(13);
    expect(path.points[1]).toEqual(path.foot);
  });

  test("pointOnLift parte de A con la dirección de la subida y sigue por el suelo más allá de la base", () => {
    const path = liftPath(TRACKS[0][1]);
    const atA = pointOnLift(path, 0);
    const length = path.points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - path.points[index].x, point.y - path.points[index].y), 0);
    const beyond = pointOnLift(path, length + 5);

    expect(atA.x).toBeCloseTo(path.crest.x, 9);
    expect(atA.y).toBeCloseTo(path.crest.y, 9);
    expect(beyond).toMatchObject({ y: 0, angle: 0 });
    expect(beyond.x).toBeCloseTo(path.base.x - 5, 6);
  });

  test("liftHeightAt sigue a la subida y es 0 fuera de ella", () => {
    const path = liftPath(TRACKS[0][1]);
    const middle = (path.base.x + path.crest.x) / 2;

    expect(liftHeightAt(path, path.base.x - 1)).toBe(0);
    expect(liftHeightAt(path, path.crest.x)).toBeCloseTo(path.crest.y, 6);
    expect(liftHeightAt(path, middle)).toBeGreaterThan(0);
    expect(liftHeightAt(path, middle)).toBeLessThan(path.crest.y + MAX_FILLET_RISE_M);
  });
});
