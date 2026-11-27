import { compileElements } from "./elements.js";

export { hillHalfWidth } from "./elements.js";

/**
 * Nodos del trazado: los elementos de `config.track` compilados.
 *
 * Cada nodo es un punto (x, y) en metros. Un nodo con `loopHeight > 0`
 * ancla un loop en su posición; un nodo con `role: "crest"` es una cresta.
 */

/**
 * @typedef {Object} TrackNode
 * @property {number} x Posición horizontal (m).
 * @property {number} y Altura (m).
 * @property {number} [loopHeight] Altura del loop anclado (m).
 * @property {number} [loopTopRadius] Radio en la cima del loop (m).
 * @property {"start"|"valley"|"crest"|"end"|"plain"} [role]
 * @property {number} [element] Índice del elemento del trazado que generó el nodo.
 * @property {boolean} [line] El tramo que llega a este nodo es recto.
 */

/**
 * @param {import("../config.js").SimulationConfig} config
 * @returns {TrackNode[]}
 */
export function layoutNodes(config) {
  return compileElements(config.track, config.initialHeight);
}
