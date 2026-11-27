import { APPROACH_LENGTH, ARC_LENGTH_SAMPLES, DRAW_DIVISIONS } from "../constants.js";
import { ConfigError, resolveConfig } from "../config.js";
import { hermitePoint, arcLengthTable, parameterAt } from "./hermite.js";
import { lineMetrics, linePoint } from "./line.js";
import { createLoop, loopPoint, loopExtent } from "./loop.js";
import { layoutNodes } from "./layouts.js";
import { maxOf, minOf } from "../utils.js";

/**
 * @typedef {import("./hermite.js").CurvePoint & {distance: number, section: string, segmentIndex: number, kind: string}} TrackPoint
 */

/**
 * @typedef {Object} TrackSection
 * @property {number} index Índice del tramo.
 * @property {string} kind "line" | "curve" | "loop" | "flat".
 * @property {string} name Nombre legible del tramo.
 * @property {number} start Coordenada s de inicio (m).
 * @property {number} end Coordenada s de fin (m).
 * @property {number} length Longitud (m).
 * @property {number | null} element Índice del elemento del trazado al que pertenece (el de su nodo de llegada; el loop, a su punto); null en la llegada y el frenado.
 */

/**
 * @typedef {Object} TrackMarker
 * @property {string} label Letra del punto crítico (A–F).
 * @property {string} name Descripción.
 * @property {number} distance Coordenada s (m).
 * @property {"start"|"loop-entry"|"loop-top"|"crest"|"brake-entry"|"end"} role
 */

/**
 * @typedef {Object} Track
 * @property {string} mapId
 * @property {import("./layouts.js").TrackNode[]} nodes
 * @property {any[]} segments Tramos internos con su geometría.
 * @property {TrackSection[]} sections Tramos legibles.
 * @property {TrackMarker[]} markers Puntos críticos.
 * @property {number} totalLength Longitud total hasta el fin de la zona de frenado (m).
 * @property {number} stationStart Inicio del tramo de aproximación (m).
 * @property {number} brakeStart Inicio de la zona de frenado / contacto con el resorte (m).
 * @property {number} brakeX Posición horizontal del inicio del frenado (m).
 * @property {number} endX Posición horizontal del final (m).
 * @property {number} maxHeight Altura máxima alcanzada por la vía (m).
 * @property {number} minX Posición horizontal mínima (m).
 * @property {number} maxX Posición horizontal máxima (m).
 * @property {TrackPoint[]} points Polilínea para dibujar la vía.
 * @property {any[]} loops Tramos de loop.
 * @property {TrackZone[]} zones Lanzadores y frenos de ajuste, en orden de avance.
 * @property {import("./elements.js").LiftSpec | null} lift Subida por cadena hasta A, o null si no hay.
 */

/**
 * @typedef {Object} TrackZone
 * @property {"booster"|"trim"} kind
 * @property {number} element Índice del elemento.
 * @property {string} name «Lanzador 1», «Frenos de ajuste 2»…
 * @property {number} start Coordenada s de entrada (m).
 * @property {number} end Coordenada s de salida (m).
 * @property {number} [power] Potencia del lanzador P (W).
 * @property {number} [maxAcceleration] Aceleración máxima del lanzador (m/s²).
 * @property {number} [damping] Coeficiente c de los frenos de ajuste (N·s/m).
 */

const cache = new Map();
const CACHE_SIZE = 16;

/**
 * Campos de la configuración que determinan la geometría.
 * @param {import("../config.js").SimulationConfig} config
 */
function cacheKey(config) {
  return JSON.stringify([config.track, config.initialHeight, config.brakingLength, config.brakeMode]);
}

/**
 * @param {import("./layouts.js").TrackNode} start
 * @param {import("./layouts.js").TrackNode} end
 * @param {boolean} isFirst
 * @param {boolean} fromLoop
 */
function sectionName(start, end, isFirst, fromLoop) {
  if (isFirst) return "Caída inicial";
  if (end.role === "crest") return "Colina (subida)";
  if (start.role === "crest") return "Colina (bajada)";
  if (fromLoop) return "Salida del loop";
  if (end.y > start.y) return "Subida";
  if (end.y < start.y) return "Descenso";
  return "Recta";
}

/**
 * Zona de un tramo recto de lanzador o de frenos de ajuste, con sus valores.
 * @param {any} segment
 * @param {import("../config.js").SimulationConfig} config
 * @returns {TrackZone}
 */
function zoneOf(segment, config) {
  const element = /** @type {import("./elements.js").ZoneElement} */ (config.track[segment.element]);
  const base = { kind: segment.zone, element: segment.element, name: segment.section, start: segment.start, end: segment.end };
  return element.type === "booster" ? { ...base, power: element.power, maxAcceleration: element.maxAcceleration } : { ...base, damping: element.damping };
}

/**
 * Geometría local de un tramo.
 * @param {any} segment
 * @param {number} localDistance
 * @returns {import("./hermite.js").CurvePoint}
 */
export function segmentPoint(segment, localDistance) {
  switch (segment.kind) {
    case "loop":
      return loopPoint(segment, localDistance);

    case "line":
    case "flat":
      return linePoint(segment, localDistance);

    default:
      return hermitePoint(
        segment.a,
        segment.b,
        parameterAt(segment.table, localDistance),
        segment.slope
      );
  }
}

/**
 * Valida que cada loop quepa horizontalmente entre sus nodos vecinos.
 * @param {import("./layouts.js").TrackNode[]} nodes
 */
function assertLoopsFit(nodes) {
  nodes.forEach((node, index) => {
    if (!node.loopHeight) return;

    const loop = createLoop({
      x: node.x,
      y: node.y,
      height: node.loopHeight,
      topRadius: node.loopTopRadius ?? node.loopHeight / 2,
      section: ""
    });

    const [minX, maxX] = loopExtent(loop);
    const previous = nodes[index - 1];
    const next = nodes[index + 1];

    const previousLimit = previous.loopHeight
      ? createLoop({
          x: previous.x,
          y: previous.y,
          height: previous.loopHeight,
          topRadius: previous.loopTopRadius ?? previous.loopHeight / 2,
          section: ""
        }).exitX
      : previous.x;

    if (minX < previousLimit || maxX > next.x || loop.exitX >= next.x) {
      throw new ConfigError(
        `El loop del punto ${index + 1} necesita más espacio horizontal: ` +
          "separá los puntos vecinos o reducí la altura del loop.",
        "track"
      );
    }
  });
}

/**
 * Construye el trazado completo a partir de la configuración.
 * El resultado se memoriza por geometría; no debe modificarse.
 *
 * @param {Partial<import("../config.js").SimulationConfig>} input
 * @returns {Track}
 */
export function buildTrack(input) {
  const config = resolveConfig(input);
  const key = cacheKey(config);
  const cached = cache.get(key);

  if (cached) return cached;

  const nodes = layoutNodes(config);

  // Con subida por cadena, el tren arranca por gravedad desde A; sin subida (lanzada) puede salir en plano.
  const lift = config.track[0]?.type === "start" ? (config.track[0].lift ?? null) : null;
  if (lift && nodes[0].y <= nodes[1].y) {
    throw new ConfigError(
      "El primer tramo debe descender para iniciar por gravedad.",
      "initialHeight"
    );
  }

  for (let index = 1; index < nodes.length; index++) {
    if (nodes[index].x <= nodes[index - 1].x) {
      throw new ConfigError("Los puntos deben avanzar horizontalmente.", "track");
    }
  }

  assertLoopsFit(nodes);

  /** @type {any[]} */
  const segments = [];
  /** @type {import("./builder.js").TrackMarker[]} */
  const markers = [{ label: "A", name: "Inicio del recorrido", distance: 0, role: "start" }];

  let totalLength = 0;
  let loopCount = 0;
  /** Lanzadores y frenos de ajuste vistos hasta ahora, para numerarlos. */
  const zoneCount = { booster: 0, trim: 0 };
  let crestCount = 0;

  /** @param {any} segment */
  function push(segment) {
    segments.push({ ...segment, start: totalLength, end: totalLength + segment.length });
    totalLength += segment.length;
  }

  /** @type {import("./layouts.js").TrackNode | null} */
  let previousExit = null;

  for (let index = 0; index < nodes.length - 1; index++) {
    const start = previousExit ?? nodes[index];
    const end = nodes[index + 1];
    const fromLoop = previousExit !== null;
    previousExit = null;

    if (end.x <= start.x) {
      throw new ConfigError(
        "No queda espacio entre la salida del loop y el siguiente punto.",
        "track"
      );
    }

    const name = sectionName(start, end, index === 0, fromLoop);

    if (end.line) {
      const metrics = lineMetrics(start, end);
      const zone = end.zone;
      const section = zone ? `${zone === "booster" ? "Lanzador" : "Frenos de ajuste"} ${(zoneCount[zone] += 1)}` : index === 0 ? "Plano inclinado" : "Recta";
      push({ kind: "line", x: start.x, y: start.y, angle: metrics.angle, length: metrics.length, section, element: end.element, ...(zone ? { zone } : {}) });
    } else {
      const slope = index === 0 ? (end.y - start.y) / (end.x - start.x) : 0;
      const table = arcLengthTable(start, end, slope, ARC_LENGTH_SAMPLES);

      push({ kind: "curve", a: start, b: end, slope, table, length: table[ARC_LENGTH_SAMPLES], section: name, element: end.element });
    }

    if (end.role === "crest") {
      crestCount += 1;
      markers.push({
        label: `D${crestCount > 1 ? crestCount : ""}`,
        name: "Cresta de la colina",
        distance: totalLength,
        role: "crest"
      });
    }

    if (end.loopHeight) {
      loopCount += 1;
      const suffix = loopCount > 1 ? String(loopCount) : "";
      const loop = createLoop({
        x: end.x,
        y: end.y,
        height: end.loopHeight,
        topRadius: end.loopTopRadius ?? end.loopHeight / 2,
        section: `Loop ${loopCount}`
      });

      markers.push({ label: `B${suffix}`, name: "Entrada al loop", distance: totalLength, role: "loop-entry" });
      markers.push({ label: `C${suffix}`, name: "Cima del loop", distance: totalLength + loop.topDistance, role: "loop-top" });
      push({ ...loop, element: end.element });
      previousExit = { x: loop.exitX, y: end.y, role: "plain" };
    }
  }

  const endNode = nodes[nodes.length - 1];
  const stationStart = totalLength;

  push({ kind: "flat", x: endNode.x, y: 0, angle: 0, length: APPROACH_LENGTH, section: "Aproximación" });

  const brakeStart = totalLength;
  const brakeX = endNode.x + APPROACH_LENGTH;

  push({
    kind: "flat",
    x: brakeX,
    y: 0,
    angle: 0,
    length: config.brakingLength,
    section: config.brakeMode === "spring" ? "Resorte de tope" : "Zona de frenado"
  });

  markers.push({ label: "E", name: "Inicio del frenado", distance: brakeStart, role: "brake-entry" });
  markers.push({ label: "F", name: "Fin de la zona de frenado", distance: totalLength, role: "end" });

  const points = segments.flatMap((segment, segmentIndex) => {
    const divisions = DRAW_DIVISIONS[/** @type {keyof typeof DRAW_DIVISIONS} */ (segment.kind)] ?? 50;

    return Array.from({ length: divisions + 1 }, (_, index) => ({
      ...segmentPoint(segment, (segment.length * index) / divisions),
      distance: segment.start + (segment.length * index) / divisions,
      section: segment.section,
      segmentIndex,
      kind: segment.kind
    }));
  });

  /** @type {Track} */
  const track = {
    mapId: config.mapId,
    nodes,
    segments,
    sections: segments.map((segment, index) => ({
      index,
      kind: segment.kind,
      name: segment.section,
      start: segment.start,
      end: segment.end,
      length: segment.length,
      element: segment.element ?? null
    })),
    markers,
    totalLength,
    stationStart,
    brakeStart,
    brakeX,
    endX: brakeX + config.brakingLength,
    maxHeight: maxOf(points, point => point.y),
    minX: Math.min(0, minOf(points, point => point.x)),
    maxX: brakeX + config.brakingLength,
    points,
    loops: segments.filter(segment => segment.kind === "loop"),
    zones: segments.filter(segment => segment.zone).map(segment => zoneOf(segment, config)),
    lift: lift ? { ...lift } : null
  };

  if (cache.size >= CACHE_SIZE) {
    cache.delete(cache.keys().next().value);
  }

  cache.set(key, track);
  return track;
}
