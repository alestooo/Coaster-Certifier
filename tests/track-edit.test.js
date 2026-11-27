import { describe, test, expect } from "vitest";
import { buildTrack, resolveConfig, geometryAt, MAX_TRACK_ELEMENTS } from "../src/physics/index.js";
import {
  EDIT_MIN_GAP_M,
  moveElement,
  setPointLoop,
  toggleLoop,
  setHill,
  insertPoint,
  insertAfter,
  removeElement,
  elementLimits,
  elementHandles,
  proposeElementHandle
} from "../src/lib/track-edit.ts";
import { mapTemplate } from "../src/game/maps.ts";

const start = { type: "start" };
const point = (x, y, loop) => (loop ? { type: "point", x, y, loop } : { type: "point", x, y });
const end = x => ({ type: "end", x });

/** Configuración resuelta con ese trazado (H 30 m salvo que se pida otra). */
const withTrack = (track, extra = {}) => resolveConfig({ initialHeight: 30, initialSpeed: 2, ...extra, track });
/** El trazado del anexo, con sus valores. */
const annex = () => resolveConfig(mapTemplate("reference"));
const builds = (config, track) => buildTrack(resolveConfig({ ...config, track }));

describe("Edición de elementos", () => {
  test("un punto queda entre sus vecinos (a 2 m) y su altura entre 0 y 80 m", () => {
    const config = withTrack([start, point(60, 0), point(120, 5), point(180, 0), end(300)]);

    const right = moveElement(config, 2, 500, 200);
    const low = moveElement(config, 2, 120, -5);

    expect(right.track[2].x).toBeLessThanOrEqual(180 - EDIT_MIN_GAP_M + 1e-9);
    expect(right.track[2].y).toBeLessThanOrEqual(80);
    expect(right.limited).toBe(true);
    expect(low.track[2].y).toBe(0);
  });

  test("A no se mueve", () => {
    const config = withTrack([start, point(60, 0), end(300)]);

    expect(moveElement(config, 0, 40, 10).track).toEqual(config.track);
  });

  test("mover E solo cambia end.x: los demás elementos quedan iguales", () => {
    const config = annex();
    const last = config.track.length - 1;

    const moved = moveElement(config, last, 280);

    expect(moved.track.slice(0, last)).toEqual(config.track.slice(0, last));
    expect(moved.track[last]).toEqual({ type: "end", x: 280 });
  });

  test("E respeta la recta mínima a la izquierda y el tope de 600 m a la derecha", () => {
    const config = withTrack([start, point(60, 0), point(120, 0), end(300)]);

    const left = moveElement(config, 3, 10);
    const right = moveElement(config, 3, 900);

    expect(left.track[3].x).toBeCloseTo(120 + EDIT_MIN_GAP_M, 6);
    expect(left.track.slice(0, 3)).toEqual(config.track.slice(0, 3));
    expect(right.track[3].x).toBe(600);
    expect(right.limited).toBe(true);
  });

  test("arrastrar un loop sobre una colina se detiene en el último diseño construible y explica por qué", () => {
    const config = annex();
    const hillX = config.track[2].x;

    const moved = moveElement(config, 1, hillX, 0);

    expect(moved.limited).toBe(true);
    expect(moved.reason).toBeTruthy();
    expect(() => builds(config, moved.track)).not.toThrow();
    expect(moved.track[1].x).toBeLessThan(hillX);
  });

  test("se pueden agregar más de 9 puntos y más de 3 loops; el tope es de 40 elementos", () => {
    let config = withTrack([start, end(600)]);
    let lastError = null;

    for (let x = 10; x < 600; x += 14) {
      const result = insertPoint(config, x, 0);
      if ("error" in result) {
        lastError = result.error;
        break;
      }
      config = withTrack(result.track);
    }

    expect(config.track).toHaveLength(MAX_TRACK_ELEMENTS);
    expect(lastError).toMatch(/40/);

    let looped = withTrack([start, point(110, 0), point(230, 0), point(350, 0), point(470, 0), end(600)]);
    for (const index of [1, 2, 3, 4]) looped = withTrack(setPointLoop(looped, index, 10, 2.5).track);
    expect(looped.track.filter(element => element.loop)).toHaveLength(4);
  });

  test("borrar hasta quedar con A y E sigue construyendo; A y E no se borran", () => {
    let config = annex();

    expect(removeElement(config, 0)).toBeNull();
    expect(removeElement(config, config.track.length - 1)).toBeNull();

    while (config.track.length > 2) config = withTrack(/** @type {any} */ (removeElement(config, 1)).track);

    expect(config.track.map(element => element.type)).toEqual(["start", "end"]);
    expect(() => buildTrack(config)).not.toThrow();
  });

  test("insertPoint agrega el punto en orden y rechaza uno a menos de 2 m de otro", () => {
    const config = withTrack([start, point(60, 0), point(180, 0), end(300)]);

    const result = insertPoint(config, 120, 4);
    expect("track" in result && result.index).toBe(2);
    expect("track" in result && result.track[2]).toEqual({ type: "point", x: 120, y: 4 });
    expect(insertPoint(config, 61, 0)).toHaveProperty("error");
  });

  test("insertAfter agrega un punto a mitad de camino, o en el tramo anterior si después no hay lugar", () => {
    const config = withTrack([start, point(60, 0), point(62.5, 0), end(300)]);

    const after = insertAfter(config, 2, "point");
    const before = insertAfter(config, 1, "point");

    expect("track" in after && after.track[3].x).toBeCloseTo((62.5 + 300) / 2, 6);
    expect("track" in before && before.track[1].x).toBeCloseTo(30, 6);
  });

  test("insertAfter con «hill» agrega una colina construible, y avisa si no hay lugar", () => {
    const roomy = withTrack([start, point(60, 0), end(400)]);
    // Ni entre A y el punto 1 ni entre los puntos entra la colina más chica (h 2 m, ρ_c 10 m: 22 m de ancho).
    const tight = withTrack([start, point(12, 0), point(24, 0), end(100)]);

    const added = insertAfter(roomy, 1, "hill");
    expect("track" in added && added.track[2].type).toBe("hill");
    expect(() => builds(roomy, "track" in added ? added.track : [])).not.toThrow();
    expect(insertAfter(tight, 1, "hill")).toHaveProperty("error");
  });

  test("la colina que se agrega se achica para entrar en el hueco (ρ_c ≥ 10 m, altura ≥ 2 m)", () => {
    const config = annex();

    const added = insertAfter(config, 1, "hill");

    expect(added).not.toHaveProperty("error");
    const hill = "track" in added ? added.track[added.index] : null;
    expect(hill?.type).toBe("hill");
    expect(hill.crestRadius).toBeLessThan(25);
    expect(hill.crestRadius).toBeGreaterThanOrEqual(10);
    expect(hill.height).toBeGreaterThanOrEqual(2);
    expect(() => builds(config, added.track)).not.toThrow();
  });

  test("«Agregar colina» después del punto del loop del anexo la pone entre el loop y la colina (el loop ocupa lugar)", () => {
    const config = annex();

    const added = insertAfter(config, 1, "hill");

    expect("track" in added && added.index).toBe(2);
    const hill = "track" in added ? added.track[2] : null;
    expect(hill?.x).toBeGreaterThan(80);
    expect(hill?.x).toBeLessThan(config.track[2].x);
    expect(() => builds(config, added.track)).not.toThrow();
  });

  test("un punto con loop no se puede acercar a su vecino más de lo que ocupa su loop", () => {
    const config = withTrack([start, point(80, 0, { height: 21.5, topRadius: 5 }), point(160, 0), end(320)]);

    const [, max] = elementLimits(config, 1, "x");
    const moved = moveElement(config, 1, max, 0);

    expect(max).toBeLessThan(160 - EDIT_MIN_GAP_M - 5);
    expect(moved.reason).toBeNull();
    expect(() => builds(config, moved.track)).not.toThrow();
  });

  test("toggleLoop agrega un loop en lágrima y lo vuelve a quitar; A y E no llevan loop", () => {
    const config = withTrack([start, point(80, 0), point(200, 0), end(320)]);

    const added = toggleLoop(config, 1);
    const loop = added.track[1].loop;
    expect(loop.topRadius).toBeLessThan(loop.height / 2);
    expect(toggleLoop(withTrack(added.track), 1).track[1].loop).toBeUndefined();
    expect(setPointLoop(config, 0, 10, 2.5).limited).toBe(true);
  });

  test("la forma del loop se limita: R no supera h_L/2", () => {
    const config = withTrack([start, point(80, 0), point(200, 0), end(320)]);

    expect(setPointLoop(config, 1, 10, 9).track[1].loop.topRadius).toBe(5);
  });

  test("setHill cambia la altura y el radio de una colina, sin salirse de lo construible", () => {
    const config = annex();

    const taller = setHill(config, 2, { height: 12 });
    const huge = setHill(config, 2, { crestRadius: 200 });

    expect(taller.track[2].height).toBe(12);
    expect(() => builds(config, huge.track)).not.toThrow();
  });

  test("elementLimits: R sigue a h_L/2 y la x de un punto queda entre sus vecinos, después de la salida del loop", () => {
    const config = withTrack([start, point(80, 0, { height: 14, topRadius: 3.5 }), point(200, 0), end(320)]);
    const [min, max] = elementLimits(config, 2, "x");

    expect(elementLimits(config, 1, "loopTopRadius")[1]).toBe(7);
    expect(min).toBeGreaterThan(80 + EDIT_MIN_GAP_M);
    expect(max).toBe(320 - EDIT_MIN_GAP_M);
    expect(() => builds(config, moveElement(config, 2, min, 0).track)).not.toThrow();
  });

  test("las letras de las manijas siguen a los marcadores: en el anexo B va en el punto del loop, C en su cima, D en la colina y E en el final", () => {
    const config = annex();
    const handles = elementHandles(buildTrack(config), config);
    const letter = kind => handles.find(handle => handle.kind === kind)?.letter;

    expect(letter("point")).toBe("B");
    expect(letter("loopTop")).toBe("C");
    expect(letter("hillCrest")).toBe("D");
    expect(letter("end")).toBe("E");
  });

  test("los nombres de las manijas no tienen símbolos con guion bajo", () => {
    const config = annex();

    for (const handle of elementHandles(buildTrack(config), config)) expect(handle.name, handle.id).not.toMatch(/_|ρ/);
  });

  test("arrastrar el radio de un loop con el cursor quieto converge al radio inicial más el desplazamiento", () => {
    const config = withTrack([start, point(100, 0, { height: 14, topRadius: 3.5 }), end(320)]);
    const handle = elementHandles(buildTrack(config), config).find(candidate => candidate.kind === "loopRadius");
    const startGesture = { handle, point: { x: handle.x, y: handle.y } };

    const first = proposeElementHandle(config, handle, { x: handle.x + 1, y: handle.y }, startGesture);
    const again = proposeElementHandle(withTrack(first.track), handle, { x: handle.x + 1, y: handle.y }, startGesture);

    expect(first.track[1].loop.topRadius).toBeCloseTo(4.5, 6);
    expect(again.track[1].loop.topRadius).toBeCloseTo(4.5, 6);
  });

  test("subir la cima del loop con su manija respeta h_L ≤ 20R sin tocar R", () => {
    const config = withTrack([start, point(100, 0, { height: 14, topRadius: 1 }), end(320)]);
    const handle = elementHandles(buildTrack(config), config).find(candidate => candidate.kind === "loopTop");

    const raised = proposeElementHandle(config, handle, { x: handle.x, y: 60 });

    expect(raised.track[1].loop).toEqual({ height: 20, topRadius: 1 });
    expect(raised.limited).toBe(true);
  });

  test("una colina que no cabe se detiene en el último radio construible y lo explica con coma decimal", () => {
    const config = annex();
    const handle = elementHandles(buildTrack(config), config).find(candidate => candidate.kind === "hillRadius");

    const wide = proposeElementHandle(config, handle, { x: handle.x + 400, y: 0 });

    expect(wide.limited).toBe(true);
    expect(wide.reason).toMatch(/\d,\d m/);
    expect(wide.reason).not.toMatch(/\d\.\d/);
    expect(wide.track[2].crestRadius).toBeGreaterThan(config.track[2].crestRadius);
    expect(() => builds(config, wide.track)).not.toThrow();
  });

  test("arrastrar E corre solo la recta final", () => {
    const config = annex();
    const handle = elementHandles(buildTrack(config), config).find(candidate => candidate.kind === "end");

    const moved = proposeElementHandle(config, handle, { x: handle.x - 20, y: 0 });

    expect(moved.track.at(-1).x).toBeCloseTo(config.track.at(-1).x - 20, 6);
    expect(moved.track.slice(0, -1)).toEqual(config.track.slice(0, -1));
  });

  test("borrar un punto que deja un trazado no construible no lo borra y explica por qué", () => {
    // A a 20 m; sin el punto 2, el primer tramo subiría hasta el punto 3 (22 m).
    const config = withTrack([start, point(40, 5), point(80, 22), point(120, 0), end(200)], { initialHeight: 20 });

    const result = removeElement(config, 1);

    expect(result).toHaveProperty("error");
    expect(result.error).toMatch(/descender/);
  });

  test("agregar un punto al plano inclinado no deja un quiebre: la tangente es continua en los nodos interiores", () => {
    const config = resolveConfig(mapTemplate("incline"));
    const added = insertPoint(config, 30, 10);
    const track = buildTrack(withTrack("track" in added ? added.track : [], { initialHeight: config.initialHeight }));

    for (const section of track.sections.slice(1).filter(section => section.end <= track.stationStart)) {
      const before = geometryAt(track, section.start - 1e-3).angle;
      const after = geometryAt(track, section.start + 1e-3).angle;
      expect(Math.abs(after - before), section.name).toBeLessThan(0.01);
    }
  });

  test("cambiar solo la altura de un punto pegado a su vecino no lo corre de costado", () => {
    // El loop del punto 1 sale cerca de 91 m: el vecino en 92 m queda más cerca que el margen de 2 m.
    const grown = withTrack([start, point(80, 0, { height: 14, topRadius: 3.5 }), point(92, 0), end(320)]);
    const neighbour = grown.track[2].x;

    const raised = moveElement(grown, 1, grown.track[1].x, 3);
    const raisedNeighbour = moveElement(grown, 2, neighbour, 2);

    expect(raised.track[1].x).toBe(grown.track[1].x);
    expect(raisedNeighbour.track[2].x).toBe(neighbour);
    const [min, max] = elementLimits(grown, 1, "x");
    expect(grown.track[1].x).toBeGreaterThanOrEqual(min);
    expect(grown.track[1].x).toBeLessThanOrEqual(max);
  });

  test("E pegado a una colina: moverlo 1 m a la izquierda no lo corre a la derecha", () => {
    const config = withTrack([start, point(60, 0), { type: "hill", x: 150, height: 8, crestRadius: 20 }, end(200)]);
    const grown = withTrack(setHill(config, 2, { crestRadius: 200 }).track);
    const endX = grown.track[3].x;

    const moved = moveElement(grown, 3, endX - 1);

    expect(moved.track[3].x).toBeLessThanOrEqual(endX);
  });
});
