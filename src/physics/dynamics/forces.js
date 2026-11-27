import { geometryAt } from "../track/geometry.js";
import { boosterForce } from "./booster.js";
import { trainForces } from "./train.js";
import { REST_SPEED_EPSILON } from "../constants.js";

import {
  normalForce,
  loadFactor,
  normalAcceleration,
  tangentialAcceleration,
  gravityTangential,
  frictionMagnitude,
  springForce,
  damperForce,
  airDragForce
} from "./kinematics.js";

/**
 * @typedef {Object} Forces
 * @property {import("../track/geometry.js").TrackGeometry} geometry Geometría local.
 * @property {number} normal Fuerza normal requerida N (N).
 * @property {number} contactNormal Normal usada para la fricción (N, ≥ 0).
 * @property {number} compression Compresión del resorte x (m).
 * @property {number} gravity Componente tangencial del peso (N).
 * @property {number} spring Fuerza del resorte (N).
 * @property {number} damper Fuerza del amortiguador (N).
 * @property {number} friction Fuerza de fricción con signo (N).
 * @property {number} brake Fuerza de los frenos de estación con signo (N).
 * @property {number} air Resistencia del aire con signo (N).
 * @property {number} booster Empuje del lanzador (N), hacia adelante.
 * @property {number} trim Fuerza de los frenos de ajuste con signo (N).
 * @property {import("../track/builder.js").TrackZone | null} zone Zona en la que está el tren, si está en una.
 * @property {number} tangential Suma de fuerzas tangenciales (N).
 * @property {number} acceleration Aceleración tangencial a_t (m/s²).
 * @property {number} normalAcceleration Aceleración normal a_n = κ·v² (m/s²).
 * @property {number} load Carga n = N/(m·g) (g).
 */

/**
 * Fuerza resistiva con signo: opuesta al movimiento, o estática cuando
 * el tren está en reposo (equilibra la fuerza motriz hasta su límite).
 *
 * @param {number} velocity Velocidad tangencial (m/s).
 * @param {number} drive Fuerza motriz neta a equilibrar (N).
 * @param {number} limit Magnitud máxima de la fuerza (N).
 * @returns {number} Fuerza con signo (N).
 */
export function resistiveForce(velocity, drive, limit) {
  if (Math.abs(velocity) < REST_SPEED_EPSILON) {
    return -Math.sign(drive) * Math.min(Math.abs(drive), limit);
  }

  return -Math.sign(velocity) * limit;
}

/**
 * Zona (lanzador o frenos de ajuste) que contiene la coordenada s: [inicio, fin).
 * @param {import("../track/builder.js").Track} track
 * @param {number} distance
 * @returns {import("../track/builder.js").TrackZone | null}
 */
export function zoneAt(track, distance) {
  for (const zone of track.zones ?? []) {
    if (distance >= zone.start && distance < zone.end) return zone;
  }
  return null;
}

/**
 * Calcula todas las fuerzas tangenciales y la normal en la posición s
 * con velocidad v. Es una función pura: no modifica sus argumentos.
 *
 * @param {import("../track/builder.js").Track} track Trazado construido.
 * @param {import("../config.js").SimulationConfig} config Configuración resuelta.
 * @param {number} distance Coordenada s (m).
 * @param {number} velocity Velocidad tangencial v (m/s), positiva en el sentido de avance.
 * @param {{zone?: import("../track/builder.js").TrackZone | null, membershipAt?: number, lean?: boolean}} [options] `zone` fija la
 *   zona en lugar de buscarla por s (y `membershipAt`, la posición con que se decide la zona de cada carro del tren
 *   articulado): el paso que llega a un borde integra con la fuerza del lado donde está el tren.
 * @returns {Forces}
 */
export function calculateForces(track, config, distance, velocity, options = {}) {
  // Tren de varios carros: fuerzas por carro (con un carro, la partícula de siempre).
  if (config.trainCars > 1) return /** @type {Forces} */ (trainForces(track, config, distance, velocity, options));

  const geometry = geometryAt(track, distance);
  const normal = normalForce(config.mass, config.gravity, geometry.angle, geometry.curvature, velocity);

  const contactNormal =
    config.contactModel === "safety-wheels" ? Math.abs(normal) : Math.max(0, normal);

  const compression =
    config.brakeMode === "spring" ? Math.max(0, distance - track.brakeStart) : 0;

  const gravity = gravityTangential(config.mass, config.gravity, geometry.angle);
  const spring = springForce(config.springConstant, compression);
  const damper = damperForce(config.springDamping, velocity, compression);
  const air = airDragForce(config.airDensity, config.airDragArea, velocity);
  const zone = options.zone === undefined ? zoneAt(track, distance) : options.zone;
  const booster =
    zone?.kind === "booster" ? boosterForce(config.mass, zone.power ?? 0, zone.maxAcceleration ?? 0, velocity) : 0;
  // Frenos de ajuste por corrientes parásitas: F = −c·v, suave en v (se integra con RK4).
  const trim = zone?.kind === "trim" ? -(zone.damping ?? 0) * velocity : 0;
  const drive = gravity + spring + damper + air + booster + trim;

  const friction = resistiveForce(
    velocity,
    drive,
    frictionMagnitude(config.friction, contactNormal)
  );

  const brakeLimit =
    config.brakeMode === "station" && distance >= track.brakeStart
      ? config.mass * config.brakeDeceleration
      : 0;

  const brake = resistiveForce(velocity, drive + friction, brakeLimit);
  const tangential = drive + friction + brake;

  return {
    geometry,
    normal,
    contactNormal,
    compression,
    gravity,
    spring,
    damper,
    friction,
    brake,
    air,
    booster,
    trim,
    zone,
    tangential,
    acceleration: tangentialAcceleration(tangential, config.mass),
    normalAcceleration: normalAcceleration(velocity, geometry.curvature),
    load: loadFactor(normal, config.mass, config.gravity)
  };
}
