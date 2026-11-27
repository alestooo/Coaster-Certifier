/**
 * Lanzador LSM: empuje F = min(m·a_máx, P/v) hacia adelante. Con fuerza
 * constante hasta la rapidez v₁ = P/(m·a_máx) y, desde ahí, potencia
 * constante. Funciones puras, en unidades SI.
 */

import { REST_SPEED_EPSILON } from "../constants.js";

/**
 * Empuje del lanzador (N), siempre hacia adelante. En reposo (o casi) vale
 * m·a_máx: nunca P/0.
 * @param {number} mass Masa (kg).
 * @param {number} power Potencia P (W).
 * @param {number} maxAcceleration Aceleración máxima a_máx (m/s²).
 * @param {number} velocity Velocidad (m/s).
 * @returns {number}
 */
export function boosterForce(mass, power, maxAcceleration, velocity) {
  const limit = mass * maxAcceleration;
  const speed = Math.abs(velocity);
  return speed < REST_SPEED_EPSILON ? limit : Math.min(limit, power / speed);
}

/**
 * Trabajo ideal de un lanzador recorrido entero sobre vía plana sin
 * pérdidas, entrando con `entrySpeed`: primero fuerza constante hasta
 * v₁ = P/(m·a_máx), después v³ = v₁³ + 3·(P/m)·Δs.
 * @param {{start: number, end: number, power?: number, maxAcceleration?: number}} zone
 * @param {number} mass Masa (kg).
 * @param {number} entrySpeed Rapidez de entrada (m/s).
 * @returns {{work: number, exitSpeed: number}}
 */
export function boosterWork(zone, mass, entrySpeed) {
  const power = zone.power ?? 0;
  const acceleration = zone.maxAcceleration ?? 0;
  const length = zone.end - zone.start;
  const entry = Math.max(0, entrySpeed);
  const switchSpeed = power / (mass * acceleration);
  const forceStretch = Math.min(length, Math.max(0, (switchSpeed ** 2 - entry ** 2) / (2 * acceleration)));
  const afterForce = Math.sqrt(entry ** 2 + 2 * acceleration * forceStretch);
  const exitSpeed = forceStretch >= length ? afterForce : Math.cbrt(afterForce ** 3 + 3 * (power / mass) * (length - forceStretch));

  return { work: 0.5 * mass * (exitSpeed ** 2 - entry ** 2), exitSpeed };
}
