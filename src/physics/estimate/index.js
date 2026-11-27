/**
 * Estimador de la atracción a partir de una corrida: recorrido, tiempos y
 * capacidad, movimiento, energía y estructura. Funciones puras; los valores
 * que no aplican (sin subida, por ejemplo) son null, nunca NaN.
 */
import { geometryAt } from "../track/geometry.js";
import { liftMetrics } from "../dynamics/lift.js";

/** Rangos y valores por defecto de los supuestos editables. */
export const ESTIMATE_ASSUMPTIONS = Object.freeze({
  supportSpacing: Object.freeze({ default: 8, range: /** @type {const} */ ([2, 50]) }),
  stationSeconds: Object.freeze({ default: 45, range: /** @type {const} */ ([0, 600]) }),
  seats: Object.freeze({ default: 4, range: /** @type {const} */ ([1, 40]) })
});

/** Fuerza g por debajo de la cual se cuenta flotación, y por encima de la cual se cuenta carga alta (g). */
const FLOAT_LOAD = 0.2;
const HIGH_LOAD = 4;
/** Una columna más baja que esto es una zapata (m). */
const MIN_COLUMN_M = 0.5;
const JOULES_PER_KWH = 3.6e6;

/**
 * @typedef {{supportSpacing?: number, stationSeconds?: number, seats?: number}} EstimateAssumptions
 */

/** @param {number | undefined} value @param {{default: number, range: readonly [number, number]}} spec */
function assumption(value, spec) {
  const [min, max] = spec.range;
  return Number.isFinite(value) ? Math.min(max, Math.max(min, /** @type {number} */ (value))) : spec.default;
}

/**
 * Segundos del historial en que `inside(state)` se cumple (suma de Riemann por la izquierda).
 * @param {ReadonlyArray<any>} history
 * @param {(state: any) => boolean} inside
 */
function secondsWhere(history, inside) {
  let total = 0;
  for (let index = 1; index < history.length; index++) {
    if (inside(history[index - 1])) total += history[index].time - history[index - 1].time;
  }
  return total;
}

/**
 * Columnas: cada `spacing` m de recorrido sobre la vía evaluada (sin los
 * loops, que se apoyan en su base, ni los puntos casi a nivel del suelo,
 * que van sobre zapatas), más las de la rampa de la subida.
 * @param {any} track
 * @param {import("../config.js").SimulationConfig} config
 * @param {number} spacing
 */
function columns(track, config, spacing) {
  /** @type {number[]} */
  const heights = [];

  for (let distance = spacing; distance < track.stationStart; distance += spacing) {
    const point = geometryAt(track, distance);
    if (point.kind !== "loop" && point.y >= MIN_COLUMN_M) heights.push(point.y);
  }

  const lift = track.lift;
  if (lift) {
    for (let along = spacing; config.initialHeight - along * Math.sin(lift.angle) >= MIN_COLUMN_M; along += spacing) {
      heights.push(config.initialHeight - along * Math.sin(lift.angle));
    }
  }

  return heights;
}

/**
 * Estimación de la atracción.
 * @param {import("../config.js").SimulationConfig} config
 * @param {{history: ReadonlyArray<any>, final: any, track: any, verdict: {summary: any}}} run
 * @param {EstimateAssumptions} [input]
 */
export function estimateRide(config, run, input = {}) {
  const assumptions = {
    supportSpacing: assumption(input.supportSpacing, ESTIMATE_ASSUMPTIONS.supportSpacing),
    stationSeconds: assumption(input.stationSeconds, ESTIMATE_ASSUMPTIONS.stationSeconds),
    seats: Math.round(assumption(input.seats, ESTIMATE_ASSUMPTIONS.seats))
  };
  const { history, final, track } = run;
  const summary = run.verdict.summary;
  const lift = liftMetrics(config);

  // Solo un recorrido que termina detenido en la estación tiene tiempo de vuelta, ciclo y frenado: el motor corta
  // en el primer incumplimiento, y ese tiempo no es el de una vuelta.
  const complete = final.status === "finished" || final.status === "stopped";
  const ride = complete ? final.time : null;
  const cycle = ride === null ? null : assumptions.stationSeconds + (lift?.time ?? 0) + ride;

  // Energía que se lleva el sistema de frenado: lo disipado mientras el tren está en la zona.
  let brakeEnergy = 0;
  let peakBrakePower = 0;
  for (let index = 1; index < history.length; index++) {
    const current = history[index];
    if (current.distance < track.brakeStart) continue;
    brakeEnergy += Math.max(0, (current.energies.dissipated ?? 0) - (history[index - 1].energies.dissipated ?? 0));
    // La fuerza del resorte es conservativa (devuelve la energía): la potencia de frenado es la que se disipa.
    const force = (current.forces.brake ?? 0) + (current.forces.damper ?? 0);
    peakBrakePower = Math.max(peakBrakePower, Math.abs(force * current.velocity));
  }

  const heights = columns(track, config, assumptions.supportSpacing);
  const liftRun = track.lift ? config.initialHeight / Math.tan(track.lift.angle) : 0;

  return {
    complete,
    status: final.status,
    path: {
      trackLength: track.totalLength,
      liftLength: lift ? lift.length : null,
      total: track.totalLength + (lift ? lift.length : 0)
    },
    times: {
      lift: lift ? lift.time : null,
      ride,
      cycle,
      throughput: cycle !== null && cycle > 0 ? (3600 * assumptions.seats) / cycle : null
    },
    motion: {
      maxSpeed: summary.maxSpeed.value,
      maxLoad: summary.maxLoad.value,
      minLoad: summary.minLoad.value,
      // Flota cualquier carro (con el tren articulado `load` es el del más cargado; el más liviano es `minCarLoad`).
      floatSeconds: secondsWhere(history, state => (state.minCarLoad ?? state.load) < FLOAT_LOAD),
      highLoadSeconds: secondsWhere(history, state => state.load > HIGH_LOAD)
    },
    energy: {
      liftEnergyKWh: lift ? lift.energy / JOULES_PER_KWH : null,
      liftPower: lift ? lift.power : null,
      brakeEnergy: complete ? brakeEnergy : null,
      peakBrakePower: complete ? peakBrakePower : null,
      launchEnergy: Math.max(0, summary.inputEnergy ?? 0)
    },
    structure: {
      supports: heights.length,
      totalColumnHeight: heights.reduce((sum, height) => sum + height, 0),
      tallestColumn: heights.length ? Math.max(...heights) : 0,
      maxHeight: Math.max(track.maxHeight, config.initialHeight),
      footprint: track.endX + liftRun
    },
    assumptions
  };
}
