import { describe, test, expect, vi, afterEach } from "vitest";

/** Lienzo fuera de pantalla falso: cuenta cuántos se crean. */
let created = 0;
class FakeOffscreenCanvas {
  constructor(width, height) {
    created++;
    this.width = width;
    this.height = height;
  }

  getContext() {
    return { setTransform() {} };
  }
}

function frameAt(scale, track, cacheWorld = true) {
  return {
    scene: { track, config: { brakeMode: "friction", brakingLength: 80, springConstant: 0, maxCompression: 0, brakeDeceleration: 5 } },
    camera: { scale, world: { minX: 0, maxX: 100, minY: 0, maxY: 40 }, toX: x => x, toY: y => y },
    options: { showSections: true, showMarkers: false, showScenery: true, cacheWorld }
  };
}

describe("Capa estática durante una animación de zoom", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("mientras la escala cambia cuadro a cuadro no se crea una capa por cuadro: se dibuja directo", async () => {
    // Arrange
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    const { getWorldLayer } = await import("../src/ui/renderer/layers.js");
    const track = {};
    let drawn = 0;
    const draw = () => drawn++;
    created = 0;

    // Act: un cuadro quieto (se cachea) y diez cuadros de animación con escalas distintas.
    const still = getWorldLayer(frameAt(2, track), 1, draw);
    const animated = Array.from({ length: 10 }, (_, step) => getWorldLayer(frameAt(2 + (step + 1) * 0.1, track, false), 1, draw));
    const back = getWorldLayer(frameAt(2, track, false), 1, draw);

    // Assert
    expect(still).not.toBeNull();
    expect(animated.every(layer => layer === null)).toBe(true);
    expect(back).toBe(still);
    expect(created).toBe(1);
    expect(drawn).toBe(1);
  });
});
