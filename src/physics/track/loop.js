/**
 * Loop vertical en forma de lágrima.
 *
 * Familia de curvas con un parámetro de forma c ∈ [0, 0,9):
 *
 *   radio de curvatura ρ(θ) = R_ref · (1 + c·cos θ)
 *
 * donde θ es el ángulo de la tangente (0 en la base, π en la cima) y
 * R_ref es el radio de referencia. De ahí resultan:
 *
 *   altura del loop        h_L     = 2·R_ref
 *   radio en la cima       R       = R_ref·(1 − c)
 *   radio en la base       R_B     = R_ref·(1 + c)
 *   longitud del loop      L       = 2π·R_ref      (independiente de c)
 *   desplazamiento de salida Δx    = π·c·R_ref
 *
 * Con c = 0 el loop es una circunferencia. El usuario fija h_L y R, de
 * modo que R_ref = h_L / 2 y c = 1 − 2R / h_L, igual que en el anexo.
 */

const TAU = 2 * Math.PI;

/** Iteraciones de Newton para invertir la longitud de arco s(θ). */
const NEWTON_ITERATIONS = 8;

/**
 * @typedef {Object} LoopSegment
 * @property {"loop"} kind
 * @property {number} x Posición horizontal de la base (m).
 * @property {number} y Altura de la base (m).
 * @property {number} reference Radio de referencia R_ref (m).
 * @property {number} shape Parámetro de forma c (adimensional).
 * @property {number} height Altura h_L (m).
 * @property {number} topRadius Radio en la cima (m).
 * @property {number} bottomRadius Radio en la base (m).
 * @property {number} length Longitud total (m).
 * @property {number} exitX Posición horizontal de salida (m).
 * @property {number} topDistance Distancia local hasta la cima (m).
 * @property {string} section Nombre del tramo.
 */

/**
 * Construye un loop a partir de la altura y el radio en la cima.
 *
 * @param {{x: number, y: number, height: number, topRadius: number, section: string}} input
 * @returns {LoopSegment}
 */
export function createLoop({ x, y, height, topRadius, section }) {
  const reference = height / 2;
  const shape = 1 - topRadius / reference;

  return {
    kind: "loop",
    x,
    y,
    reference,
    shape,
    height,
    topRadius,
    bottomRadius: reference * (1 + shape),
    length: TAU * reference,
    exitX: x + Math.PI * shape * reference,
    topDistance: Math.PI * reference,
    section
  };
}

/**
 * Ángulo θ correspondiente a una distancia local, invirtiendo
 * s(θ) = R_ref·(θ + c·sin θ) con el método de Newton.
 *
 * @param {LoopSegment} loop
 * @param {number} localDistance Distancia desde la base (m).
 * @returns {number} Ángulo θ ∈ [0, 2π].
 */
export function loopAngleAt(loop, localDistance) {
  const target = Math.max(0, Math.min(TAU, localDistance / loop.reference));
  let theta = target;

  for (let iteration = 0; iteration < NEWTON_ITERATIONS; iteration++) {
    theta -=
      (theta + loop.shape * Math.sin(theta) - target) /
      (1 + loop.shape * Math.cos(theta));
  }

  return theta;
}

/**
 * Punto sobre el loop a una distancia local dada.
 *
 * @param {LoopSegment} loop
 * @param {number} localDistance Distancia desde la base (m).
 * @returns {import("./hermite.js").CurvePoint}
 */
export function loopPoint(loop, localDistance) {
  const theta = loopAngleAt(loop, localDistance);
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const { reference, shape } = loop;

  return {
    x: loop.x + reference * (sin + shape * (theta / 2 + Math.sin(2 * theta) / 4)),
    y: loop.y + reference * (1 - cos + (shape * sin * sin) / 2),
    angle: theta,
    curvature: 1 / (reference * (1 + shape * cos))
  };
}

/**
 * Extensión horizontal del loop respecto a su base: [mínimo, máximo] (m).
 *
 * @param {LoopSegment} loop
 * @param {number} [samples]
 * @returns {[number, number]}
 */
export function loopExtent(loop, samples = 64) {
  let min = loop.x;
  let max = loop.x;

  for (let index = 0; index <= samples; index++) {
    const point = loopPoint(loop, (loop.length * index) / samples);

    min = Math.min(min, point.x);
    max = Math.max(max, point.x);
  }

  return [min, max];
}
