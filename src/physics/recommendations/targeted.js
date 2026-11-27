import { CRITERIA } from "../evaluation/criteria.js";
import { MAX_BRAKE_DECELERATION } from "../constants.js";
import { CONFIG_LIMITS } from "../config.js";
import { ZONE_LIMITS } from "../track/elements.js";
import { boosterWork } from "../dynamics/booster.js";
import { geometryAt } from "../track/geometry.js";
import { maxOf } from "../utils.js";
import { loopElements, loopElementForSection, crestElementNear, patchElement, scaleLoop, stretchTrack } from "./element-patches.js";

/** Margen multiplicativo aplicado a las correcciones calculadas. */
const MARGIN = 1.1;

/** Fracciones del largo máximo de la zona que se prueban cuando la zona sola no alcanza. */
const BRAKE_LENGTH_FRACTIONS = [1, 0.8, 0.6];

/** Altura extra sobre el obstáculo que se suma a las pérdidas (m). */
const CLEARANCE_M = 0.5;

/** @param {number} value @param {number} digits */
function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

/**
 * Candidatas calculadas a partir de la física del fallo observado.
 * Cada una corrige la causa directa con un margen del 10 %; luego el
 * buscador las verifica simulando el recorrido completo.
 *
 * @param {import("../config.js").SimulationConfig} config
 * @param {import("../run.js").SimulationRun} run Ejecución original fallida.
 * @returns {Record<string, unknown>[]} Parches de configuración.
 */
export function targetedPatches(config, run) {
  const { summary, violations } = run.verdict;
  const g = config.gravity;
  const violation = violations[0];
  const code = violation?.code;
  // El loop y la cresta que fallan, como elementos del trazado.
  const failingLoop = violation ? loopElementForSection(config.track, violation.section) : null;
  const targetLoop = failingLoop ?? loopElements(config.track)[0] ?? null;
  const loop = run.track.loops.find(candidate => candidate.section === violation?.section) ?? run.track.loops[0];
  const crestElement = violation ? crestElementNear(run.track, violation.position) : null;
  const crest = crestElement === null ? null : config.track[crestElement];
  const head = config.initialHeight + config.initialSpeed ** 2 / (2 * g);
  const lossHead = summary.dissipatedEnergy / (config.mass * g);

  /** @type {Record<string, unknown>[]} */
  const patches = [];

  switch (code) {
    case CRITERIA.CONTACT:
    case CRITERIA.LOOP_CONTACT: {
      if (failingLoop !== null && loop) {
        const required = loop.y + loop.height + loop.topRadius / 2 + lossHead;
        patches.push({ initialHeight: round(required * MARGIN) });
        patches.push({ initialHeight: round(required * MARGIN * 1.1) });

        const scale = (head - lossHead) / (loop.height + loop.topRadius / 2) / MARGIN;

        if (scale > 0.2 && scale < 1) patches.push(scaleLoop(config, failingLoop, scale, scale));
      } else if (crest && crestElement !== null) {
        const critical = summary.criticalPoints.find(point => point.role === "crest");
        const speedSquared = (critical?.speed ?? summary.maxSpeed.value) ** 2;

        if (crest.type === "hill") {
          patches.push(patchElement(config, crestElement, { crestRadius: round((speedSquared / g) * MARGIN) }));
          patches.push(patchElement(config, crestElement, { crestRadius: round((speedSquared / g) * MARGIN * 1.2) }));
        } else if (crest.type === "point") {
          patches.push(patchElement(config, crestElement, { y: round(crest.y * 0.8, 3) }));
          patches.push(patchElement(config, crestElement, { y: round(crest.y * 0.6, 3) }));
        }
      }
      break;
    }

    case CRITERIA.MIN_LOAD: {
      const critical = summary.criticalPoints.find(point => point.role === "crest");
      const speedSquared = (critical?.speed ?? summary.maxSpeed.value) ** 2;
      const allowed = 1 - config.minLoad;

      if (crest?.type === "hill" && crestElement !== null) {
        patches.push(patchElement(config, crestElement, { crestRadius: round((speedSquared / (g * allowed)) * MARGIN) }));
        patches.push(patchElement(config, crestElement, { height: round(crest.height * 1.25) }));
      } else if (crest?.type === "point" && crestElement !== null) {
        // Una cresta más alta llega más lenta: menos sensación de flotar.
        patches.push(patchElement(config, crestElement, { y: round(crest.y * 1.15, 3) }));
      }
      break;
    }

    case CRITERIA.MAX_LOAD: {
      const allowed = config.maxLoad - 1;
      const speedSquared = summary.maxSpeed.value ** 2;

      if (targetLoop !== null) {
        const current = /** @type {{height: number, topRadius: number}} */ (
          /** @type {import("../track/elements.js").PointElement} */ (config.track[targetLoop]).loop
        );
        // En la familia de loops usada R_B = h_L − R: un R menor agranda la base.
        const bottomRadius = (speedSquared / (g * allowed)) * MARGIN;
        const topRadius = current.height - bottomRadius;

        if (topRadius >= 0.05 * current.height) {
          patches.push(patchElement(config, targetLoop, { loop: { height: current.height, topRadius: round(topRadius) } }));
        }

        patches.push(scaleLoop(config, targetLoop, MARGIN * 1.1, MARGIN * 1.1));
      }

      patches.push({ initialHeight: round(config.initialHeight / MARGIN ** 2) });
      patches.push(stretchTrack(config, MARGIN * 1.2));
      break;
    }

    case CRITERIA.OVERRUN: {
      const entrySpeed = summary.braking.entrySpeed ?? summary.maxSpeed.value;

      if (config.brakeMode === "station") {
        const [, maxLength] = CONFIG_LIMITS.brakingLength;
        const length = (entrySpeed ** 2 / (2 * config.brakeDeceleration)) * MARGIN;
        const deceleration = (entrySpeed ** 2 / (2 * config.brakingLength)) * MARGIN;

        if (length <= maxLength) patches.push({ brakingLength: round(length) });
        if (deceleration <= MAX_BRAKE_DECELERATION) patches.push({ brakeDeceleration: round(deceleration) });

        // Si la zona necesaria pasa del máximo, se alarga lo posible y los frenos aprietan lo que falta.
        if (length > maxLength) {
          for (const fraction of BRAKE_LENGTH_FRACTIONS) {
            const longer = maxLength * fraction;
            const needed = (entrySpeed ** 2 / (2 * longer)) * MARGIN;

            if (longer > config.brakingLength && needed <= MAX_BRAKE_DECELERATION) {
              patches.push({ brakingLength: round(longer), brakeDeceleration: round(needed) });
            }
          }
        }
      } else {
        patches.push({ brakingLength: round(config.brakingLength * MARGIN * 1.3) });
      }
      break;
    }

    case CRITERIA.COMPRESSION: {
      const energy = summary.braking.energyToDissipate ?? summary.initialEnergy;

      patches.push({ springConstant: round(((2 * energy) / config.maxCompression ** 2) * MARGIN, 0) });

      const compression = Math.sqrt((2 * energy) / config.springConstant) * MARGIN;

      if (compression <= config.brakingLength) {
        patches.push({ maxCompression: round(compression) });
      }
      break;
    }

    case CRITERIA.MIN_SPEED: {
      // El obstáculo es lo más alto después de la salida (la cresta que no alcanzó), que
      // puede estar por encima de la altura inicial.
      const obstacle = maxOf(run.track.nodes.slice(1), node => node.y);
      const required = obstacle + lossHead + CLEARANCE_M - config.initialSpeed ** 2 / (2 * g);

      patches.push({ initialHeight: round(required * MARGIN) });
      patches.push({ initialHeight: round(required * MARGIN * 1.15) });
      patches.push({ friction: round(config.friction / 2, 4) });

      // Bajar el obstáculo también alcanza: que su cima quede por debajo de la energía disponible.
      const top = run.track.nodes.slice(1).reduce((best, node) => (node.y > best.y ? node : best));
      const obstacleElement = top.element === undefined ? null : config.track[top.element];
      const lower = (head - lossHead - CLEARANCE_M) / MARGIN;

      if (obstacleElement?.type === "hill" && lower > 0 && lower < obstacleElement.height) {
        patches.push(patchElement(config, /** @type {number} */ (top.element), { height: round(lower) }));
      } else if (obstacleElement?.type === "point" && lower > 0 && lower < obstacleElement.y) {
        patches.push(patchElement(config, /** @type {number} */ (top.element), { y: round(lower, 3) }));
      }
      break;
    }

    case CRITERIA.LAUNCH: {
      // El lanzador empuja más de lo permitido: su aceleración máxima baja por debajo del límite.
      const zone = zoneOfViolation(run.track, violation);
      if (zone) {
        const allowed = config.maxLaunchAcceleration * g;
        patches.push(patchElement(config, zone.element, { maxAcceleration: round(allowed / MARGIN) }));
        patches.push(patchElement(config, zone.element, { maxAcceleration: round(allowed / MARGIN ** 2) }));
      }
      break;
    }

    case CRITERIA.TRIM: {
      // F = c·v: con c más chico la desaceleración c·v/m queda por debajo de 1 g a la misma rapidez.
      const zone = zoneOfViolation(run.track, violation);
      const element = zone ? config.track[zone.element] : null;
      if (zone && element?.type === "trim" && violation.value > 0) {
        const factor = MAX_BRAKE_DECELERATION / (violation.value * g);
        patches.push(patchElement(config, zone.element, { damping: round((element.damping * factor) / MARGIN, 0) }));
        patches.push(patchElement(config, zone.element, { damping: round((element.damping * factor) / MARGIN ** 2, 0) }));
      }
      break;
    }

    case CRITERIA.TIMEOUT: {
      if (config.brakeMode === "spring") {
        // Por debajo del crítico el resorte lo devuelve y puede quedar antes de E (fuera de la zona):
        // el amortiguamiento crítico lo detiene sin rebote dentro de la zona.
        const critical = 2 * Math.sqrt(config.springConstant * config.mass);
        patches.push({ springDamping: round(critical * 0.3, 0) });
        patches.push({ springDamping: round(critical * 0.6, 0) });
        patches.push({ springDamping: round(critical, 0) });
      }
      break;
    }

    default:
      break;
  }

  patches.push(...boosterPowerPatches(config, run, violation, head, lossHead));
  return patches;
}

/**
 * Zona (lanzador o frenos de ajuste) donde ocurrió el incumplimiento.
 * @param {import("../track/builder.js").Track} track
 * @param {{position: number, section: string}} violation
 */
function zoneOfViolation(track, violation) {
  return track.zones.find(zone => zone.name === violation.section) ?? track.zones.find(zone => violation.position >= zone.start && violation.position <= zone.end) ?? null;
}

/** Incumplimientos que se arreglan con más energía. */
const NEEDS_ENERGY = new Set([CRITERIA.LOOP_CONTACT, CRITERIA.MIN_SPEED, "incomplete"]);

/**
 * Verdadero si el incumplimiento se arregla con más energía. Un despegue
 * (`contact`, modo estricto) solo dentro de un loop: en una cresta se pierde
 * el contacto por exceso de rapidez.
 * @param {{code: string, section: string}} violation
 */
const needsEnergy = violation => NEEDS_ENERGY.has(violation.code) || (violation.code === CRITERIA.CONTACT && /^Loop/.test(violation.section));

/**
 * Si al tren le falta energía y hay un lanzador antes del fallo, su potencia
 * (y, si hace falta, su aceleración hasta el límite de la regla) para que
 * salga con la altura que pide el obstáculo más las pérdidas.
 * @param {import("../config.js").SimulationConfig} config
 * @param {import("../run.js").SimulationRun} run
 * @param {any} violation
 * @param {number} head Altura disponible inicial (m).
 * @param {number} lossHead Pérdidas del recorrido como altura (m).
 * @returns {Record<string, unknown>[]}
 */
function boosterPowerPatches(config, run, violation, head, lossHead) {
  if (!violation || !needsEnergy(violation)) return [];

  const zone = [...run.track.zones].reverse().find(candidate => candidate.kind === "booster" && candidate.end <= violation.position);
  if (!zone) return [];

  const g = config.gravity;
  const loop = run.track.loops.find(candidate => candidate.section === violation.section);
  const obstacle = loop
    ? loop.y + loop.height + loop.topRadius / 2
    : Math.max(...run.track.nodes.filter(node => node.y !== undefined && (node.element ?? 0) > zone.element).map(node => node.y), 0);
  const height = geometryAt(run.track, zone.start).y;
  const required = (obstacle + lossHead + CLEARANCE_M) * MARGIN;
  const entrySpeed = Math.sqrt(Math.max(0, 2 * g * (head - height)));
  const neededExit = Math.sqrt(Math.max(0, 2 * g * (required - height)));
  /** @type {number} */
  const maxPower = ZONE_LIMITS.power[1];
  const acceleration = Math.max(zone.maxAcceleration ?? 0, Math.min(config.maxLaunchAcceleration * g / MARGIN, ZONE_LIMITS.maxAcceleration[1]));
  const exitWith = (/** @type {number} */ power, /** @type {number} */ maxAcceleration) =>
    boosterWork({ ...zone, power, maxAcceleration }, config.mass, entrySpeed).exitSpeed;

  /** Potencia mínima (W) con esa aceleración para salir a la rapidez necesaria, o null si no alcanza. */
  const powerFor = (/** @type {number} */ maxAcceleration) => {
    if (exitWith(maxPower, maxAcceleration) < neededExit) return null;
    let low = zone.power ?? 0;
    /** @type {number} */
    let high = maxPower;
    for (let step = 0; step < 40; step++) {
      const middle = (low + high) / 2;
      if (exitWith(middle, maxAcceleration) >= neededExit) high = middle;
      else low = middle;
    }
    return high;
  };

  /** @type {Record<string, unknown>[]} */
  const patches = [];
  const sameAcceleration = powerFor(zone.maxAcceleration ?? 0);
  if (sameAcceleration !== null && sameAcceleration > (zone.power ?? 0)) {
    patches.push(patchElement(config, zone.element, { power: Math.min(maxPower, round(sameAcceleration * MARGIN, 0)) }));
  }

  const stronger = acceleration > (zone.maxAcceleration ?? 0) ? powerFor(acceleration) : null;
  if (stronger !== null) {
    patches.push(patchElement(config, zone.element, { power: Math.min(maxPower, round(stronger * MARGIN, 0)), maxAcceleration: round(acceleration) }));
  }

  return patches;
}
