/**
 * Criterios de aceptación evaluados en cada paso de la simulación.
 * Cada incumplimiento registra el instante, el tramo, la posición,
 * el valor calculado con su unidad y el límite exigido.
 */

export const CRITERIA = Object.freeze({
  CONTACT: "contact",
  LOOP_CONTACT: "loop-contact",
  MAX_LOAD: "max-load",
  MIN_LOAD: "min-load",
  COMPRESSION: "compression",
  OVERRUN: "overrun",
  REVERSE: "reverse",
  MIN_SPEED: "min-speed",
  TIMEOUT: "timeout"
});

/** Rapidez mínima considerada "en subida" para aplicar el umbral v_mín. */
const CLIMB_SINE_THRESHOLD = 0.05;

/** Distancia mínima recorrida antes de aplicar el umbral v_mín (m). */
const MIN_SPEED_WARMUP_DISTANCE = 0.5;

/**
 * @typedef {Object} ViolationEvent
 * @property {string} code Código del criterio (ver CRITERIA).
 * @property {string} condition Condición evaluada, legible.
 * @property {number} time Instante (s).
 * @property {string} section Tramo.
 * @property {number} position Coordenada s (m).
 * @property {number} x Posición horizontal (m).
 * @property {number} y Altura (m).
 * @property {number} value Valor calculado.
 * @property {number} limit Límite exigido.
 * @property {string} unit Unidad del valor y del límite.
 * @property {string} comparison Relación exigida ("<", "≤", ">", "≥").
 */

/**
 * @param {any} state
 * @param {string} code
 * @param {string} condition
 * @param {number} value
 * @param {number} limit
 * @param {string} unit
 * @param {string} comparison
 * @returns {ViolationEvent}
 */
function createEvent(state, code, condition, value, limit, unit, comparison) {
  return {
    code,
    condition,
    time: state.time,
    section: state.section,
    position: state.distance,
    x: state.position.x,
    y: state.position.y,
    value,
    limit,
    unit,
    comparison
  };
}

/**
 * Evalúa los criterios sobre un estado. Devuelve `null` si todos se
 * cumplen; en caso contrario, el nuevo estado de la simulación y el
 * evento que lo justifica.
 *
 * @param {any} state Estado calculado por el integrador.
 * @param {import("../config.js").SimulationConfig} config
 * @param {import("../track/builder.js").Track} track
 * @returns {{status: string, event: ViolationEvent} | null}
 */
export function evaluateState(state, config, track) {
  const inLoop = state.kind === "loop";
  const strict = config.contactModel === "strict";

  if (state.forces.normal <= 0 && (strict || inLoop)) {
    return {
      status: "lost-contact",
      event: createEvent(
        state,
        strict ? CRITERIA.CONTACT : CRITERIA.LOOP_CONTACT,
        strict ? "Contacto con la vía: N > 0" : "Contacto en el loop: N > 0",
        state.forces.normal,
        0,
        "N",
        ">"
      )
    };
  }

  if (state.load > config.maxLoad) {
    return {
      status: "rejected",
      event: createEvent(
        state,
        CRITERIA.MAX_LOAD,
        "Carga máxima sobre los pasajeros: n ≤ n_máx",
        state.load,
        config.maxLoad,
        "g",
        "≤"
      )
    };
  }

  if (!strict && state.load < config.minLoad) {
    return {
      status: "rejected",
      event: createEvent(
        state,
        CRITERIA.MIN_LOAD,
        "Carga mínima sobre los pasajeros: n ≥ n_mín",
        state.load,
        config.minLoad,
        "g",
        "≥"
      )
    };
  }

  if (state.springCompression > config.maxCompression) {
    return {
      status: "rejected",
      event: createEvent(
        state,
        CRITERIA.COMPRESSION,
        "Compresión del resorte: x ≤ x_máx",
        state.springCompression,
        config.maxCompression,
        "m",
        "≤"
      )
    };
  }

  if (state.distance >= track.totalLength) {
    return {
      status: "rejected",
      event: createEvent(
        state,
        CRITERIA.OVERRUN,
        "Detención dentro de la zona de frenado: s < s_F",
        state.distance,
        track.totalLength,
        "m",
        "<"
      )
    };
  }

  if (state.distance <= 0 && state.velocity < 0) {
    return {
      status: "stalled",
      event: createEvent(
        state,
        CRITERIA.REVERSE,
        "Retroceso hasta el inicio: el tren regresó a A y quedó retenido",
        state.velocity,
        0,
        "m/s",
        "≥"
      )
    };
  }

  const climbing = Math.sin(state.angle) > CLIMB_SINE_THRESHOLD;

  if (
    climbing &&
    state.distance > MIN_SPEED_WARMUP_DISTANCE &&
    state.distance < track.brakeStart &&
    state.velocity >= 0 &&
    state.velocity < config.minSpeed
  ) {
    return {
      status: "stalled",
      event: createEvent(
        state,
        CRITERIA.MIN_SPEED,
        "Rapidez mínima en subida: v > v_mín",
        state.velocity,
        config.minSpeed,
        "m/s",
        ">"
      )
    };
  }

  if (state.time >= config.maxTime) {
    return {
      status: "timeout",
      event: createEvent(
        state,
        CRITERIA.TIMEOUT,
        "Detención dentro del tiempo de observación: t < t_máx",
        state.time,
        config.maxTime,
        "s",
        "<"
      )
    };
  }

  return null;
}
