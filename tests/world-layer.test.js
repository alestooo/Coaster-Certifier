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

  test("mientras la escala cambia cuadro a cuadro no se crea una capa por cuadro: se reusa la última, escalada", async () => {
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

    // Assert
    expect(still).not.toBeNull();
    expect(animated.every(layer => layer === still)).toBe(true);
    expect(created).toBe(1);
    expect(drawn).toBe(1);
  });

  test("durante un gesto de rueda no se crea una capa por evento", async () => {
    // Arrange
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    const { getWorldLayer } = await import("../src/ui/renderer/layers.js");
    const track = {};
    let drawn = 0;
    const draw = () => drawn++;
    created = 0;

    // Act: un cuadro quieto, doce eventos de rueda y el cuadro al terminar el gesto.
    const still = getWorldLayer(frameAt(3, track), 1, draw);
    const wheel = Array.from({ length: 12 }, (_, step) => getWorldLayer(frameAt(3 * 1.1 ** (step + 1), track, false), 1, draw));
    const settled = getWorldLayer(frameAt(3 * 1.1 ** 12, track), 1, draw);

    // Assert: una capa al empezar y otra al terminar, nunca una por evento.
    expect(wheel.every(layer => layer === still)).toBe(true);
    expect(settled).not.toBe(still);
    expect(created).toBe(2);
    expect(drawn).toBe(2);
  });

  test("otro trazado no reusa la capa escalada de uno anterior", async () => {
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    const { getWorldLayer } = await import("../src/ui/renderer/layers.js");

    getWorldLayer(frameAt(4, {}), 1, () => {});

    expect(getWorldLayer(frameAt(4.4, {}, false), 1, () => {})).toBeNull();
  });
});
