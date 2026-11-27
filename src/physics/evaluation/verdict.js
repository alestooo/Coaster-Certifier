import { resolveConfig } from "../config.js";
import { buildTrack } from "../track/builder.js";
import { geometryAt } from "../track/geometry.js";
import { boosterWork } from "../dynamics/booster.js";
import { MAX_BRAKE_DECELERATION } from "../constants.js";
import { summarizeRun } from "./summary.js";

/**
 * @typedef {Object} DesignCheck
 * @property {string} id
 * @property {string} name Condición evaluada.
 * @property {boolean} ok
 * @property {"error"|"warning"} severity
 * @property {string} formula Expresión usada.
 * @property {string} detail Valores numéricos (texto con punto, para el script headless).
 * @property {number} actual Valor del diseño (la interfaz lo escribe con coma).
 * @property {number} limit Valor requerido o disponible, en la misma unidad.
 */

/**
 * Trabajo ideal (J) de los lanzadores que terminan antes de s, en orden:
 * cada uno recibe la rapidez de la energía ideal que llega a su altura.
 * @param {import("../track/builder.js").Track} track
 * @param {import("../config.js").SimulationConfig} config
 * @param {number} baseHead Altura disponible inicial H + v₀²/(2g) (m).
 * @param {number} distance Coordenada s (m).
 */
function launchWork(track, config, baseHead, distance) {
  let work = 0;

  for (const zone of track.zones ?? []) {
    if (zone.kind !== "booster" || zone.end > distance) continue;
    const head = baseHead + work / (config.mass * config.gravity);
    const height = geometryAt(track, zone.start).y;
    // Un lanzador por encima de la energía disponible es inalcanzable: no suma nada.
    if (head < height) continue;
    const entrySpeed = Math.sqrt(2 * config.gravity * (head - height));
    work += boosterWork(zone, config.mass, entrySpeed).work;
  }

  return work;
}

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
  const baseHead = config.initialHeight + config.initialSpeed ** 2 / (2 * g);
  /** Altura disponible ideal hasta s: la inicial más el trabajo de los lanzadores anteriores (sin lanzadores, la de siempre). */
  const headAt = (/** @type {number} */ distance) => {
    const work = launchWork(track, config, baseHead, distance);
    return work > 0 ? baseHead + work / (config.mass * g) : baseHead;
  };
  const totalWork = launchWork(track, config, baseHead, Infinity);

  /** @type {DesignCheck[]} */
  const checks = [];

  for (const loop of track.loops) {
    const required = loop.y + loop.height + loop.topRadius / 2;
    const head = headAt(loop.start);
    const launched = head !== baseHead;

    checks.push({
      id: `loop-${loop.section}`,
      name: `Energía suficiente para mantener contacto en la cima del ${loop.section.toLowerCase()}`,
      ok: head >= required,
      severity: "error",
      formula: launched ? "H + v₀²/(2g) + W_lanz/(m·g) ≥ h_L + R/2" : "H + v₀²/(2g) ≥ h_L + R/2",
      detail: `${head.toFixed(2)} m frente a ${required.toFixed(2)} m requeridos`,
      actual: head,
      limit: required
    });
  }

  track.nodes
    .filter(node => node.role === "crest")
    .forEach((crest, index, crests) => {
      const suffix = crests.length > 1 ? ` ${index + 1}` : "";
      const head = headAt(track.markers.filter(marker => marker.role === "crest")[index]?.distance ?? 0);
      const launched = head !== baseHead;

      checks.push({
        id: `crest-${index + 1}`,
        name: `Energía suficiente para superar la cresta de la colina${suffix}`,
        ok: head > crest.y,
        severity: "error",
        formula: launched ? "H + v₀²/(2g) + W_lanz/(m·g) > h_c" : "H + v₀²/(2g) > h_c",
        detail: `${head.toFixed(2)} m frente a ${crest.y.toFixed(2)} m de la cresta`,
        actual: head,
        limit: crest.y
      });
    });

  if (config.brakeMode === "station") {
    const launched = totalWork > 0 ? (2 * totalWork) / config.mass : 0;
    const idealSpeedSquared = launched > 0 ? 2 * g * config.initialHeight + config.initialSpeed ** 2 + launched : 2 * g * config.initialHeight + config.initialSpeed ** 2;
    const capacity = 2 * config.brakeDeceleration * config.brakingLength;

    checks.push({
      id: "brake-capacity",
      name: "Capacidad de frenado incluso sin pérdidas por fricción",
      ok: idealSpeedSquared <= capacity,
      severity: "warning",
      formula: launched > 0 ? "v_E² ≤ 2·a_f·d_f (v_E ideal con W_lanz)" : "v_E² ≤ 2·a_f·d_f",
      detail: `v_E² ideal = ${idealSpeedSquared.toFixed(1)} m²/s² frente a ${capacity.toFixed(1)} m²/s² disponibles`,
      actual: idealSpeedSquared,
      limit: capacity
    });

    checks.push({
      id: "brake-comfort",
      name: "Desaceleración de frenado tolerable",
      ok: config.brakeDeceleration <= MAX_BRAKE_DECELERATION,
      severity: "error",
      formula: "a_f ≤ 1 g",
      detail: `${config.brakeDeceleration.toFixed(2)} m/s² frente a ${MAX_BRAKE_DECELERATION} m/s²`,
      actual: config.brakeDeceleration,
      limit: MAX_BRAKE_DECELERATION
    });
  } else {
    const baseEnergy = config.mass * g * config.initialHeight + 0.5 * config.mass * config.initialSpeed ** 2;
    const idealEnergy = totalWork > 0 ? baseEnergy + totalWork : baseEnergy;
    const compression = Math.sqrt((2 * idealEnergy) / config.springConstant);

    checks.push({
      id: "spring-capacity",
      name: "Compresión del resorte sin pérdidas por fricción",
      ok: compression <= config.maxCompression,
      severity: "warning",
      formula: "√(2·E₀/k) ≤ x_máx",
      detail: `${compression.toFixed(2)} m frente a ${config.maxCompression.toFixed(2)} m permitidos`,
      actual: compression,
      limit: config.maxCompression
    });
  }

  return checks;
}

/**
 * Explica por qué la simulación no terminó detenida en la estación.
 * @param {any} final
 * @param {import("../track/builder.js").Track} track
 * @param {ReadonlyArray<any>} history
 */
function completionViolation(final, track, history) {
  if (final.status === "stalled") {
    // Si llegó a la zona y quedó quieto antes de E, fue el rebote (resorte) lo que lo devolvió.
    const reached = history.some(state => state.distance >= track.brakeStart);

    return {
      code: reached ? "outside-braking" : "incomplete",
      condition: reached
        ? "Recorrido completo: el tren quedó fuera de la zona de frenado tras el rebote"
        : "Recorrido completo: el tren debe llegar a la zona de frenado",
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
  const completion = final.events.length === 0 ? completionViolation(final, track, history) : null;

  if (completion) violations.push(completion);

  const completed = ["finished", "stopped"].includes(final.status);
  const approved = completed && violations.length === 0;

  const reasons = approved
    ? [
        `El tren completó el recorrido y quedó detenido a ${final.distance.toFixed(2)} m, dentro de la zona de frenado.`,
        `Fuerza g máxima ${summary.maxLoad.value.toFixed(2)} g y mínima ${summary.minLoad.value.toFixed(2)} g, dentro de [${config.minLoad}, ${config.maxLoad}] g.`,
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
