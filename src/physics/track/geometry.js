import { segmentPoint } from "./builder.js";

/**
 * @typedef {Object} TrackGeometry
 * @property {number} x Posición horizontal (m).
 * @property {number} y Altura (m).
 * @property {number} angle Inclinación θ de la tangente (rad).
 * @property {number} curvature Curvatura con signo κ (1/m).
 * @property {string} section Nombre del tramo.
 * @property {number} segmentIndex Índice del tramo.
 * @property {string} kind Tipo de tramo.
 */

/**
 * Índice del tramo que contiene la coordenada s (búsqueda binaria).
 * @param {import("./builder.js").Track} track
 * @param {number} distance
 */
function segmentIndexAt(track, distance) {
  const segments = track.segments;
  let low = 0;
  let high = segments.length - 1;

  while (low < high) {
    const middle = (low + high) >> 1;

    if (distance < segments[middle].end) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  return low;
}

/**
 * Geometría de la vía en la coordenada de recorrido s.
 *
 * Para s < 0 se prolonga la tangente inicial (se usa para dibujar
 * vagones traseros); para s mayor que la longitud total se devuelve
 * el final de la zona de frenado.
 *
 * @param {import("./builder.js").Track} track
 * @param {number} distance Coordenada s (m).
 * @returns {TrackGeometry}
 */
export function geometryAt(track, distance) {
  if (distance < 0) {
    const first = track.segments[0];
    const start = segmentPoint(first, 0);

    return {
      ...start,
      x: start.x + distance * Math.cos(start.angle),
      y: start.y + distance * Math.sin(start.angle),
      section: first.section,
      segmentIndex: 0,
      kind: first.kind
    };
  }

  const index = segmentIndexAt(track, distance);
  const segment = track.segments[index];
  const local = Math.min(segment.length, distance - segment.start);

  return {
    ...segmentPoint(segment, local),
    section: segment.section,
    segmentIndex: index,
    kind: segment.kind
  };
}
