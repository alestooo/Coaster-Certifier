/**
 * Tren articulado: N carros rígidos de masa m/N sobre la coordenada s. El
 * delantero está en s y el carro i en s − i·d. Cada carro tiene su peso, su
 * normal (y por lo tanto su fuerza g y su rodadura) y recibe las fuerzas de
 * la zona en la que está; el aire actúa una vez, sobre el tren. Los carros
 * que todavía están detrás de A van por la rampa de la subida (o esperan en
 * el andén si no hay subida), y mientras alguno está en la cadena el tren no
 * baja de la rapidez de la cadena: la cadena lo sostiene y tira.
 */
import { geometryAt } from "../track/geometry.js";
import { REST_SPEED_EPSILON } from "../constants.js";
import { boosterForce } from "./booster.js";
import {
  normalForce,
  loadFactor,
  normalAcceleration,
  gravityTangential,
  frictionMagnitude,
  springForce,
  damperForce,
  airDragForce
} from "./kinematics.js";

/**
 * @typedef {Object} CarState
 * @property {number} distance Coordenada s del carro (m).
 * @property {number} x
 * @property {number} y
 * @property {number} angle Inclinación (rad).
 * @property {string} kind Tipo de tramo («lift» y «platform» detrás de A).
 * @property {number} normal Fuerza normal sobre el carro (N).
 * @property {number} load Fuerza g del carro (g).
 */

/**
 * Geometría de un carro. Detrás de A (s < 0) va por la rampa recta de la
 * subida, con su ángulo, o por el andén horizontal a la altura de A.
 * @param {any} track
 * @param {import("../config.js").SimulationConfig} config
 * @param {number} distance
 */
function carGeometry(track, config, distance) {
  if (distance >= 0) return geometryAt(track, distance);

  const behind = -distance;
  const a = geometryAt(track, 0);
  const lift = track.lift;

  if (!lift) return { x: a.x - behind, y: a.y, angle: 0, curvature: 0, kind: "platform", section: "Estación", segmentIndex: -1 };

  const y = a.y - behind * Math.sin(lift.angle);
  // Más allá del pie de la rampa, el tramo de embarque a nivel del suelo.
  if (y <= 0) return { x: a.x - behind * Math.cos(lift.angle), y: 0, angle: 0, curvature: 0, kind: "lift", section: "Subida", segmentIndex: -1 };
  return { x: a.x - behind * Math.cos(lift.angle), y, angle: lift.angle, curvature: 0, kind: "lift", section: "Subida", segmentIndex: -1 };
}

/**
 * Zona (lanzador o frenos de ajuste) que contiene s: [inicio, fin).
 * @param {any} track
 * @param {number} distance
 */
function zoneOf(track, distance) {
  for (const zone of track.zones ?? []) {
    if (distance >= zone.start && distance < zone.end) return zone;
  }
  return null;
}

/**
 * Fuerza resistiva con signo (igual que en forces.js): opuesta al movimiento,
 * o estática en reposo hasta su límite.
 * @param {number} velocity @param {number} drive @param {number} limit
 */
function resistive(velocity, drive, limit) {
  if (Math.abs(velocity) < REST_SPEED_EPSILON) return -Math.sign(drive) * Math.min(Math.abs(drive), limit);
  return -Math.sign(velocity) * limit;
}

/**
 * Fuerzas del tren articulado en la posición s (carro delantero) con
 * velocidad v. `membershipAt` decide en qué zona está cada carro (el paso
 * que llega a un borde usa las posiciones del inicio del paso).
 * @param {any} track
 * @param {import("../config.js").SimulationConfig} config
 * @param {number} distance
 * @param {number} velocity
 * @param {{membershipAt?: number, lean?: boolean}} [options] `lean`: solo los escalares (derivada de RK4), sin el detalle por carro.
 */
export function trainForces(track, config, distance, velocity, options = {}) {
  const count = config.trainCars;
  const spacing = config.carSpacing;
  const mass = config.mass / count;
  const g = config.gravity;
  const membership = options.membershipAt ?? distance;
  const strict = config.contactModel !== "safety-wheels";

  let gravity = 0;
  let frictionLimit = 0;
  let contactNormal = 0;
  let inBooster = false;
  let inTrim = false;
  let trim = 0;
  let brakeLimit = 0;
  let onChain = false;
  let heightSum = 0;
  /** Lanzadores con carros adentro y cuántos: el empuje del lanzador es min(k·m·a_máx, P/v). */
  /** @type {any[]} */
  const boosterZones = [];
  /** @type {number[]} */
  const boosterCounts = [];
  // La derivada de RK4 pide solo los escalares (`lean`): el detalle por carro se arma para el estado.
  /** @type {CarState[] | null} */
  const cars = options.lean ? null : [];
  /** @type {any} */
  let leadGeometry = null;
  /** @type {any} */
  let leadZone = null;
  let maxLoad = -Infinity;
  let minLoad = Infinity;
  let minNormal = Infinity;
  let minLoopNormal = Infinity;

  for (let index = 0; index < count; index++) {
    const carDistance = distance - index * spacing;
    const memberDistance = membership - index * spacing;
    const geometry = carGeometry(track, config, carDistance);
    const normal = normalForce(mass, g, geometry.angle, geometry.curvature, velocity);
    const load = loadFactor(normal, mass, g);
    const zone = zoneOf(track, memberDistance);

    if (index === 0) {
      leadGeometry = geometry;
      leadZone = zone;
    }

    if (cars) cars.push({ distance: carDistance, x: geometry.x, y: geometry.y, angle: geometry.angle, kind: geometry.kind, normal, load });
    if (load > maxLoad) maxLoad = load;
    if (load < minLoad) minLoad = load;
    if (normal < minNormal) minNormal = normal;
    if (geometry.kind === "loop" && normal < minLoopNormal) minLoopNormal = normal;
    gravity += gravityTangential(mass, g, geometry.angle);
    const contact = strict ? Math.max(0, normal) : Math.abs(normal);
    contactNormal += contact;
    frictionLimit += frictionMagnitude(config.friction, contact);
    heightSum += geometry.y;

    if (zone?.kind === "booster") {
      inBooster = true;
      const slot = boosterZones.indexOf(zone);
      if (slot < 0) {
        boosterZones.push(zone);
        boosterCounts.push(1);
      } else {
        boosterCounts[slot] += 1;
      }
    }
    if (zone?.kind === "trim") {
      inTrim = true;
      trim += -(zone.damping ?? 0) * velocity;
    }
    if (config.brakeMode === "station" && memberDistance >= track.brakeStart) brakeLimit += mass * config.brakeDeceleration;
    if (memberDistance < 0 && track.lift) onChain = true;
  }

  let booster = 0;
  for (let slot = 0; slot < boosterZones.length; slot++) {
    const zone = boosterZones[slot];
    booster += boosterForce(boosterCounts[slot] * mass, zone.power ?? 0, zone.maxAcceleration ?? 0, velocity);
  }

  const compression = config.brakeMode === "spring" ? Math.max(0, distance - track.brakeStart) : 0;
  const spring = springForce(config.springConstant, compression);
  const damper = damperForce(config.springDamping, velocity, compression);
  const air = airDragForce(config.airDensity, config.airDragArea, velocity);
  const drive = gravity + spring + damper + air + booster + trim;
  const friction = resistive(velocity, drive, frictionLimit);
  const brake = resistive(velocity, drive + friction, brakeLimit);
  let tangential = drive + friction + brake;

  // La cadena no deja que el tren baje de su rapidez mientras tiene carros enganchados: aporta lo que falte.
  // Solo hacia adelante: no sostiene a un tren que retrocede.
  let chain = 0;
  if (onChain && velocity >= 0 && velocity <= track.lift.chainSpeed + 1e-9 && tangential < 0) {
    chain = -tangential;
    tangential = 0;
  }

  return {
    geometry: leadGeometry,
    // Normal informada (CSV, tabla A–F, sonda): la del carro más cargado expresada para todo el tren, N = n·m·g,
    // coherente con `load`. El contacto se evalúa con la normal más chica por carro (`minNormal`).
    normal: maxLoad * config.mass * g,
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
    chain,
    zone: leadZone ?? boosterZones[0] ?? null,
    zoneKind: inBooster ? "booster" : inTrim ? "trim" : null,
    tangential,
    acceleration: tangential / config.mass,
    normalAcceleration: normalAcceleration(velocity, leadGeometry.curvature),
    load: maxLoad,
    minLoad,
    minNormal,
    minLoopNormal: Number.isFinite(minLoopNormal) ? minLoopNormal : null,
    meanHeight: heightSum / count,
    cars: cars ?? []
  };
}

/**
 * Altura media de los carros al empezar (t = 0, el delantero en A): da la
 * energía potencial inicial del tren.
 * @param {any} track
 * @param {import("../config.js").SimulationConfig} config
 */
export function trainStartHeight(track, config) {
  let sum = 0;
  for (let index = 0; index < config.trainCars; index++) sum += carGeometry(track, config, -index * config.carSpacing).y;
  return sum / config.trainCars;
}

/**
 * Rapidez del tren al salir: con subida, los carros de atrás todavía van en
 * la cadena, así que el tren se mueve al menos a la rapidez de la cadena.
 * @param {any} track
 * @param {import("../config.js").SimulationConfig} config
 */
export function trainStartSpeed(track, config) {
  return config.trainCars > 1 && track.lift ? Math.max(config.initialSpeed, track.lift.chainSpeed) : config.initialSpeed;
}
