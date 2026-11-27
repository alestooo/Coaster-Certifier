/**
 * Subida por cadena: una sola polilínea del suelo hasta A, que usan rieles,
 * cadena, soportes, casa de máquinas, árboles, encuadre y los carros que
 * todavía están detrás de A. A es su punto final y (salvo un empalme de
 * pocos centímetros) el más alto: no hay una cresta falsa antes de A.
 * Su ángulo y la rapidez de la cadena son los del elemento A (`track.lift`).
 * Sin subida (montaña rusa lanzada), el camino es un andén a la altura de A.
 */
import { geometryAt } from "../../physics/track/geometry.js";

/** Radio del empalme visual entre la rampa y la caída en A (m). */
export const LIFT_FILLET_M = 2.5;
/** Avance horizontal de la rampa por cada metro de altura de la subida predefinida (≈ 36,5°). */
export const LIFT_RUN_PER_RISE = 1.35;
/** Rapidez de la cadena predefinida (m/s); la de cada trazado está en `track.lift.chainSpeed`. */
export const CHAIN_SPEED_MPS = 2;
/**
 * Tramo de embarque a nivel de la vía antes del pie de la rampa (m): entra
 * el tren entero (4 carros = 13 m), así ningún carro detrás de A queda en el aire.
 */
export const LIFT_LEAD_IN_M = 15;

/** Lo más que el empalme puede sobresalir por encima de A (m). */
const MAX_FILLET_RISE_M = 0.3;
/** Segmentos con que se dibuja el arco del empalme. */
const FILLET_SEGMENTS = 12;

/**
 * @typedef {{x: number, y: number}} Point
 * @typedef {{points: Point[], base: Point, foot: Point, crest: Point, chain: boolean, chainSpeed: number}} LiftPath
 *   `base`: inicio del tramo de embarque; `foot`: pie de la rampa; `crest`: A; `chain`: si hay cadena (subida).
 */

/** Dirección de la rampa predefinida (rad, hacia arriba y adelante). */
const DEFAULT_RAMP_ANGLE = Math.atan2(1, LIFT_RUN_PER_RISE);

/**
 * Radio del empalme: el nominal, achicado si la caída es tan empinada que
 * sobresaldría más de MAX_FILLET_RISE_M sobre A, o si A está tan baja que
 * el arco empezaría bajo el suelo.
 * @param {number} dropAngle Ángulo de la vía en A (rad, negativo al bajar).
 * @param {number} heightA Altura de A (m).
 * @param {number} rampAngle Ángulo de la rampa (rad).
 */
function filletRadius(dropAngle, heightA, rampAngle) {
  const rise = 1 - Math.cos(dropAngle);
  const byRise = rise > 1e-9 ? MAX_FILLET_RISE_M / rise : Infinity;
  const drop = Math.cos(dropAngle) - Math.cos(rampAngle);
  const byGround = drop > 1e-9 ? heightA / drop : Infinity;
  return Math.max(0, Math.min(LIFT_FILLET_M, byRise, byGround));
}

/**
 * Subida única hasta A.
 * @param {any} track Trazado construido.
 * @returns {LiftPath}
 */
export function liftPath(track) {
  const a = geometryAt(track, 0);
  const crest = { x: a.x, y: a.y };

  // Sin subida: un andén horizontal a la altura de A, donde esperan los carros que van detrás.
  if (track.lift === null) {
    const base = { x: crest.x - LIFT_LEAD_IN_M, y: crest.y };
    return { points: [base, crest], base, foot: base, crest, chain: false, chainSpeed: 0 };
  }

  const rampAngle = track.lift?.angle ?? DEFAULT_RAMP_ANGLE;
  const runPerRise = 1 / Math.tan(rampAngle);
  const dropAngle = Math.min(a.angle, rampAngle);
  const radius = dropAngle < rampAngle ? filletRadius(dropAngle, a.y, rampAngle) : 0;

  // Centro del arco: a la derecha del sentido de marcha en A (curva convexa).
  const center = { x: crest.x + radius * Math.sin(dropAngle), y: crest.y - radius * Math.cos(dropAngle) };
  /** Punto del arco donde la dirección de marcha es `angle`. @param {number} angle */
  const onArc = angle => ({ x: center.x - radius * Math.sin(angle), y: center.y + radius * Math.cos(angle) });

  const arcStart = onArc(rampAngle);
  const foot = { x: arcStart.x - arcStart.y * runPerRise, y: 0 };
  const base = { x: foot.x - LIFT_LEAD_IN_M, y: 0 };
  const arc = Array.from({ length: FILLET_SEGMENTS - 1 }, (_, index) =>
    onArc(rampAngle + ((dropAngle - rampAngle) * (index + 1)) / FILLET_SEGMENTS)
  );
  const points = radius > 0 ? [base, foot, arcStart, ...arc, crest] : [base, foot, crest];

  return { points, base, foot, crest, chain: true, chainSpeed: track.lift?.chainSpeed ?? CHAIN_SPEED_MPS };
}

/**
 * Punto a `distanceBeforeA` metros de A hacia atrás, sobre la subida; más
 * allá de la base sigue por el suelo. `angle` es la dirección de marcha.
 * @param {LiftPath} path
 * @param {number} distanceBeforeA
 * @returns {{x: number, y: number, angle: number}}
 */
export function pointOnLift(path, distanceBeforeA) {
  let remaining = Math.max(0, distanceBeforeA);

  for (let index = path.points.length - 1; index > 0; index--) {
    const to = path.points[index];
    const from = path.points[index - 1];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);

    if (remaining <= length) {
      const t = length > 0 ? remaining / length : 0;
      return { x: to.x + (from.x - to.x) * t, y: to.y + (from.y - to.y) * t, angle };
    }

    remaining -= length;
  }

  return { x: path.base.x - remaining, y: path.base.y, angle: 0 };
}

/**
 * Altura de la subida en la abscisa `x` (0 fuera de ella).
 * @param {LiftPath} path
 * @param {number} x
 */
export function liftHeightAt(path, x) {
  for (let index = 1; index < path.points.length; index++) {
    const from = path.points[index - 1];
    const to = path.points[index];
    if (x < from.x || x > to.x) continue;
    const t = to.x > from.x ? (x - from.x) / (to.x - from.x) : 1;
    return from.y + (to.y - from.y) * t;
  }

  return 0;
}

/**
 * Punto a `distance` metros de la base, a lo largo de la subida, con la
 * dirección de marcha (para cadena, trinquetes y eslabones).
 * @param {LiftPath} path
 * @param {number} distance
 */
export function pointFromBase(path, distance) {
  return pointOnLift(path, liftLength(path) - distance);
}

/**
 * Largo de la subida (m).
 * @param {LiftPath} path
 */
export function liftLength(path) {
  return path.points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - path.points[index].x, point.y - path.points[index].y), 0);
}
