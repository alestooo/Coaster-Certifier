import { resolveConfig } from "../config.js";
import { buildTrack } from "../track/builder.js";
import { MAX_BRAKE_DECELERATION } from "../constants.js";
import { summarizeRun } from "./summary.js";

/**
 * @typedef {Object} DesignCheck
 * @property {string} id
 * @property {string} name Condición evaluada.
 * @property {boolean} ok
 * @property {"error"|"warning"} severity
 * @property {string} formula Expresión usada.
 * @property {string} detail Valores numéricos.
 */

/**
 * Condiciones mínimas de diseño por conservación de la energía (sin
 * fricción). Son necesarias pero no suficientes: anticipan trazados
 * imposibles antes de simular.
 *
 * @param {Partial<import("../config.js").SimulationConfig>} input
 * @returns {DesignCheck[]}
 */
export function checkDesignConditions(input) {
  const config = resolveConfig(input);
  const track = buildTrack(config);
  const g = config.gravity;
  const head = config.initialHeight + config.initialSpeed ** 2 / (2 * g);

  /** @type {DesignCheck[]} */
  const checks = [];

  for (const loop of track.loops) {
    const required = loop.y + loop.height + loop.topRadius / 2;

    checks.push({
      id: `loop-${loop.section}`,
      name: `Energía suficiente para mantener contacto en la cima del ${loop.section.toLowerCase()}`,
      ok: head >= required,
      severity: "error",
      formula: "H + v₀²/(2g) ≥ h_L + R/2",
      detail: `${head.toFixed(2)} m frente a ${required.toFixed(2)} m requeridos`
    });
  }

  track.nodes
    .filter(node => node.role === "crest")
    .forEach((crest, index, crests) => {
      const suffix = crests.length > 1 ? ` ${index + 1}` : "";

      checks.push({
        id: `crest-${index + 1}`,
        name: `Energía suficiente para superar la cresta de la colina${suffix}`,
        ok: head > crest.y,
        severity: "error",
        formula: "H + v₀²/(2g) > h_c",
        detail: `${head.toFixed(2)} m frente a ${crest.y.toFixed(2)} m de la cresta`
      });
    });

  if (config.brakeMode === "station") {
    const idealSpeedSquared = 2 * g * config.initialHeight + config.initialSpeed ** 2;
    const capacity = 2 * config.brakeDeceleration * config.brakingLength;

    checks.push({
      id: "brake-capacity",
      name: "Capacidad de frenado incluso sin pérdidas por fricción",
      ok: idealSpeedSquared <= capacity,
      severity: "warning",
      formula: "v_E² ≤ 2·a_f·d_f",
      detail: `v_E² ideal = ${idealSpeedSquared.toFixed(1)} m²/s² frente a ${capacity.toFixed(1)} m²/s² disponibles`
    });

    checks.push({
      id: "brake-comfort",
      name: "Desaceleración de frenado tolerable",
      ok: config.brakeDeceleration <= MAX_BRAKE_DECELERATION,
      severity: "error",
      formula: "a_f ≤ 1 g",
      detail: `${config.brakeDeceleration.toFixed(2)} m/s² frente a ${MAX_BRAKE_DECELERATION} m/s²`
    });
  } else {
    const idealEnergy = config.mass * g * config.initialHeight + 0.5 * config.mass * config.initialSpeed ** 2;
    const compression = Math.sqrt((2 * idealEnergy) / config.springConstant);

    checks.push({
      id: "spring-capacity",
      name: "Compresión del resorte sin pérdidas por fricción",
      ok: compression <= config.maxCompression,
      severity: "warning",
      formula: "√(2·E₀/k) ≤ x_máx",
      detail: `${compression.toFixed(2)} m frente a ${config.maxCompression.toFixed(2)} m permitidos`
    });
  }

  return checks;
}

/**
 * Explica por qué la simulación no terminó detenida en la estación.
 * @param {any} final
 * @param {import("../track/builder.js").Track} track
 */
function completionViolation(final, track) {
  if (final.status === "stalled") {
    return {
      code: "incomplete",
      condition: "Recorrido completo: el tren debe llegar a la zona de frenado",
      time: final.time,
      section: final.section,
      position: final.distance,
      x: final.position.x,
      y: final.position.y,
      value: final.distance,
      limit: track.brakeStart,
      unit: "m",
      comparison: "≥"
    };
  }

  if (final.status === "running") {
    return {
      code: "unfinished",
      condition: "La simulación no concluyó dentro del tiempo observado",
      time: final.time,
      section: final.section,
      position: final.distance,
      x: final.position.x,
      y: final.position.y,
      value: final.time,
      limit: final.time,
      unit: "s",
      comparison: "<"
    };
  }

  return null;
}

/**
 * @typedef {Object} Verdict
 * @property {boolean} approved
 * @property {string} status Estado final de la simulación.
 * @property {import("../evaluation/criteria.js").ViolationEvent[]} violations
 * @property {DesignCheck[]} designChecks
 * @property {ReturnType<typeof summarizeRun>} summary
 * @property {string[]} reasons Motivos legibles del dictamen.
 */

/**
 * Emite el dictamen de aprobación o rechazo a partir del historial.
 *
 * Aprueba únicamente si el tren termina detenido dentro de la estación
 * sin ningún incumplimiento registrado.
 *
 * @param {ReadonlyArray<any>} history Historial de estados consecutivos.
 * @param {Partial<import("../config.js").SimulationConfig>} input
 * @returns {Verdict}
 */
export function evaluateRun(history, input) {
  const config = resolveConfig(input);
  const track = buildTrack(config);
  const final = history[history.length - 1];
  const summary = summarizeRun(history, config, track);

  const violations = [...final.events];
  const completion = final.events.length === 0 ? completionViolation(final, track) : null;

  if (completion) violations.push(completion);

  const completed = ["finished", "stopped"].includes(final.status);
  const approved = completed && violations.length === 0;

  const reasons = approved
    ? [
        `El tren completó el recorrido y quedó detenido a ${final.distance.toFixed(2)} m, dentro de la zona de frenado.`,
        `Carga máxima ${summary.maxLoad.value.toFixed(2)} g y mínima ${summary.minLoad.value.toFixed(2)} g, dentro de [${config.minLoad}, ${config.maxLoad}] g.`,
        `Fuerza normal mínima ${summary.minNormal.value.toFixed(1)} N (${summary.minNormal.section}).`
      ]
    : violations.map(
        violation =>
          `${violation.condition}: ${violation.value.toFixed(3)} ${violation.unit} ` +
          `(límite ${violation.comparison} ${violation.limit.toFixed(3)} ${violation.unit}) ` +
          `en ${violation.section}, s = ${violation.position.toFixed(2)} m, t = ${violation.time.toFixed(3)} s.`
      );

  return {
    approved,
    status: final.status,
    violations,
    designChecks: checkDesignConditions(config),
    summary,
    reasons
  };
}
