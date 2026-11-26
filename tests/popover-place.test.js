import { describe, test, expect } from "vitest";
import { placeBelow, LIST_MAX_HEIGHT_PX } from "../src/lib/ui/popover-place";

const rect = (top, height = 32, left = 100, width = 160) => ({ top, bottom: top + height, left, width });

describe("Ubicación de las listas desplegables", () => {
  test("abre hacia abajo cuando hay lugar, alineada al disparador", () => {
    expect(placeBelow(rect(100), 900)).toEqual({ top: 136, left: 100, minWidth: 160, flip: false });
  });

  test("abre hacia arriba cerca del borde inferior si arriba entra", () => {
    const place = placeBelow(rect(800), 900);
    expect(place.flip).toBe(true);
    expect(place.top).toBe(796);
  });

  test("sin lugar arriba tampoco, abre hacia abajo", () => {
    expect(placeBelow(rect(LIST_MAX_HEIGHT_PX - 10, 32), LIST_MAX_HEIGHT_PX + 40).flip).toBe(false);
  });
});
