import { CRITERIA } from "../evaluation/criteria.js";
import { MAX_BRAKE_DECELERATION } from "../constants.js";
import { CONFIG_LIMITS } from "../config.js";
import { maxOf } from "../utils.js";

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
  const code = violations[0]?.code;
  const hasLoop = run.track.loops.length > 0;
  const loop = run.track.loops[0];
  const head = config.initialHeight + config.initialSpeed ** 2 / (2 * g);
  const lossHead = summary.dissipatedEnergy / (config.mass * g);

  /** @type {Record<string, unknown>[]} */
  const patches = [];

  switch (code) {
    case CRITERIA.CONTACT:
    case CRITERIA.LOOP_CONTACT: {
      if (hasLoop && violations[0].section.startsWith("Loop")) {
        const required = loop.y + loop.height + loop.topRadius / 2 + lossHead;
        patches.push({ initialHeight: round(required * MARGIN) });
        patches.push({ initialHeight: round(required * MARGIN * 1.1) });

        const scale = (head - lossHead) / (loop.height + loop.topRadius / 2) / MARGIN;

        if (scale > 0.2 && scale < 1) {
          patches.push({
            loopHeight: round(config.loopHeight * scale),
            loopTopRadius: round(config.loopTopRadius * scale)
          });
        }
      } else {
        const crest = summary.criticalPoints.find(point => point.role === "crest");
        const speedSquared = (crest?.speed ?? summary.maxSpeed.value) ** 2;

        patches.push({ hillCrestRadius: round((speedSquared / g) * MARGIN) });
        patches.push({ hillCrestRadius: round((speedSquared / g) * MARGIN * 1.2) });
      }
      break;
    }

    case CRITERIA.MIN_LOAD: {
      const crest = summary.criticalPoints.find(point => point.role === "crest");
      const speedSquared = (crest?.speed ?? summary.maxSpeed.value) ** 2;
      const allowed = 1 - config.minLoad;

      patches.push({ hillCrestRadius: round((speedSquared / (g * allowed)) * MARGIN) });
      patches.push({ hillHeight: round(config.hillHeight * 1.25) });
      break;
    }

    case CRITERIA.MAX_LOAD: {
      const allowed = config.maxLoad - 1;
      const speedSquared = summary.maxSpeed.value ** 2;

      if (hasLoop) {
        // En la familia de loops usada R_B = h_L − R: un R menor agranda la base.
        const bottomRadius = (speedSquared / (g * allowed)) * MARGIN;
        const topRadius = config.loopHeight - bottomRadius;

        if (topRadius >= 0.05 * config.loopHeight) {
          patches.push({ loopTopRadius: round(topRadius) });
        }

        patches.push({
          loopHeight: round(config.loopHeight * MARGIN * 1.1),
          loopTopRadius: round(config.loopTopRadius * MARGIN * 1.1)
        });
      }

      patches.push({ initialHeight: round(config.initialHeight / MARGIN ** 2) });
      patches.push({ trackWidth: round(config.trackWidth * MARGIN * 1.2) });
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

      // Con una colina, bajarla también alcanza: que la cresta quede por debajo de la energía disponible.
      if (["valley", "reference"].includes(config.mapId) && config.hillHeight > 0) {
        const lower = (head - lossHead - CLEARANCE_M) / MARGIN;
        if (lower > 0 && lower < config.hillHeight) patches.push({ hillHeight: round(lower) });
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

  return patches;
}
