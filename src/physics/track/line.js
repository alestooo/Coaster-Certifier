/**
 * Tramo rectilíneo entre dos nodos (plano inclinado o recta horizontal).
 * Curvatura nula; ángulo constante.
 */

/**
 * @param {{x: number, y: number}} start Nodo inicial (m).
 * @param {{x: number, y: number}} end Nodo final (m).
 * @returns {{length: number, angle: number}} Longitud (m) e inclinación (rad).
 */
export function lineMetrics(start, end) {
  return {
    length: Math.hypot(end.x - start.x, end.y - start.y),
    angle: Math.atan2(end.y - start.y, end.x - start.x)
  };
}

/**
 * Punto sobre un tramo recto a una distancia local dada.
 *
 * @param {{x: number, y: number, angle: number}} segment
 * @param {number} localDistance Distancia desde el inicio del tramo (m).
 * @returns {import("./hermite.js").CurvePoint}
 */
export function linePoint(segment, localDistance) {
  return {
    x: segment.x + localDistance * Math.cos(segment.angle),
    y: segment.y + localDistance * Math.sin(segment.angle),
    angle: segment.angle,
    curvature: 0
  };
}
