import { describe, test, expect } from "vitest";
import { needsReframe } from "../src/lib/view-fit.ts";

/** Cámara de 1000 × 600 px que muestra x ∈ [0, 100] m e y ∈ [0, 60] m (10 px/m, y hacia arriba). */
const camera = { width: 1000, height: 600, toX: x => x * 10, toY: y => 600 - y * 10 };

describe("Encuadre al soltar una manija", () => {
  test("needsReframe es falso si todo entra y verdadero si la pista se sale por la derecha", () => {
    // Arrange
    const inside = { minX: 5, maxX: 95, minY: 1, maxY: 50 };
    const pastRight = { ...inside, maxX: 104 };

    // Act / Assert
    expect(needsReframe(inside, camera)).toBe(false);
    expect(needsReframe(pastRight, camera)).toBe(true);
  });

  test("needsReframe respeta el margen: a menos de 8 px del borde ya pide reencuadrar", () => {
    expect(needsReframe({ minX: 0.5, maxX: 50, minY: 5, maxY: 20 }, camera)).toBe(true);
    expect(needsReframe({ minX: 10, maxX: 50, minY: 5, maxY: 59.5 }, camera)).toBe(true);
    expect(needsReframe({ minX: 0.5, maxX: 50, minY: 5, maxY: 20 }, camera, 0)).toBe(false);
  });
});
