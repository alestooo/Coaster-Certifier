import { describe, test, expect } from "vitest";
import { nextIndex } from "../src/lib/ui/roving.ts";

describe("Navegación con teclado en listas, segmentados y pestañas", () => {
  test("nextIndex recorre con flechas, Home y End, da la vuelta y salta los deshabilitados", () => {
    expect(nextIndex(3, "ArrowRight", 4)).toBe(0);
    expect(nextIndex(0, "ArrowLeft", 4)).toBe(3);
    expect(nextIndex(1, "ArrowDown", 4)).toBe(2);
    expect(nextIndex(2, "ArrowUp", 4)).toBe(1);
    expect(nextIndex(2, "Home", 4)).toBe(0);
    expect(nextIndex(0, "End", 4)).toBe(3);
    expect(nextIndex(0, "ArrowDown", 4, [false, true, false, false])).toBe(2);
    expect(nextIndex(0, "End", 4, [false, false, false, true])).toBe(2);
    expect(nextIndex(0, "a", 4)).toBeNull();
  });

  test("sin opciones habilitadas no hay a dónde ir", () => {
    expect(nextIndex(0, "ArrowDown", 2, [true, true])).toBeNull();
    expect(nextIndex(0, "ArrowDown", 0)).toBeNull();
  });
});
