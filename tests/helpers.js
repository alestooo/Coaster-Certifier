import { runSimulation, buildTrack } from "../src/physics/index.js";

/** Configuración base sin pérdidas usada por las pruebas analíticas. */
export const IDEAL = Object.freeze({
  mass: 500,
  gravity: 9.81,
  friction: 0,
  initialSpeed: 0,
  brakeMode: "station",
  brakeDeceleration: 5,
  brakingLength: 100,
  maxLoad: 10,
  contactModel: "strict",
  maxTime: 120
});

/**
 * Ejecuta la simulación y devuelve el run junto con el trazado.
 * @param {Record<string, unknown>} overrides
 * @param {Record<string, unknown>} [options]
 */
export function simulate(overrides, options = {}) {
  const config = { ...IDEAL, ...overrides };
  return { ...runSimulation(config, options), track: buildTrack(config) };
}

/**
 * Primer par de estados consecutivos que encierra la coordenada s.
 * @param {any[]} history
 * @param {number} distance
 */
export function bracketAtDistance(history, distance) {
  for (let index = 1; index < history.length; index++) {
    if (history[index - 1].distance <= distance && history[index].distance >= distance) {
      return [history[index - 1], history[index]];
    }
  }

  throw new Error(`El historial nunca alcanza s = ${distance}`);
}

/**
 * Tiempo interpolado linealmente en el que el tren pasa por s.
 * @param {any[]} history
 * @param {number} distance
 */
export function timeAtDistance(history, distance) {
  const [before, after] = bracketAtDistance(history, distance);
  const fraction = (distance - before.distance) / (after.distance - before.distance);
  return before.time + fraction * (after.time - before.time);
}

/**
 * Congela recursivamente un objeto (para comprobar que no se muta).
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}
