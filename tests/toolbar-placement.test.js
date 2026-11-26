import { describe, test, expect } from "vitest";
import { toolbarPlacement } from "../src/lib/toolbar-placement.ts";

const canvas = { width: 800, height: 500 };
const size = { width: 300, height: 40 };

describe("Dónde va la mini barra del punto", () => {
  test("arriba de lo más alto (la cima del loop) cuando entra", () => {
    const at = toolbarPlacement({ x: 400, pointY: 300, topY: 200 }, size, canvas);

    expect(at).toEqual({ x: 400, y: 200, below: false });
  });

  test("debajo del punto si arriba de la cima no entra y abajo sí", () => {
    const at = toolbarPlacement({ x: 400, pointY: 300, topY: 30 }, size, canvas);

    expect(at).toEqual({ x: 400, y: 300, below: true });
  });

  test("si no entra ni arriba de la cima ni debajo del punto, va arriba del punto sin salir del lienzo", () => {
    // Loop alto con zoom: la cima cerca del borde de arriba y la base cerca del de abajo.
    const at = toolbarPlacement({ x: 790, pointY: 480, topY: 20 }, size, canvas);

    expect(at.below).toBe(false);
    expect(at.y).toBe(480);
    expect(at.x).toBe(800 - 150 - 8);
  });
});
