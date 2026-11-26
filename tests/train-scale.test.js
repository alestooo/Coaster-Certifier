import { describe, test, expect } from "vitest";
import { buildTrack, resolveConfig } from "../src/physics/index.js";
import { findScenario } from "../src/physics/scenarios.js";
import { createCamera } from "../src/ui/renderer/camera.js";
import { cartPlacements, DESIGN_PX_PER_METRE } from "../src/ui/renderer/train.js";
import { HEAD, TORSO } from "../src/ui/renderer/passenger-geometry.js";

/** Distancia entre centros de carros consecutivos: largo + unión (m). */
const CAR_PITCH_M = 3.25;

const config = resolveConfig(findScenario("certification").config);
const track = buildTrack(config);
/** Tren sobre la recta final (vía recta: la cuerda entre carros es exacta). */
const state = { distance: track.brakeStart - 1, position: { x: 0, y: 0 }, time: 0 };

describe("Tren a escala real", () => {
  test.each([
    ["encuadre", 1440, 900, { mode: "fit", zoom: 1 }],
    ["zoom 8×", 1440, 900, { mode: "fit", zoom: 8 }],
    ["teléfono", 390, 520, { mode: "fit", zoom: 1 }]
  ])("el tren se dibuja a escala real en toda vista (%s)", (_, width, height, view) => {
    const camera = createCamera(width, height, { track, state, camera: view });
    const carts = cartPlacements(camera, track, state, 4);

    for (let index = 1; index < carts.length; index++) {
      const gap = Math.hypot(carts[index].x - carts[index - 1].x, carts[index].y - carts[index - 1].y);
      expect(gap).toBeCloseTo(CAR_PITCH_M * camera.scale, 0);
      expect(Math.abs(gap - CAR_PITCH_M * camera.scale)).toBeLessThan(0.5);
    }
    expect(camera).not.toHaveProperty("trainScale");
  });

  test("el pasajero tiene proporciones humanas", () => {
    const headDiameter = (2 * HEAD.radius) / DESIGN_PX_PER_METRE;
    const crown = HEAD.y - HEAD.radius;
    const seatedHeight = (TORSO.bottom - crown) / DESIGN_PX_PER_METRE;

    expect(headDiameter).toBeGreaterThanOrEqual(0.2);
    expect(headDiameter).toBeLessThanOrEqual(0.26);
    expect(seatedHeight).toBeGreaterThanOrEqual(0.8);
    expect(seatedHeight).toBeLessThanOrEqual(1);
    expect(-crown / DESIGN_PX_PER_METRE).toBeLessThanOrEqual(1.4);
  });
});
