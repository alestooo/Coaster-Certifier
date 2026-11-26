import { describe, test, expect } from "vitest";
import { resolveConfig, buildTrack } from "../src/physics/index.js";
import { movePoint, insertPoint, insertAfter, removePoint, setPointLoop, toggleLoop, pointHandles, proposePointHandle, templateProblem, CUSTOM_TEMPLATES } from "../src/lib/custom-points.ts";

const point = (x, y, loopHeight = 0, loopTopRadius = 0) => ({ x, y, loopHeight, loopTopRadius });
const custom = (customPoints, extra = {}) => resolveConfig({ mapId: "custom", ...(customPoints ? { customPoints } : {}), ...extra });

describe("Puntos del trazado personalizado", () => {
  test("movePoint limita x entre los vecinos y la altura entre 0 y H", () => {
    // Arrange: por defecto W = 160 m, H = 20 m; el punto 2 está entre 0,25 y 0,75 del ancho.
    const config = custom();

    // Act
    const right = movePoint(config, 2, 200, 7);
    const left = movePoint(config, 2, -50, -5);

    // Assert
    expect(right.points[2].x).toBeCloseTo(0.7, 9);
    expect(right.points[2].y).toBeCloseTo(0.35, 9);
    expect(right.limited).toBe(true);
    expect(left.points[2].x).toBeCloseTo(0.3, 9);
    expect(left.points[2].y).toBe(0);
  });

  test("los extremos no se mueven", () => {
    const config = custom();

    expect(movePoint(config, 0, 30, 5).points).toEqual(config.customPoints);
    expect(movePoint(config, 4, 30, 5).points).toEqual(config.customPoints);
  });

  test("un punto que choca con un loop se detiene en el último lugar construible y explica por qué", () => {
    // Arrange: loop de 14 m en el punto 1 (x = 40 m); el punto 2 se arrastra hacia él.
    const config = custom([point(0, 1), point(0.25, 0, 14, 3.5), point(0.5, 0.35), point(0.75, 0), point(1, 0)]);

    // Act
    const edit = movePoint(config, 2, 48, 7);

    // Assert
    expect(edit.limited).toBe(true);
    expect(edit.reason).toMatch(/loop/i);
    expect(edit.points[2].x).toBeGreaterThan(0.3);
    expect(() => buildTrack({ ...config, customPoints: edit.points })).not.toThrow();
  });

  test("insertPoint agrega el punto en orden entre sus vecinos", () => {
    // Act
    const result = insertPoint(custom(), 96, 5);

    // Assert
    expect(result.index).toBe(3);
    expect(result.points).toHaveLength(6);
    expect(result.points[3]).toMatchObject({ x: 0.6, y: 0.25, loopHeight: 0 });
  });

  test("insertPoint rechaza un décimo punto y puntos demasiado cerca", () => {
    const nine = custom(Array.from({ length: 9 }, (_, index) => point(index / 8, index === 0 ? 1 : 0)));

    expect(insertPoint(nine, 30, 2).error).toMatch(/9 puntos/);
    expect(insertPoint(custom(), 0.51 * 160, 2).error).toMatch(/cerca/);
  });

  test("removePoint no borra extremos y deja al menos tres puntos", () => {
    const config = custom();

    expect(removePoint(config, 0)).toBeNull();
    expect(removePoint(config, 4)).toBeNull();
    expect(removePoint(config, 2)).toHaveLength(4);
    expect(removePoint(custom([point(0, 1), point(0.5, 0), point(1, 0)]), 1)).toBeNull();
  });

  test("no se agrega un cuarto loop", () => {
    // Arrange: tres loops ya colocados y un sexto punto libre.
    const config = custom(
      [point(0, 1), point(0.25, 0, 24, 4), point(0.5, 0, 24, 4), point(0.75, 0, 24, 4), point(0.9, 0), point(1, 0)],
      { initialHeight: 35, trackWidth: 300 }
    );

    // Act
    const edit = setPointLoop(config, 4, 12, 3);

    // Assert
    expect(edit.reason).toMatch(/Ya hay 3 loops/);
    expect(edit.points).toEqual(config.customPoints);
  });

  test("la forma del loop se limita: R no supera h_L/2", () => {
    const edit = setPointLoop(custom(), 2, 14, 10);

    expect(edit.points[2].loopHeight).toBe(14);
    expect(edit.points[2].loopTopRadius).toBe(7);
    expect(edit.limited).toBe(true);
  });

  test("toggleLoop agrega un loop en lágrima y lo vuelve a quitar", () => {
    const config = custom();
    const added = toggleLoop(config, 2);
    const removed = toggleLoop({ ...config, customPoints: added.points }, 2);

    expect(added.points[2].loopHeight).toBe(11);
    expect(added.points[2].loopTopRadius).toBe(2.75);
    expect(removed.points[2].loopHeight).toBe(0);
  });

  test("pointHandles: una manija por punto interior y las del loop en su cima", () => {
    // Arrange
    const plain = custom();
    const looped = custom([point(0, 1), point(0.25, 0, 14, 3.5), point(0.5, 0.35), point(0.75, 0), point(1, 0)]);

    // Act
    const plainHandles = pointHandles(buildTrack(plain), plain);
    const loopHandles = pointHandles(buildTrack(looped), looped);
    const top = loopHandles.find(handle => handle.kind === "loopTop");
    const radius = loopHandles.find(handle => handle.kind === "loopRadius");

    // Assert
    expect(plainHandles.map(handle => handle.kind)).toEqual(["point", "point", "point"]);
    expect(plainHandles[1]).toMatchObject({ index: 2, x: 80, y: 7 });
    expect(top.index).toBe(1);
    expect(top.y).toBeCloseTo(14, 6);
    expect(radius.x - top.x).toBeCloseTo(3.5, 6);
  });

  test("las plantillas del personalizado son trazados válidos", () => {
    for (const template of CUSTOM_TEMPLATES) {
      expect(() => buildTrack(custom(template.build(20)))).not.toThrow();
    }
  });

  test("arrastrar el radio de un loop con el cursor quieto converge al radio inicial más el desplazamiento", () => {
    // Arrange
    let config = custom([point(0, 1), point(0.25, 0, 12, 3), point(0.5, 0.35), point(0.75, 0), point(1, 0)]);
    const first = pointHandles(buildTrack(config), config).find(handle => handle.kind === "loopRadius");
    const start = { handle: first, point: { x: first.x, y: first.y } };
    const cursor = { x: first.x + 0.3, y: first.y };

    // Act
    for (let move = 0; move < 6; move++) {
      const fresh = pointHandles(buildTrack(config), config).find(handle => handle.kind === "loopRadius");
      config = custom(proposePointHandle(config, fresh, cursor, start).points);
    }

    // Assert
    expect(config.customPoints[1].loopTopRadius).toBeCloseTo(3.3, 6);
  });

  test("la cima del loop se mide desde el inicio del gesto: tomarla corrida en pantalla no la hace saltar", () => {
    // Arrange: la manija se dibuja 2 m más arriba de la cima real (loop chico en pantalla).
    const config = custom([point(0, 1), point(0.25, 0, 12, 3), point(0.5, 0.35), point(0.75, 0), point(1, 0)]);
    const top = pointHandles(buildTrack(config), config).find(handle => handle.kind === "loopTop");
    const start = { handle: top, point: { x: top.x, y: top.y + 2 } };

    // Act: el cursor todavía no se movió; después sube 1 m.
    const still = proposePointHandle(config, top, start.point, start);
    const raised = proposePointHandle(config, top, { x: start.point.x, y: start.point.y + 1 }, start);

    // Assert
    expect(still.points[1].loopHeight).toBeCloseTo(12, 6);
    expect(raised.points[1].loopHeight).toBeCloseTo(13, 6);
  });
});

describe("Agregar puntos y plantillas sin puntero", () => {
  test("insertAfter agrega un punto a mitad de camino hacia el siguiente", () => {
    // Arrange
    const config = custom([point(0, 1), point(0.25, 0), point(0.5, 0.4), point(0.75, 0), point(1, 0)]);

    // Act
    const result = insertAfter(config, 1);

    // Assert
    expect(result.index).toBe(2);
    expect(result.points).toHaveLength(6);
    expect(result.points[2].x).toBeCloseTo(0.375, 6);
    expect(result.points[2].y).toBeCloseTo(0.2, 6);
  });

  test("insertAfter usa el tramo anterior si después no hay lugar, y avisa si no hay en ninguno", () => {
    const tight = custom([point(0, 1), point(0.25, 0), point(0.5, 0.4), point(0.58, 0.4), point(1, 0)]);
    const result = insertAfter(tight, 2);
    expect(result.index).toBe(2);
    expect(result.points[2].x).toBeCloseTo(0.375, 6);

    const full = custom([point(0, 1), point(0.05, 0.5), point(0.1, 0), point(1, 0)]);
    expect(insertAfter(full, 1)).toEqual({ error: "No hay lugar para otro punto junto a este." });
  });

  test("una plantilla que no entra en el ancho actual dice por qué; las demás no tienen problema", () => {
    const narrow = custom(null, { trackWidth: 10 });
    const loop = CUSTOM_TEMPLATES.find(template => template.id === "loop");

    expect(templateProblem(narrow, loop)).toMatch(/\S/);
    expect(templateProblem(custom(null), loop)).toBeNull();
  });
});
