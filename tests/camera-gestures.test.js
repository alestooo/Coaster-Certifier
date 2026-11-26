import { describe, test, expect } from "vitest";
import { wheelZoomFactor, zoomAround, pinchPose, LINE_HEIGHT_PX } from "../src/lib/camera-gestures.ts";

const VIEWPORT = { width: 1000, height: 500, fitScale: 4 };

/** Punto del mundo bajo el píxel (px, py) para una pose. */
function worldAt(pose, px, py) {
  const scale = VIEWPORT.fitScale * pose.zoom;
  return { x: pose.centerX + (px - VIEWPORT.width / 2) / scale, y: pose.centerY - (py - VIEWPORT.height / 2) / scale };
}

describe("Gestos de cámara", () => {
  test("una muesca de rueda (100 px) acerca unos 15 % y un desplazamiento de trackpad (4 px) apenas", () => {
    expect(wheelZoomFactor(-100, 0, 800)).toBeCloseTo(1.16, 2);
    expect(wheelZoomFactor(100, 0, 800)).toBeCloseTo(1 / 1.16, 2);
    expect(wheelZoomFactor(-4, 0, 800)).toBeLessThan(1.01);
  });

  test("la rueda en líneas o páginas se normaliza a píxeles", () => {
    expect(wheelZoomFactor(-3, 1, 800)).toBeCloseTo(wheelZoomFactor(-3 * LINE_HEIGHT_PX, 0, 800), 9);
    expect(wheelZoomFactor(-1, 2, 800)).toBeCloseTo(wheelZoomFactor(-800, 0, 800), 9);
  });

  test("zoomAround conserva el punto del mundo bajo el cursor", () => {
    // Arrange
    const pose = { zoom: 2, centerX: 50, centerY: 10 };
    const before = worldAt(pose, 700, 120);

    // Act
    const next = zoomAround(pose, 1.5, 700, 120, VIEWPORT);
    const after = worldAt(next, 700, 120);

    // Assert
    expect(next.zoom).toBeCloseTo(3, 9);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  test("zoomAround limita el zoom a [1, 8]", () => {
    expect(zoomAround({ zoom: 6, centerX: 0, centerY: 0 }, 4, 500, 250, VIEWPORT).zoom).toBe(8);
    expect(zoomAround({ zoom: 1.2, centerX: 0, centerY: 0 }, 0.1, 500, 250, VIEWPORT).zoom).toBe(1);
  });

  test("el pellizco se calcula desde el inicio del gesto: el punto entre los dedos no se desliza", () => {
    // Arrange: dedos a 100 px; el punto medio inicial queda anclado a su punto del mundo.
    const start = { pose: { zoom: 1, centerX: 40, centerY: 8 }, distance: 100, x: 400, y: 200 };
    const anchor = worldAt(start.pose, start.x, start.y);

    // Act: muchos movimientos intermedios no acumulan error; solo importa el estado actual.
    let pose = start.pose;
    for (const distance of [110, 130, 160, 200]) pose = pinchPose(start, distance, 420, 210, VIEWPORT);
    const now = worldAt(pose, 420, 210);

    // Assert
    expect(pose.zoom).toBeCloseTo(2, 9);
    expect(now.x).toBeCloseTo(anchor.x, 9);
    expect(now.y).toBeCloseTo(anchor.y, 9);
  });
});
