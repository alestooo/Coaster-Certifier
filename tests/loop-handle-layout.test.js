import { describe, test, expect } from "vitest";
import { loopHandleLayout, MIN_TOP_GAP_PX, MIN_RADIUS_OFFSET_PX } from "../src/lib/loop-handle-layout.ts";

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

describe("Manijas de un loop en pantalla", () => {
  test("un loop grande se dibuja a escala: cima y radio donde están", () => {
    const layout = loopHandleLayout({ x: 300, y: 400 }, { x: 302, y: 250 }, 40);

    expect(layout.top).toEqual({ x: 302, y: 250 });
    expect(layout.radius).toEqual({ x: 342, y: 290 });
  });

  test("un loop chico separa la cima de la base y el radio de la cima, sin que se tapen", () => {
    // Arrange: 12 m con R = 2,75 m a ≈ 1,5 px/m (teléfono).
    const base = { x: 120, y: 430 };

    // Act
    const layout = loopHandleLayout(base, { x: 121, y: 412 }, 4);

    // Assert
    expect(base.y - layout.top.y).toBeGreaterThanOrEqual(MIN_TOP_GAP_PX);
    expect(layout.radius.x - layout.top.x).toBeGreaterThanOrEqual(MIN_RADIUS_OFFSET_PX);
    expect(distance(layout.radius, layout.top)).toBeGreaterThan(18);
    expect(distance(layout.radius, base)).toBeGreaterThan(18);
  });
});
