/**
 * Tramo curvo descrito por un polinomio cúbico de Hermite y = y(x).
 *
 * El tramo une dos nodos con una pendiente inicial dada y pendiente
 * final nula, lo que produce valles y crestas suaves (curvatura continua
 * dentro del tramo). La curvatura con signo es positiva en los valles y
 * negativa en las crestas, siguiendo el convenio del anexo.
 */

/**
 * @typedef {Object} CurvePoint
 * @property {number} x Posición horizontal (m).
 * @property {number} y Altura (m).
 * @property {number} angle Inclinación θ de la tangente respecto a x (rad).
 * @property {number} curvature Curvatura con signo κ = dθ/ds (1/m).
 */

/**
 * Evalúa la curva de Hermite en el parámetro u ∈ [0, 1].
 *
 * @param {{x: number, y: number}} start Nodo inicial (m).
 * @param {{x: number, y: number}} end Nodo final (m).
 * @param {number} u Parámetro adimensional del tramo.
 * @param {number} [startSlope] Pendiente dy/dx en el nodo inicial.
 * @returns {CurvePoint}
 */
export function hermitePoint(start, end, u, startSlope = 0) {
  const dx = end.x - start.x;
  const tangent = startSlope * dx;

  const u2 = u * u;
  const u3 = u2 * u;

  const y =
    (2 * u3 - 3 * u2 + 1) * start.y +
    (u3 - 2 * u2 + u) * tangent +
    (-2 * u3 + 3 * u2) * end.y;

  const dy =
    (6 * u2 - 6 * u) * start.y +
    (3 * u2 - 4 * u + 1) * tangent +
    (-6 * u2 + 6 * u) * end.y;

  const ddy =
    (12 * u - 6) * start.y +
    (6 * u - 4) * tangent +
    (-12 * u + 6) * end.y;

  return {
    x: start.x + dx * u,
    y,
    angle: Math.atan2(dy, dx),
    curvature: (dx * ddy) / (dx * dx + dy * dy) ** 1.5
  };
}

/**
 * Tabla acumulada de longitud de arco del tramo, con `samples` subdivisiones.
 * Se usa para convertir la coordenada de recorrido s al parámetro u.
 *
 * @param {{x: number, y: number}} start
 * @param {{x: number, y: number}} end
 * @param {number} startSlope
 * @param {number} samples
 * @returns {number[]} Longitudes acumuladas (m), de 0 a la longitud total.
 */
export function arcLengthTable(start, end, startSlope, samples) {
  const table = [0];
  let previous = hermitePoint(start, end, 0, startSlope);

  for (let index = 1; index <= samples; index++) {
    const point = hermitePoint(start, end, index / samples, startSlope);

    table.push(
      table[index - 1] + Math.hypot(point.x - previous.x, point.y - previous.y)
    );

    previous = point;
  }

  return table;
}

/**
 * Convierte una distancia local sobre el tramo al parámetro u mediante
 * búsqueda binaria e interpolación lineal en la tabla de longitud de arco.
 *
 * @param {number[]} table Tabla de `arcLengthTable`.
 * @param {number} localDistance Distancia desde el inicio del tramo (m).
 * @returns {number} Parámetro u ∈ [0, 1].
 */
export function parameterAt(table, localDistance) {
  const samples = table.length - 1;
  const clamped = Math.max(0, Math.min(table[samples], localDistance));

  let low = 0;
  let high = samples;

  while (high - low > 1) {
    const middle = (low + high) >> 1;

    if (table[middle] < clamped) {
      low = middle;
    } else {
      high = middle;
    }
  }

  const span = table[high] - table[low];
  const fraction = span > 0 ? (clamped - table[low]) / span : 0;

  return (low + fraction) / samples;
}
