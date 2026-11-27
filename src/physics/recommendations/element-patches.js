import { withElement, copyElement } from "../track/elements.js";

/**
 * Parches por elemento del trazado: cada uno devuelve `{ track }` con el
 * elemento cambiado, para que las correcciones apunten al loop, la colina o
 * el punto que falla y no a un parámetro global.
 */

/**
 * @typedef {import("../track/elements.js").TrackElement} TrackElement
 * @typedef {import("../config.js").SimulationConfig} SimulationConfig
 */

/** @param {number} value @param {number} digits */
function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

/**
 * Índices de los puntos con loop, en orden (el loop N es el N-ésimo).
 * @param {ReadonlyArray<TrackElement>} track
 */
export function loopElements(track) {
  return track.flatMap((element, index) => (element.type === "point" && element.loop ? [index] : []));
}

/**
 * Índices de las colinas, en orden.
 * @param {ReadonlyArray<TrackElement>} track
 */
export function hillElements(track) {
  return track.flatMap((element, index) => (element.type === "hill" ? [index] : []));
}

/**
 * Elemento del loop de un tramo «Loop N», o null.
 * @param {ReadonlyArray<TrackElement>} track
 * @param {string} section
 */
export function loopElementForSection(track, section) {
  const match = /^Loop (\d+)/.exec(section);
  return match ? (loopElements(track)[Number(match[1]) - 1] ?? null) : null;
}

/**
 * Elemento de la cresta más cercana a la coordenada s, o null si no hay crestas.
 * @param {import("../track/builder.js").Track} built Trazado construido.
 * @param {number} distance
 */
export function crestElementNear(built, distance) {
  const crestMarkers = built.markers.filter(marker => marker.role === "crest");
  const crestNodes = built.nodes.filter(node => node.role === "crest");
  if (!crestMarkers.length) return null;

  let best = 0;
  crestMarkers.forEach((marker, index) => {
    if (Math.abs(marker.distance - distance) < Math.abs(crestMarkers[best].distance - distance)) best = index;
  });

  return crestNodes[best]?.element ?? null;
}

/**
 * Cambia un elemento.
 * @param {SimulationConfig} config
 * @param {number} index
 * @param {import("../track/elements.js").ElementChanges} changes
 */
export function patchElement(config, index, changes) {
  return { track: withElement(config.track, index, changes) };
}

/**
 * Escala la altura y el radio en la cima del loop de un punto.
 * @param {SimulationConfig} config
 * @param {number} index
 * @param {number} heightFactor
 * @param {number} radiusFactor
 */
export function scaleLoop(config, index, heightFactor, radiusFactor) {
  const element = /** @type {import("../track/elements.js").PointElement} */ (config.track[index]);
  const loop = /** @type {{height: number, topRadius: number}} */ (element.loop);
  return patchElement(config, index, { loop: { height: round(loop.height * heightFactor), topRadius: round(loop.topRadius * radiusFactor) } });
}

/**
 * Estira el trazado: todas las x por el mismo factor (reemplaza al escalado de W).
 * @param {SimulationConfig} config
 * @param {number} factor
 */
export function stretchTrack(config, factor) {
  return {
    track: config.track.map(element => {
      const copy = copyElement(element);
      return "x" in copy ? { ...copy, x: round(copy.x * factor, 3) } : copy;
    })
  };
}

/**
 * Baja las alturas de los puntos interiores (suaviza el perfil).
 * @param {SimulationConfig} config
 * @param {number} factor
 */
export function lowerPoints(config, factor) {
  return {
    track: config.track.map(element => (element.type === "point" ? { ...copyElement(element), y: round(element.y * factor, 3) } : copyElement(element)))
  };
}

/**
 * Escala todos los loops a la vez.
 * @param {SimulationConfig} config
 * @param {number} factor
 */
export function scaleAllLoops(config, factor) {
  return {
    track: config.track.map(element =>
      element.type === "point" && element.loop
        ? { ...copyElement(element), loop: { height: round(element.loop.height * factor), topRadius: round(element.loop.topRadius * factor) } }
        : copyElement(element)
    )
  };
}
