import { describe, test, expect } from "vitest";
import { buildTrack, resolveConfig, geometryAt } from "../src/physics/index.js";
import { nearestTrackPoint, areaAtDistance, areaBounds } from "../src/lib/track-hit.ts";

const config = resolveConfig({ mapId: "reference" });
const track = buildTrack(config);

/** Área del punto de la vía más cercano a (x, y). */
function areaNear(x, y) {
  return areaAtDistance(track, nearestTrackPoint(track, x, y).distance);
}

describe("Prueba de impacto sobre la vía", () => {
  test("un punto en la cima del loop pertenece al loop", () => {
    const top = geometryAt(track, track.markers.find(marker => marker.role === "loop-top").distance);

    expect(areaNear(top.x, top.y + 0.3)).toBe("loop");
  });

  test("un punto sobre la recta final pertenece al frenado", () => {
    expect(areaNear(track.brakeX + config.brakingLength / 2, 0.4)).toBe("braking");
  });

  test("un punto sobre la caída inicial pertenece a la salida", () => {
    const point = geometryAt(track, 5);

    expect(areaNear(point.x, point.y)).toBe("start");
  });

  test("gap mide la distancia en metros a la vía", () => {
    // Arrange: la recta final es horizontal a y = 0.
    const x = track.brakeX + 10;

    // Act
    const hit = nearestTrackPoint(track, x, 2);

    // Assert
    expect(hit.gap).toBeCloseTo(2, 6);
    expect(hit.x).toBeCloseTo(x, 6);
    expect(hit.distance).toBeCloseTo(track.brakeStart + 10, 6);
  });

  test("areaBounds del loop contiene el loop y es null para las reglas", () => {
    // Arrange
    const [loop] = track.loops;

    // Act
    const bounds = areaBounds(track, "loop");

    // Assert
    expect(bounds.minX).toBeLessThan(loop.x);
    expect(bounds.maxX).toBeGreaterThan(loop.exitX);
    expect(bounds.maxY).toBeGreaterThan(loop.height);
    expect(areaBounds(track, "criteria")).toBeNull();
  });
});
