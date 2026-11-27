import { ConfigError, CONFIG_LIMITS, assertLoopShape } from "../config.js";

/**
 * Trazado como lista de elementos con posición en metros, en orden de
 * avance. Es la única fuente de la geometría: `buildTrack` compila los
 * elementos a nodos. Las configuraciones viejas (mapId + parámetros, o
 * puntos personalizados relativos) se traducen con las fórmulas de siempre.
 */

/**
 * @typedef {{angle: number, efficiency: number, chainSpeed: number}} LiftSpec
 *   Subida por cadena hasta A: ángulo α (rad), eficiencia η del motor (0–1] y rapidez de la cadena v_c (m/s).
 * @typedef {{type: "start", lift?: LiftSpec}} StartElement
 *   A. Sin `lift` es una montaña rusa sin subida (lanzada): el primer tramo no tiene que descender.
 * @typedef {{type: "point", x: number, y: number, loop?: {height: number, topRadius: number}, line?: boolean}} PointElement
 * @typedef {{type: "hill", x: number, height: number, crestRadius: number}} HillElement
 * @typedef {{type: "end", x: number, line?: boolean}} EndElement
 * @typedef {{type: "booster", x: number, y: number, length: number, power: number, maxAcceleration: number}} BoosterElement
 *   Lanzador LSM sobre una recta horizontal de `length` m desde x, a la altura y: F = min(m·a_máx, P/v).
 * @typedef {{type: "trim", x: number, y: number, length: number, damping: number}} TrimElement
 *   Frenos de ajuste por corrientes parásitas sobre una recta horizontal: F = −c·v.
 * @typedef {BoosterElement | TrimElement} ZoneElement
 * @typedef {StartElement | PointElement | HillElement | EndElement | ZoneElement} TrackElement
 * @typedef {{x?: number, y?: number, loop?: {height: number, topRadius: number} | undefined, line?: boolean, height?: number, crestRadius?: number, length?: number, power?: number, maxAcceleration?: number, damping?: number}} ElementChanges
 */

/** Rangos de los elementos de zona (SI). */
export const ZONE_LIMITS = Object.freeze({
  length: /** @type {const} */ ([2, 300]),
  power: /** @type {const} */ ([1_000, 20_000_000]),
  maxAcceleration: /** @type {const} */ ([0.1, 30]),
  damping: /** @type {const} */ ([0, 50_000])
});

/** Subida de los trazados predefinidos: la rampa que siempre se dibujó (1 m de subida cada 1,35 m), η = 0,8 y v_c = 2 m/s. */
export const DEFAULT_LIFT = Object.freeze({ angle: Math.atan2(1, 1.35), efficiency: 0.8, chainSpeed: 2 });

/** Rangos de la subida: α en grados, η y v_c. */
export const LIFT_LIMITS = Object.freeze({
  angleDegrees: /** @type {const} */ ([10, 60]),
  efficiency: /** @type {const} */ ([0.05, 1]),
  chainSpeed: /** @type {const} */ ([0.5, 6])
});

/** Tope de elementos por rendimiento (no es un límite de diseño). */
export const MAX_TRACK_ELEMENTS = 40;

/** Separación mínima entre la colina y sus vecinos en los trazados predefinidos (fracción del ancho). */
const LEGACY_HILL_GAP_FRACTION = 0.03;

/**
 * Altura máxima de un punto (m): la de la cima A más alta. Es una función y
 * no una constante porque config.js importa este módulo (importación circular).
 */
const maxPointHeight = () => CONFIG_LIMITS.initialHeight[1];

/**
 * @param {number} x
 * @param {number} y
 * @param {import("./layouts.js").TrackNode["role"]} role
 * @param {number} element Índice del elemento que generó el nodo.
 * @param {Partial<import("./layouts.js").TrackNode>} [extra]
 * @returns {import("./layouts.js").TrackNode & {element: number, line?: boolean}}
 */
function node(x, y, role, element, extra = {}) {
  return { x, y, role, element, ...extra };
}

/**
 * Semiancho horizontal de una colina simétrica construida con curvas de
 * Hermite de pendiente nula en los extremos: ρ_c = w² / (6·h_c).
 * @param {number} height Altura h_c (m).
 * @param {number} crestRadius Radio en la cresta ρ_c (m).
 */
export function hillHalfWidth(height, crestRadius) {
  return Math.sqrt(6 * height * crestRadius);
}

/**
 * Nodos de los elementos, en orden. Un punto sin loop más alto que sus dos
 * vecinos es una cresta (la D del anexo), igual que en el trazado personalizado.
 * @param {ReadonlyArray<TrackElement>} elements
 * @param {number} initialHeight Altura H de la cima A (m).
 */
export function compileElements(elements, initialHeight) {
  const nodes = elements.flatMap((element, index) => {
    switch (element.type) {
      case "start":
        return [node(0, initialHeight, "start", index)];
      case "point":
        return [
          node(element.x, element.y, "plain", index, {
            ...(element.loop ? { loopHeight: element.loop.height, loopTopRadius: element.loop.topRadius } : {}),
            ...(element.line ? { line: true } : {})
          })
        ];
      case "hill": {
        const half = hillHalfWidth(element.height, element.crestRadius);
        return [
          node(element.x - half, 0, "plain", index),
          node(element.x, element.height, "crest", index),
          node(element.x + half, 0, "plain", index)
        ];
      }
      case "booster":
      case "trim":
        // Una zona que empieza en A (x = 0, justo después del inicio) comparte su nodo: es la estación de una
        // montaña rusa lanzada, a la altura de A. Arranca en reposo dentro del lanzador.
        if (index === 1 && element.x === 0) return [node(element.length, initialHeight, "plain", index, { line: true, zone: element.type })];
        // Recta horizontal: las curvas de Hermite llegan horizontales a sus nodos, así que no hay quiebre.
        return [node(element.x, element.y, "plain", index), node(element.x + element.length, element.y, "plain", index, { line: true, zone: element.type })];
      default:
        return [node(element.x, 0, "end", index, element.line ? { line: true } : {})];
    }
  });

  return nodes.map((current, position) => {
    const source = elements[current.element];
    if (source.type !== "point" || source.loop) return current;
    const previous = nodes[position - 1];
    const next = nodes[position + 1];
    const crest = previous && next && current.y > previous.y && current.y > next.y;
    return crest ? { ...current, role: /** @type {const} */ ("crest") } : current;
  });
}

/**
 * Comprueba que la colina de un trazado predefinido quepa entre `left` y
 * `right` (mismo mensaje y campo que antes de los elementos).
 * @param {number} left
 * @param {number} right
 * @param {number} height
 * @param {number} crestRadius
 * @param {number} width
 */
function assertLegacyHillFits(left, right, height, crestRadius, width) {
  const gap = LEGACY_HILL_GAP_FRACTION * width;
  const needed = 2 * hillHalfWidth(height, crestRadius) + 2 * gap;

  if (right - left < needed) {
    throw new ConfigError(
      `La colina necesita ${needed.toFixed(1)} m de ancho y solo hay ${(right - left).toFixed(1)} m: ` +
        "reducí su altura o el radio de la cresta, o aumentá el ancho del trazado.",
      "hillCrestRadius"
    );
  }
}

/**
 * Elementos de una configuración vieja: un trazado predefinido con sus
 * parámetros, o los puntos personalizados relativos al ancho y a la altura.
 * @param {import("../config.js").SimulationConfig} config
 * @returns {TrackElement[]}
 */
export function legacyElements(config) {
  const H = config.initialHeight;
  const W = config.trackWidth;
  const loop = { height: config.loopHeight, topRadius: config.loopTopRadius };
  /** @type {StartElement} */
  const start = { type: "start", lift: { ...DEFAULT_LIFT } };
  /** @type {EndElement} */
  const end = { type: "end", x: W };

  switch (config.mapId) {
    case "incline":
      return [start, { ...end, line: true }];

    case "slope":
      return [start, { type: "point", x: 0.65 * W, y: 0 }, end];

    case "valley": {
      const valleyX = 0.3 * W;
      /** @type {TrackElement[]} */
      const elements = [start, { type: "point", x: valleyX, y: 0 }];

      if (config.hillHeight > 0) {
        assertLegacyHillFits(valleyX, W, config.hillHeight, config.hillCrestRadius, W);
        elements.push({ type: "hill", x: (valleyX + W) / 2, height: config.hillHeight, crestRadius: config.hillCrestRadius });
      }

      return [...elements, end];
    }

    case "loop":
      return [start, { type: "point", x: 0.28 * W, y: 0, loop }, { type: "point", x: 0.72 * W, y: 0 }, end];

    case "reference": {
      const loopX = 0.25 * W;
      const reference = config.loopHeight / 2;
      const shape = 1 - config.loopTopRadius / reference;
      const exitX = loopX + Math.PI * shape * reference;
      /** @type {TrackElement[]} */
      const elements = [start, { type: "point", x: loopX, y: 0, loop }];

      if (config.hillHeight > 0) {
        const left = exitX + LEGACY_HILL_GAP_FRACTION * W;
        assertLegacyHillFits(left, W, config.hillHeight, config.hillCrestRadius, W);
        elements.push({ type: "hill", x: (left + W) / 2, height: config.hillHeight, crestRadius: config.hillCrestRadius });
      }

      return [...elements, end];
    }

    default:
      return config.customPoints.map((point, index, points) => {
        if (index === 0) return start;
        if (index === points.length - 1) return { type: "end", x: point.x * W };
        /** @type {PointElement} */
        const element = { type: "point", x: point.x * W, y: point.y * H };
        return point.loopHeight > 0 ? { ...element, loop: { height: point.loopHeight, topRadius: point.loopTopRadius } } : element;
      });
  }
}

/**
 * Nombre legible de un elemento para los mensajes («Punto 3», «Colina 1»).
 * @param {ReadonlyArray<TrackElement>} elements
 * @param {number} index
 */
function elementName(elements, index) {
  const element = elements[index];
  if (element.type === "hill") return `Colina ${elements.slice(0, index + 1).filter(candidate => candidate.type === "hill").length}`;
  if (element.type === "end") return "Final del trazado (E)";
  if (element.type === "booster") return `Lanzador ${elements.slice(0, index + 1).filter(candidate => candidate.type === "booster").length}`;
  if (element.type === "trim") return `Frenos de ajuste ${elements.slice(0, index + 1).filter(candidate => candidate.type === "trim").length}`;
  if (element.type === "start") return "Inicio (A)";
  return `Punto ${index + 1}`;
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  throw new ConfigError(message, "track");
}

/** @param {unknown} value */
const finite = value => typeof value === "number" && Number.isFinite(value);

/**
 * Valida la forma de los elementos y sus valores. La construcción (que los
 * nodos avancen, que los loops y las colinas entren) la comprueba `buildTrack`.
 * No exige separación mínima en metros: eso es del editor, así ninguna
 * configuración vieja válida deja de serlo.
 * @param {ReadonlyArray<TrackElement>} elements
 */
export function validateElements(elements) {
  if (!Array.isArray(elements) || elements.length < 2) fail("El trazado necesita al menos el inicio (A) y el final (E).");
  if (elements.length > MAX_TRACK_ELEMENTS) fail(`El trazado admite hasta ${MAX_TRACK_ELEMENTS} elementos.`);
  if (elements[0]?.type !== "start") fail("El trazado empieza en el inicio (A).");
  const lift = /** @type {StartElement} */ (elements[0]).lift;
  if (lift) validateLift(lift);
  if (elements.at(-1)?.type !== "end") fail("El trazado termina en el final (E).");

  elements.forEach((element, index) => {
    if (!element || typeof element !== "object") fail(`Elemento ${index + 1}: no es un elemento válido.`);
    const name = () => elementName(elements, index);
    const inner = index > 0 && index < elements.length - 1;

    if (inner && !["point", "hill", "booster", "trim"].includes(element.type)) fail(`Elemento ${index + 1}: tipo desconocido.`);

    if (element.type === "booster" || element.type === "trim") validateZone(element, name());

    if (element.type === "point") {
      if (!finite(element.x) || !finite(element.y)) fail(`${name()}: valores inválidos.`);
      if (element.y < 0 || element.y > maxPointHeight()) fail(`${name()}: la altura debe estar entre 0 y ${maxPointHeight()} m.`);

      if (element.loop) {
        const { height, topRadius } = element.loop;
        if (!finite(height) || !finite(topRadius)) fail(`${name()}: loop con valores inválidos.`);
        const [minHeight, maxHeight] = CONFIG_LIMITS.loopHeight;
        if (height < minHeight || height > maxHeight) fail(`${name()}: la altura del loop debe estar entre ${minHeight} y ${maxHeight} m.`);
        try {
          assertLoopShape(height, topRadius, "track");
        } catch (error) {
          fail(`${name()}: ${/** @type {Error} */ (error).message}`);
        }
      }
    }

    if (element.type === "hill") {
      if (!finite(element.x) || !finite(element.height) || !finite(element.crestRadius)) fail(`${name()}: valores inválidos.`);
      const [, maxHeight] = CONFIG_LIMITS.hillHeight;
      const [minRadius, maxRadius] = CONFIG_LIMITS.hillCrestRadius;
      if (element.height <= 0 || element.height > maxHeight) fail(`${name()}: la altura debe estar entre 0 y ${maxHeight} m.`);
      if (element.crestRadius < minRadius || element.crestRadius > maxRadius) fail(`${name()}: el radio de la cresta debe estar entre ${minRadius} y ${maxRadius} m.`);
    }

    if (element.type === "end") {
      const [minWidth, maxWidth] = CONFIG_LIMITS.trackWidth;
      if (!finite(element.x) || element.x < minWidth || element.x > maxWidth) fail(`El final (E) debe estar entre ${minWidth} y ${maxWidth} m.`);
    }
  });
}

/**
 * Valores de la subida por cadena.
 * @param {LiftSpec} lift
 */
function validateLift(lift) {
  const degrees = (lift.angle * 180) / Math.PI;
  const [minAngle, maxAngle] = LIFT_LIMITS.angleDegrees;
  const [minEfficiency, maxEfficiency] = LIFT_LIMITS.efficiency;
  const [minSpeed, maxSpeed] = LIFT_LIMITS.chainSpeed;

  if (!finite(lift.angle) || degrees < minAngle || degrees > maxAngle) fail(`Subida: el ángulo debe estar entre ${minAngle}° y ${maxAngle}°.`);
  if (!finite(lift.efficiency) || lift.efficiency < minEfficiency || lift.efficiency > maxEfficiency) fail("Subida: la eficiencia del motor debe estar entre 5 % y 100 %.");
  if (!finite(lift.chainSpeed) || lift.chainSpeed < minSpeed || lift.chainSpeed > maxSpeed) fail(`Subida: la rapidez de la cadena debe estar entre ${minSpeed} y ${maxSpeed} m/s.`);
}

/**
 * Valores de un lanzador o unos frenos de ajuste.
 * @param {ZoneElement} element
 * @param {string} name
 */
function validateZone(element, name) {
  /** @param {number} value @param {readonly [number, number]} range */
  const outside = (value, [min, max]) => !finite(value) || value < min || value > max;

  if (!finite(element.x) || !finite(element.y)) fail(`${name}: valores inválidos.`);
  if (element.y < 0 || element.y > maxPointHeight()) fail(`${name}: la altura debe estar entre 0 y ${maxPointHeight()} m.`);
  if (outside(element.length, ZONE_LIMITS.length)) fail(`${name}: el largo debe estar entre ${ZONE_LIMITS.length[0]} y ${ZONE_LIMITS.length[1]} m.`);

  if (element.type === "booster") {
    if (outside(element.power, ZONE_LIMITS.power)) fail(`${name}: la potencia debe estar entre ${ZONE_LIMITS.power[0] / 1000} y ${ZONE_LIMITS.power[1] / 1000} kW.`);
    if (outside(element.maxAcceleration, ZONE_LIMITS.maxAcceleration)) {
      fail(`${name}: la aceleración máxima debe estar entre ${ZONE_LIMITS.maxAcceleration[0]} y ${ZONE_LIMITS.maxAcceleration[1]} m/s².`);
    }
  } else if (outside(element.damping, ZONE_LIMITS.damping)) {
    fail(`${name}: el coeficiente c debe estar entre ${ZONE_LIMITS.damping[0]} y ${ZONE_LIMITS.damping[1]} N·s/m.`);
  }
}

/** Parámetros de la forma vieja que definen la geometría (sin `track`). */
export const LEGACY_TRACK_KEYS = Object.freeze(["mapId", "trackWidth", "loopHeight", "loopTopRadius", "hillHeight", "hillCrestRadius", "customPoints"]);

/**
 * Aplica un cambio a una configuración. Si el cambio toca la forma vieja de
 * la geometría y no trae `track`, el trazado se vuelve a derivar de esos
 * parámetros (`track` queda sin definir hasta resolver).
 * @template {Record<string, unknown>} T
 * @param {T} config
 * @param {Record<string, unknown>} patch
 * @returns {T}
 */
export function mergeConfigPatch(config, patch) {
  const legacy = !("track" in patch) && LEGACY_TRACK_KEYS.some(key => key in patch);
  return /** @type {T} */ (legacy ? { ...config, ...patch, track: undefined } : { ...config, ...patch });
}

/**
 * Copia del trazado con el elemento `index` actualizado. No modifica la entrada.
 * @param {ReadonlyArray<TrackElement>} track
 * @param {number} index
 * @param {ElementChanges} changes
 * @returns {TrackElement[]}
 */
export function withElement(track, index, changes) {
  return track.map((element, position) => {
    if (position !== index) return copyElement(element);
    /** @type {Record<string, unknown>} */
    const next = { ...copyElement(element), ...changes };
    if ("loop" in changes && !changes.loop) delete next.loop;
    return /** @type {TrackElement} */ (/** @type {unknown} */ (next));
  });
}

/**
 * Copia profunda de un elemento.
 * @param {TrackElement} element
 * @returns {TrackElement}
 */
export function copyElement(element) {
  if (element.type === "point" && element.loop) return { ...element, loop: { ...element.loop } };
  if (element.type === "start" && element.lift) return { ...element, lift: { ...element.lift } };
  return { ...element };
}
