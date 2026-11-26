import { describe, test, expect } from "vitest";
import { buildTrack, resolveConfig } from "../src/physics/index.js";
import { createCamera, fitBounds, frameView, frameViewAbove, worldBounds } from "../src/ui/renderer/camera.js";
import { liftPath } from "../src/ui/renderer/lift.js";

const WIDTH = 1200;
const HEIGHT = 600;

function sceneFor(camera, input = { mapId: "reference" }) {
  const config = resolveConfig(input);
  const track = buildTrack(config);
  const state = { position: { x: 0, y: config.initialHeight } };
  return { config, track, state, camera };
}

describe("Cámara del taller", () => {
  test.each([
    ["encuadre ajustado", { mode: "fit", zoom: 1 }],
    ["zoom 3 con centro", { mode: "fit", zoom: 3, centerX: 40, centerY: 8 }],
    ["seguimiento", { mode: "follow", zoom: 1.6 }]
  ])("la proyección inversa recupera los metros (%s)", (_, view) => {
    // Arrange
    const camera = createCamera(WIDTH, HEIGHT, sceneFor(view));

    // Act / Assert
    for (const [x, y] of [[0, 0], [37.5, 12.25], [-8, 3], [140, 21]]) {
      expect(camera.fromX(camera.toX(x))).toBeCloseTo(x, 6);
      expect(camera.fromY(camera.toY(y))).toBeCloseTo(y, 6);
    }
  });

  test("el encuadre ajustado deja A y F dentro del lienzo y usa más escala que el mundo completo", () => {
    // Arrange
    const scene = sceneFor({ mode: "fit", zoom: 1 });
    const world = worldBounds(scene.track, liftPath(scene.track));
    const previousScale = Math.min((WIDTH - 56) / (world.maxX - world.minX), (HEIGHT - 112) / world.maxY);

    // Act
    const camera = createCamera(WIDTH, HEIGHT, scene);

    // Assert
    expect(camera.toX(0)).toBeGreaterThanOrEqual(0);
    expect(camera.toX(scene.track.endX)).toBeLessThanOrEqual(WIDTH);
    expect(camera.toY(scene.config.initialHeight)).toBeGreaterThanOrEqual(0);
    expect(camera.scale).toBeGreaterThan(previousScale);
  });

  test("zoom 2 duplica la escala y conserva el centro pedido en el centro del lienzo", () => {
    // Arrange
    const fit = createCamera(WIDTH, HEIGHT, sceneFor({ mode: "fit", zoom: 1 }));

    // Act
    const camera = createCamera(WIDTH, HEIGHT, sceneFor({ mode: "fit", zoom: 2, centerX: 50, centerY: 10 }));

    // Assert
    expect(camera.toX(50)).toBeCloseTo(WIDTH / 2, 6);
    expect(camera.toY(10)).toBeCloseTo(HEIGHT / 2, 6);
    expect(camera.scale).toBeCloseTo(2 * fit.fitScale, 6);
  });

  test("el zoom se limita a [1, 8] veces el encuadre", () => {
    // Arrange / Act
    const tooClose = createCamera(WIDTH, HEIGHT, sceneFor({ mode: "fit", zoom: 20, centerX: 0, centerY: 0 }));
    const tooFar = createCamera(WIDTH, HEIGHT, sceneFor({ mode: "fit", zoom: 0.2 }));

    // Assert
    expect(tooClose.scale).toBeCloseTo(8 * tooClose.fitScale, 6);
    expect(tooFar.scale).toBeCloseTo(tooFar.fitScale, 6);
  });

  test("frameView encuadra un rectángulo: sus esquinas quedan dentro del lienzo", () => {
    // Arrange
    const { track } = sceneFor({ mode: "fit", zoom: 1 });
    const [loop] = track.loops;
    const bounds = { minX: loop.x - 12, maxX: loop.exitX + 12, minY: 0, maxY: loop.height + 3 };

    // Act
    const view = frameView(WIDTH, HEIGHT, track, bounds);
    const camera = createCamera(WIDTH, HEIGHT, sceneFor(view));

    // Assert
    expect(view.mode).toBe("fit");
    expect(view.zoom).toBeGreaterThan(1);
    for (const [x, y] of [[bounds.minX, bounds.minY], [bounds.maxX, bounds.maxY]]) {
      expect(camera.toX(x)).toBeGreaterThanOrEqual(-1e-6);
      expect(camera.toX(x)).toBeLessThanOrEqual(WIDTH + 1e-6);
      expect(camera.toY(y)).toBeGreaterThanOrEqual(-1e-6);
      expect(camera.toY(y)).toBeLessThanOrEqual(HEIGHT + 1e-6);
    }
  });

  test("fitBounds va del pie de la rampa a F sin el relleno del mundo", () => {
    // Arrange
    const { track } = sceneFor({ mode: "fit", zoom: 1 });
    const world = worldBounds(track, liftPath(track));

    // Act
    const bounds = fitBounds(track, liftPath(track));

    // Assert
    expect(bounds.maxX).toBeLessThan(world.maxX);
    expect(bounds.maxX).toBeGreaterThan(track.endX);
    expect(bounds.minX).toBeLessThan(liftPath(track).foot.x);
    expect(bounds.minX).toBeGreaterThan(world.minX);
    expect(bounds.maxY).toBeGreaterThan(track.maxHeight);
  });

  test("una escala fija ignora el encuadre: la cámara queda congelada aunque el trazado crezca", () => {
    // Arrange
    const view = { mode: "fit", zoom: 1, centerX: 60, centerY: 10, scale: 5 };

    // Act
    const short = createCamera(WIDTH, HEIGHT, sceneFor(view, { mapId: "reference", brakingLength: 20 }));
    const long = createCamera(WIDTH, HEIGHT, sceneFor(view, { mapId: "reference", brakingLength: 150 }));

    // Assert
    expect(short.scale).toBe(5);
    expect(long.scale).toBe(5);
    expect(long.toX(60)).toBeCloseTo(short.toX(60), 9);
    expect(long.toY(10)).toBeCloseTo(short.toY(10), 9);
  });

  test("sin centro pedido, el trazado queda centrado verticalmente entre los márgenes", () => {
    // Arrange: lienzo alto, donde el ancho limita la escala y sobra altura.
    const scene = sceneFor({ mode: "fit", zoom: 1 });
    const bounds = fitBounds(scene.track, liftPath(scene.track));

    // Act
    const camera = createCamera(WIDTH, 900, scene);
    const spaceAbove = camera.toY(bounds.maxY) - 54;
    const spaceBelow = 900 - 58 - camera.toY(bounds.minY);

    // Assert
    expect(spaceAbove).toBeGreaterThan(50);
    expect(spaceAbove).toBeCloseTo(spaceBelow, 6);
  });
});

describe("Encuadre con la hoja del teléfono", () => {
  test("con una hoja que tapa la parte de abajo, lo encuadrado queda entero por encima de la hoja", () => {
    // Arrange: lienzo de teléfono; la hoja tapa los 300 px de abajo.
    const [width, height, sheet] = [390, 640, 300];
    const { track } = sceneFor({ mode: "fit", zoom: 1 });
    const [loop] = track.loops;
    const bounds = { minX: loop.x - 12, maxX: loop.exitX + 12, minY: 0, maxY: loop.height + 3 };

    // Act
    const view = frameViewAbove(width, height, sheet, track, bounds);
    const camera = createCamera(width, height, sceneFor(view));

    // Assert
    for (const [x, y] of [[bounds.minX, bounds.minY], [bounds.maxX, bounds.maxY]]) {
      expect(camera.toX(x)).toBeGreaterThanOrEqual(-1e-6);
      expect(camera.toX(x)).toBeLessThanOrEqual(width + 1e-6);
      expect(camera.toY(y)).toBeGreaterThanOrEqual(-1e-6);
      expect(camera.toY(y)).toBeLessThanOrEqual(height - sheet + 1e-6);
    }
  });

  test("sin hoja es el mismo encuadre de siempre", () => {
    const { track } = sceneFor({ mode: "fit", zoom: 1 });
    const bounds = { minX: 10, maxX: 60, minY: 0, maxY: 15 };

    expect(frameViewAbove(WIDTH, HEIGHT, 0, track, bounds)).toEqual(frameView(WIDTH, HEIGHT, track, bounds));
  });
});
