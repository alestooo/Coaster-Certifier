/**
 * Resumen estadístico de un recorrido simulado: extremos, tramos y
 * puntos críticos. Todas las magnitudes en unidades del SI.
 */

import { maxOf, minOf } from "../utils.js";

/**
 * @typedef {Object} Extreme
 * @property {number} value
 * @property {number} time
 * @property {number} distance
 * @property {string} section
 */

/**
 * @param {any} state
 * @param {number} value
 * @returns {Extreme}
 */
function extremeAt(state, value) {
  return { value, time: state.time, distance: state.distance, section: state.section };
}

/**
 * Busca el extremo de una magnitud en el historial.
 * @param {ReadonlyArray<any>} history
 * @param {(state: any) => number} read
 * @param {"max"|"min"} mode
 * @returns {Extreme}
 */
function extreme(history, read, mode) {
  let best = history[0];
  let bestValue = read(best);

  for (const state of history) {
    const value = read(state);

    if (mode === "max" ? value > bestValue : value < bestValue) {
      best = state;
      bestValue = value;
    }
  }

  return extremeAt(best, bestValue);
}

/**
 * Interpola linealmente el historial en la coordenada s dada.
 * @param {ReadonlyArray<any>} history
 * @param {number} distance
 * @returns {{time: number, speed: number, load: number, normal: number, height: number} | null}
 */
export function interpolateAtDistance(history, distance) {
  for (let index = 1; index < history.length; index++) {
    const before = history[index - 1];
    const after = history[index];

    if (before.distance <= distance && after.distance >= distance) {
      const span = after.distance - before.distance;
      const fraction = span > 0 ? (distance - before.distance) / span : 0;
      const mix = (/** @type {number} */ a, /** @type {number} */ b) => a + (b - a) * fraction;

      return {
        time: mix(before.time, after.time),
        speed: mix(before.speed, after.speed),
        load: mix(before.load, after.load),
        normal: mix(before.forces.normal, after.forces.normal),
        height: mix(before.position.y, after.position.y)
      };
    }
  }

  return null;
}

/**
 * Estadísticas por tramo.
 * @param {ReadonlyArray<any>} history
 * @param {import("../track/builder.js").Track} track
 */
function summarizeSections(history, track) {
  return track.sections.map(section => {
    const states = history.filter(state => state.segmentIndex === section.index);

    if (!states.length) {
      return {
        ...section,
        reached: false,
        entryTime: undefined,
        exitTime: undefined,
        duration: undefined,
        entrySpeed: undefined,
        exitSpeed: undefined,
        maxSpeed: undefined,
        maxLoad: undefined,
        minLoad: undefined,
        minNormal: undefined,
        dissipated: undefined
      };
    }

    const first = states[0];
    const last = states[states.length - 1];

    return {
      ...section,
      reached: true,
      entryTime: first.time,
      exitTime: last.time,
      duration: last.time - first.time,
      entrySpeed: first.speed,
      exitSpeed: last.speed,
      maxSpeed: maxOf(states, state => state.speed),
      maxLoad: maxOf(states, state => state.load),
      minLoad: minOf(states, state => state.load),
      minNormal: minOf(states, state => state.forces.normal),
      dissipated: last.energies.dissipated - first.energies.dissipated
    };
  });
}

/**
 * Valores en los puntos críticos A–F.
 * @param {ReadonlyArray<any>} history
 * @param {import("../track/builder.js").Track} track
 */
function summarizeMarkers(history, track) {
  return track.markers.map(marker => {
    const sample = interpolateAtDistance(history, marker.distance);

    return {
      ...marker,
      reached: sample !== null,
      time: sample?.time,
      speed: sample?.speed,
      load: sample?.load,
      normal: sample?.normal,
      height: sample?.height
    };
  });
}

/**
 * Datos del frenado a partir del historial.
 * @param {ReadonlyArray<any>} history
 * @param {import("../config.js").SimulationConfig} config
 * @param {import("../track/builder.js").Track} track
 */
function summarizeBraking(history, config, track) {
  const entryIndex = history.findIndex(state => state.distance >= track.brakeStart);

  if (entryIndex < 0) {
    return { reached: false };
  }

  const entry = interpolateAtDistance(history, track.brakeStart);
  const final = history[history.length - 1];
  const before = history[Math.max(0, entryIndex - 1)];
  const entrySpeed =
    entryIndex > 0 && entry
      ? before.speed + before.tangentialAcceleration * (entry.time - before.time)
      : history[entryIndex].speed;
  const stopped = ["finished", "stopped"].includes(final.status);

  return {
    reached: true,
    entryTime: entry?.time ?? history[entryIndex].time,
    entrySpeed,
    stopped,
    stoppingDistance: stopped ? final.distance - track.brakeStart : null,
    stoppingTime: stopped ? final.time - (entry?.time ?? history[entryIndex].time) : null,
    remainingLength: stopped ? track.totalLength - final.distance : null,
    brakeForce:
      config.brakeMode === "station"
        ? config.mass * config.brakeDeceleration
        : maxOf(history, state => Math.abs(state.forces.spring)),
    impulse: config.mass * entrySpeed,
    energyToDissipate: 0.5 * config.mass * entrySpeed * entrySpeed,
    maxCompression: maxOf(history, state => state.springCompression)
  };
}

/**
 * Resume el recorrido completo.
 *
 * @param {ReadonlyArray<any>} history Historial de estados.
 * @param {import("../config.js").SimulationConfig} config
 * @param {import("../track/builder.js").Track} track
 */
export function summarizeRun(history, config, track) {
  const final = history[history.length - 1];

  return {
    duration: final.time,
    finalStatus: final.status,
    finalDistance: final.distance,
    samples: history.length,
    maxSpeed: extreme(history, state => state.speed, "max"),
    maxLoad: extreme(history, state => state.load, "max"),
    minLoad: extreme(history, state => state.load, "min"),
    maxNormal: extreme(history, state => state.forces.normal, "max"),
    minNormal: extreme(history, state => state.forces.normal, "min"),
    maxTangentialAcceleration: extreme(history, state => Math.abs(state.tangentialAcceleration), "max"),
    maxNormalAcceleration: extreme(history, state => Math.abs(state.normalAcceleration), "max"),
    maxBalanceError: extreme(history, state => Math.abs(state.energies.balanceError), "max"),
    initialEnergy: final.energies.initial,
    finalMechanicalEnergy: final.energies.mechanical,
    dissipatedEnergy: final.energies.dissipated,
    braking: summarizeBraking(history, config, track),
    sections: summarizeSections(history, track),
    criticalPoints: summarizeMarkers(history, track)
  };
}
