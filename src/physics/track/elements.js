import { ConfigError, CONFIG_LIMITS, assertLoopShape } from "../config.js";

/**
 * Trazado como lista de elementos con posición en metros, en orden de
 * avance. Es la única fuente de la geometría: `buildTrack` compila los
 * elementos a nodos. Las configuraciones viejas (mapId + parámetros, o
 * puntos personalizados relativos) se traducen con las fórmulas de siempre.
 */

/**
 * @typedef {{type: "start"}} StartElement
 * @typedef {{type: "point", x: number, y: number, loop?: {height: number, topRadius: number}, line?: boolean}} PointElement
 * @typedef {{type: "hill", x: number, height: number, crestRadius: number}} HillElement
 * @typedef {{type: "end", x: number, line?: boolean}} EndElement
 * @typedef {StartElement | PointElement | HillElement | EndElement} TrackElement
 * @typedef {{x?: number, y?: number, loop?: {height: number, topRadius: number} | undefined, line?: boolean, height?: number, crestRadius?: number}} ElementChanges
 */

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
  const start = { type: "start" };
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
  if (elements.at(-1)?.type !== "end") fail("El trazado termina en el final (E).");

  elements.forEach((element, index) => {
    const name = () => elementName(elements, index);
    const inner = index > 0 && index < elements.length - 1;

    if (inner && element.type !== "point" && element.type !== "hill") fail(`Elemento ${index + 1}: tipo desconocido.`);

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
  return element.type === "point" && element.loop ? { ...element, loop: { ...element.loop } } : { ...element };
}
