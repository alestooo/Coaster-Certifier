import { resolveConfig } from "../config.js";
import { buildTrack } from "../track/builder.js";
import { calculateForces } from "../dynamics/forces.js";
import { calculateEnergies } from "../dynamics/energy.js";
import { evaluateState } from "../evaluation/criteria.js";
import { rk4 } from "./rk4.js";

import {
  REST_SPEED_EPSILON,
  REST_ACCELERATION_EPSILON,
  TURNING_POINT_ITERATIONS
} from "../constants.js";

/**
 * @typedef {Object} SimulationState
 * @property {number} time Tiempo (s).
 * @property {number} distance Coordenada s sobre la vía (m).
 * @property {number} velocity Velocidad tangencial con signo (m/s).
 * @property {number} speed Rapidez |v| (m/s).
 * @property {{x: number, y: number}} position Posición cartesiana (m).
 * @property {number} angle Inclinación θ (rad).
 * @property {number} curvature Curvatura κ (1/m).
 * @property {string} section Tramo actual.
 * @property {number} segmentIndex Índice del tramo.
 * @property {string} kind Tipo de tramo.
 * @property {"running"|"finished"|"stopped"|"stalled"|"rejected"|"lost-contact"|"timeout"} status
 * @property {import("../evaluation/criteria.js").ViolationEvent[]} events Incumplimientos registrados.
 * @property {number} springCompression Compresión x (m).
 * @property {number} load Carga n (g).
 * @property {number} tangentialAcceleration a_t (m/s²).
 * @property {number} normalAcceleration a_n (m/s²).
 * @property {{normal: number, tangential: number, friction: number, brake: number, spring: number, damper: number, gravity: number}} forces (N)
 * @property {import("../dynamics/energy.js").Energies} energies
 */

/**
 * Construye un estado completo a partir de (t, s, v, E_disipada).
 * @param {number} time
 * @param {number} distance
 * @param {number} velocity
 * @param {number} dissipated
 * @param {import("../config.js").SimulationConfig} config
 * @param {import("../track/builder.js").Track} track
 * @param {import("../evaluation/criteria.js").ViolationEvent[]} events
 * @returns {SimulationState}
 */
export function makeState(time, distance, velocity, dissipated, config, track, events = []) {
  const forces = calculateForces(track, config, distance, velocity);
  const { geometry } = forces;

  return {
    time,
    distance,
    velocity,
    speed: Math.abs(velocity),
    position: { x: geometry.x, y: geometry.y },
    angle: geometry.angle,
    curvature: geometry.curvature,
    section: geometry.section,
    segmentIndex: geometry.segmentIndex,
    kind: geometry.kind,
    status: "running",
    events,
    springCompression: forces.compression,
    load: forces.load,
    tangentialAcceleration: forces.acceleration,
    normalAcceleration: forces.normalAcceleration,
    forces: {
      normal: forces.normal,
      tangential: forces.tangential,
      friction: forces.friction,
      brake: forces.brake,
      spring: forces.spring,
      damper: forces.damper,
      gravity: forces.gravity
    },
    energies: calculateEnergies(config, velocity, geometry.y, forces.compression, dissipated)
  };
}

/**
 * Aplica los criterios de aceptación a un estado recién calculado.
 * @param {SimulationState} state
 * @param {import("../config.js").SimulationConfig} config
 * @param {import("../track/builder.js").Track} track
 * @returns {SimulationState}
 */
function checked(state, config, track) {
  const result = evaluateState(state, config, track);

  if (!result) return state;

  return {
    ...state,
    status: /** @type {SimulationState["status"]} */ (result.status),
    events: [...state.events, result.event]
  };
}

/**
 * Estado final cuando el tren queda en reposo en la posición s.
 * @param {number} distance
 * @param {import("../config.js").SimulationConfig} config
 * @param {import("../track/builder.js").Track} track
 * @returns {SimulationState["status"]}
 */
function restingStatus(distance, config, track) {
  if (distance < track.stationStart) return "stalled";
  return config.brakeMode === "station" ? "finished" : "stopped";
}

/**
 * Derivada del vector de estado [s, v, E_disipada].
 * @param {import("../track/builder.js").Track} track
 * @param {import("../config.js").SimulationConfig} config
 */
function derivativeFor(track, config) {
  return (/** @type {number[]} */ values) => {
    const forces = calculateForces(track, config, values[0], values[1]);

    // Los frenos de estación se integran de forma cerrada (MRUA) a partir
    // de la entrada exacta a la zona; aquí se excluyen para que las etapas
    // de RK4 que asoman más allá del límite no vean su discontinuidad.
    const acceleration = forces.acceleration - forces.brake / config.mass;
    const dissipationRate =
      Math.abs(forces.friction * values[1]) + Math.abs(forces.damper * values[1]);

    return [values[1], acceleration, dissipationRate];
  };
}

/**
 * Estado inicial del recorrido evaluado: s = 0, v = v₀, E_disipada = 0.
 *
 * @param {Partial<import("../config.js").SimulationConfig>} [input]
 * @returns {SimulationState}
 */
export function createInitialState(input = {}) {
  const config = resolveConfig(input);
  const track = buildTrack(config);

  return checked(makeState(0, 0, config.initialSpeed, 0, config, track), config, track);
}

/**
 * Avance analítico dentro de la zona de frenado de estación (MRUA):
 * desaceleración constante a_f + μ·g sobre vía horizontal.
 *
 * @param {SimulationState} current
 * @param {number[]} values
 * @param {number} substep
 * @param {import("../config.js").SimulationConfig} config
 * @param {import("../track/builder.js").Track} track
 * @returns {{state: SimulationState, elapsed: number}}
 */
function advanceInBrakeZone(current, values, substep, config, track) {
  const deceleration = config.brakeDeceleration + config.friction * config.gravity;
  const [distance0, velocity0, dissipated0] = values;

  if (velocity0 <= 0) {
    // Sin avance dentro de la zona: el freno retiene al tren donde está.
    const held = makeState(current.time, distance0, 0, dissipated0, config, track, current.events);
    return { state: { ...held, status: "finished" }, elapsed: 0 };
  }

  const stopTime = Math.abs(velocity0) / deceleration;
  const direction = Math.sign(velocity0);
  let elapsed = Math.min(substep, stopTime);

  let distance =
    distance0 + velocity0 * elapsed - direction * 0.5 * deceleration * elapsed * elapsed;

  if (distance > track.totalLength) {
    // Instante exacto en que se agota la zona de frenado: s₀ + v₀t − ½at² = s_F.
    const gap = track.totalLength - distance0;
    elapsed = (velocity0 - Math.sqrt(Math.max(0, velocity0 ** 2 - 2 * deceleration * gap))) / deceleration;
    distance = track.totalLength;
  }
  const velocity = direction * Math.max(0, Math.abs(velocity0) - deceleration * elapsed);
  const dissipated = dissipated0 + 0.5 * config.mass * (velocity0 ** 2 - velocity ** 2);

  const state = checked(
    makeState(current.time + elapsed, distance, velocity, dissipated, config, track, current.events),
    config,
    track
  );

  if (state.status !== "running") return { state, elapsed };
  if (stopTime <= substep) return { state: { ...state, status: "finished" }, elapsed };

  return { state, elapsed };
}

/**
 * Bisección temporal para localizar el instante τ ∈ (0, h] en el que
 * `predicate(estado(τ))` cambia de falso a verdadero.
 *
 * @param {(values: number[]) => number[]} derivative
 * @param {number[]} values
 * @param {number} h
 * @param {(candidate: number[]) => boolean} predicate
 * @returns {number} τ
 */
function locateEvent(derivative, values, h, predicate) {
  let low = 0;
  let high = h;

  for (let iteration = 0; iteration < TURNING_POINT_ITERATIONS; iteration++) {
    const middle = (low + high) / 2;

    if (predicate(rk4(derivative, values, middle))) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return high;
}

/**
 * Avance libre con RK4 y localización exacta de dos eventos:
 * puntos de retorno (v = 0) y entrada a la zona de frenado.
 *
 * @param {SimulationState} current
 * @param {number[]} values
 * @param {number} h Paso máximo (s).
 * @param {import("../config.js").SimulationConfig} config
 * @param {import("../track/builder.js").Track} track
 * @returns {{state: SimulationState, elapsed: number}}
 */
function advanceFree(current, values, h, config, track) {
  const derivative = derivativeFor(track, config);
  const next = rk4(derivative, values, h);

  /** @param {number} elapsed @param {number[]} result */
  const finish = (elapsed, result) => ({
    elapsed,
    state: checked(
      makeState(current.time + elapsed, result[0], result[1], result[2], config, track, current.events),
      config,
      track
    )
  });

  if (values[1] * next[1] < 0) {
    const tau = locateEvent(derivative, values, h, candidate => values[1] * candidate[1] <= 0);
    const turning = rk4(derivative, values, tau);
    const result = finish(tau, [turning[0], 0, turning[2]]);

    if (result.state.status !== "running") return result;

    const atRest = calculateForces(track, config, turning[0], 0);

    if (Math.abs(atRest.acceleration) < REST_ACCELERATION_EPSILON) {
      return {
        elapsed: tau,
        state: { ...result.state, status: restingStatus(turning[0], config, track) }
      };
    }

    return result;
  }

  const crossings = [
    { active: values[0] < track.brakeStart && next[0] >= track.brakeStart, boundary: track.brakeStart },
    { active: values[0] < track.totalLength && next[0] >= track.totalLength, boundary: track.totalLength },
    { active: values[0] > 0 && next[0] <= 0, boundary: 0 }
  ].filter(crossing => crossing.active);

  if (crossings.length) {
    const located = crossings
      .map(crossing => ({
        boundary: crossing.boundary,
        tau: locateEvent(derivative, values, h, candidate =>
          crossing.boundary === 0 ? candidate[0] <= 0 : candidate[0] >= crossing.boundary
        )
      }))
      .sort((first, second) => first.tau - second.tau)[0];

    const crossing = rk4(derivative, values, located.tau);

    return finish(located.tau, [located.boundary, crossing[1], crossing[2]]);
  }

  return finish(h, next);
}

/**
 * Avanza la simulación un intervalo dt. Función pura y determinista:
 * devuelve siempre un estado nuevo y nunca modifica el recibido.
 *
 * Internamente subdivide dt en pasos ≤ `maxSubstep` (y ≤ 3 % del
 * periodo del resorte) integrados con RK4.
 *
 * @param {SimulationState} state Estado actual.
 * @param {Partial<import("../config.js").SimulationConfig>} input Configuración.
 * @param {number} [dt] Intervalo (s); por defecto `config.timeStep`.
 * @returns {SimulationState}
 */
export function step(state, input, dt) {
  const config = resolveConfig(input);
  const duration = dt ?? config.timeStep;

  if (!Number.isFinite(duration) || duration <= 0 || duration > 1) {
    throw new Error("dt debe ser mayor que 0 y menor o igual que 1 segundo.");
  }

  if (state.status !== "running") return state;

  const track = buildTrack(config);
  const springPeriodLimit = 0.03 * Math.sqrt(config.mass / config.springConstant);
  const maximumSubstep = Math.min(config.maxSubstep, springPeriodLimit);
  const substep = duration / Math.ceil(duration / maximumSubstep);

  let current = state;
  let remaining = duration;

  while (remaining > 1e-12) {
    const h = Math.min(substep, remaining);
    const values = [current.distance, current.velocity, current.energies.dissipated];
    const forces = calculateForces(track, config, values[0], values[1]);

    if (
      Math.abs(values[1]) < REST_SPEED_EPSILON &&
      Math.abs(forces.acceleration) < REST_ACCELERATION_EPSILON
    ) {
      return { ...current, status: restingStatus(values[0], config, track) };
    }

    const result =
      config.brakeMode === "station" && values[0] >= track.brakeStart
        ? advanceInBrakeZone(current, values, h, config, track)
        : advanceFree(current, values, h, config, track);

    current = result.state;
    remaining -= result.elapsed;

    if (current.status !== "running") return current;
  }

  return current;
}
