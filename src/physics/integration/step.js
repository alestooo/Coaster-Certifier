import { resolveConfig } from "../config.js";
import { buildTrack } from "../track/builder.js";
import { calculateForces, zoneAt } from "../dynamics/forces.js";
import { trainStartHeight, trainStartSpeed } from "../dynamics/train.js";
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
 * @property {"booster"|"trim"|null} zoneKind Zona en la que está el tren (lanzador o frenos de ajuste), si está en una.
 * @property {number} [minCarLoad] Tren articulado: la fuerza g del carro más liviano (`load` es la del más cargado).
 * @property {number} [minNormal] Tren articulado: la normal más chica entre los carros (N).
 * @property {number | null} [minLoopNormal] Tren articulado: la normal más chica entre los carros que están en un loop (N).
 * @property {{distance: number, load: number}[]} [cars] Tren articulado: posición y fuerza g de cada carro.
 * @property {number} load Carga n (g).
 * @property {number} tangentialAcceleration a_t (m/s²).
 * @property {number} normalAcceleration a_n (m/s²).
 * @property {{normal: number, tangential: number, friction: number, brake: number, spring: number, damper: number, gravity: number, air: number, booster: number, trim: number}} forces (N)
 * @property {import("../dynamics/energy.js").Energies} energies
 */

/**
 * Construye un estado completo a partir de (t, s, v, E_disipada, W_entrada).
 * @param {number} time
 * @param {number} distance
 * @param {number} velocity
 * @param {number} dissipated
 * @param {import("../config.js").SimulationConfig} config
 * @param {import("../track/builder.js").Track} track
 * @param {import("../evaluation/criteria.js").ViolationEvent[]} events
 * @param {number} [input] Trabajo de entrada acumulado (J).
 * @returns {SimulationState}
 */
export function makeState(time, distance, velocity, dissipated, config, track, events = [], input = 0, chainWork = 0) {
  const forces = calculateForces(track, config, distance, velocity);
  const { geometry } = forces;
  const state = particleState(time, distance, velocity, dissipated, config, track, events, input, forces);
  if (config.trainCars <= 1) return state;

  // Tren articulado: la carga es la del peor carro, la energía potencial la del centro de masa, y la inicial la de
  // los carros en sus lugares al salir (los de atrás todavía en la subida).
  const train = /** @type {any} */ (forces);
  return {
    ...state,
    zoneKind: train.zoneKind,
    minCarLoad: train.minLoad,
    minNormal: train.minNormal,
    minLoopNormal: train.minLoopNormal,
    cars: train.cars.map((/** @type {any} */ car) => ({ distance: car.distance, load: car.load })),
    energies: {
      ...calculateEnergies(config, velocity, train.meanHeight, forces.compression, dissipated, input + chainWork, trainStartHeight(track, config), trainStartSpeed(track, config)),
      // Lo que entregaron los lanzadores y, aparte, lo que hizo la cadena sosteniendo a los carros de la subida.
      input,
      chainWork
    }
  };
}

/**
 * Estado de la partícula (y base del tren articulado).
 * @param {number} time @param {number} distance @param {number} velocity @param {number} dissipated
 * @param {import("../config.js").SimulationConfig} config
 * @param {import("../track/builder.js").Track} track
 * @param {import("../evaluation/criteria.js").ViolationEvent[]} events
 * @param {number} input
 * @param {import("../dynamics/forces.js").Forces} forces
 * @returns {SimulationState}
 */
function particleState(time, distance, velocity, dissipated, config, track, events, input, forces) {
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
    zoneKind: forces.zone?.kind ?? null,
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
      gravity: forces.gravity,
      air: forces.air,
      booster: forces.booster,
      trim: forces.trim
    },
    energies: calculateEnergies(config, velocity, geometry.y, forces.compression, dissipated, input)
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
  // Quieto antes de E (también en la aproximación) no terminó el recorrido.
  if (distance < track.brakeStart) return "stalled";
  return config.brakeMode === "station" ? "finished" : "stopped";
}

/**
 * Derivada del vector de estado [s, v, E_disipada, W_lanzadores, W_cadena].
 * @param {import("../track/builder.js").Track} track
 * @param {import("../config.js").SimulationConfig} config
 * @param {import("../track/builder.js").TrackZone | null} [zone] Zona fija (paso que llega a un borde de zona).
 * @param {number} [membershipAt] Tren articulado: posición con que se decide la zona de cada carro.
 */
function derivativeFor(track, config, zone, membershipAt) {
  const options = zone === undefined ? {} : { zone };
  const articulated = config.trainCars > 1;
  return (/** @type {number[]} */ values) => {
    if (articulated) return trainDerivative(track, config, values, membershipAt);
    const forces = calculateForces(track, config, values[0], values[1], options);

    // Los frenos de estación se integran de forma cerrada (MRUA) a partir
    // de la entrada exacta a la zona; aquí se excluyen para que las etapas
    // de RK4 que asoman más allá del límite no vean su discontinuidad.
    const acceleration = forces.acceleration - forces.brake / config.mass;
    const dissipationRate =
      Math.abs(forces.friction * values[1]) + Math.abs(forces.damper * values[1]) + Math.abs(forces.air * values[1]) + Math.abs(forces.trim * values[1]);

    return [values[1], acceleration, dissipationRate, forces.booster * values[1], 0];
  };
}

/**
 * Derivada del tren articulado: los frenos de estación actúan carro por carro
 * (se integran con RK4, no en forma cerrada) y la cadena aporta trabajo
 * mientras sostiene a los carros que siguen en la subida.
 * @param {import("../track/builder.js").Track} track
 * @param {import("../config.js").SimulationConfig} config
 * @param {number[]} values
 * @param {number} [membershipAt]
 */
function trainDerivative(track, config, values, membershipAt) {
  const forces = /** @type {any} */ (calculateForces(track, config, values[0], values[1], membershipAt === undefined ? LEAN : { membershipAt, lean: true }));
  const velocity = values[1];
  const dissipationRate =
    Math.abs(forces.friction * velocity) + Math.abs(forces.damper * velocity) + Math.abs(forces.air * velocity) + Math.abs(forces.trim * velocity) + Math.abs(forces.brake * velocity);

  return [velocity, forces.acceleration, dissipationRate, forces.booster * velocity, forces.chain * velocity];
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

  // Con varios carros y subida, el tren sale de A a la rapidez de la cadena como mínimo (los de atrás siguen en ella).
  return checked(makeState(0, 0, trainStartSpeed(track, config), 0, config, track), config, track);
}

/** Aire despreciable frente a los frenos de estación: k·v² por debajo de esta fracción de a. */
const NEGLIGIBLE_DRAG = 1e-8;

/**
 * Movimiento cerrado sobre vía horizontal con dv/dt = −(a + k·v²), v > 0:
 * frenos de estación y rodadura (a) más el aire (k = ρ·C_dA/(2m)). Con k = 0
 * es el MRUA de siempre.
 */
const brakeMotion = {
  /** Tiempo hasta detenerse (s). @param {number} speed @param {number} a @param {number} k */
  stopTime(speed, a, k) {
    if (k <= 0) return speed / a;
    return Math.atan(speed * Math.sqrt(k / a)) / Math.sqrt(a * k);
  },
  /**
   * Posición y rapidez tras `time` s (antes de detenerse), desde `start`.
   * Sin aire repite la aritmética de siempre, en el mismo orden (el CSV no cambia ni en el último dígito).
   * @param {number} start @param {number} speed @param {number} a @param {number} k @param {number} time
   */
  after(start, speed, a, k, time) {
    if (k <= 0) return { distance: start + speed * time - 0.5 * a * time * time, speed: Math.max(0, speed - a * time) };

    const w = Math.sqrt(a * k);
    const phase = Math.atan(speed * Math.sqrt(k / a));
    const angle = phase - w * time;
    return { distance: start + Math.log(Math.cos(angle) / Math.cos(phase)) / k, speed: Math.max(0, Math.sqrt(a / k) * Math.tan(angle)) };
  },
  /** Tiempo hasta recorrer `gap` m, o null si se detiene antes. @param {number} speed @param {number} a @param {number} k @param {number} gap */
  timeTo(speed, a, k, gap) {
    if (k <= 0) return (speed - Math.sqrt(Math.max(0, speed ** 2 - 2 * a * gap))) / a;

    const phase = Math.atan(speed * Math.sqrt(k / a));
    const cosine = Math.cos(phase) * Math.exp(k * gap);
    return cosine > 1 ? null : (phase - Math.acos(cosine)) / Math.sqrt(a * k);
  }
};

/**
 * Avance analítico dentro de la zona de frenado de estación: desaceleración
 * constante a_f + μ·g sobre vía horizontal, más el aire si lo hay.
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
  const [distance0, velocity0, dissipated0, input, chainWork] = values;
  // Con un aire despreciable frente a los frenos (k·v² < 1e-8·a), la fórmula con ln(cos/cos) pierde toda la
  // precisión por cancelación: se usa el MRUA, cuyo error relativo es de ese mismo orden.
  const airDrag = (config.airDensity * config.airDragArea) / (2 * config.mass);
  const drag = airDrag * velocity0 ** 2 < NEGLIGIBLE_DRAG * deceleration ? 0 : airDrag;

  if (velocity0 <= 0) {
    // Sin avance dentro de la zona: el freno retiene al tren donde está.
    const held = makeState(current.time, distance0, 0, dissipated0, config, track, current.events, input, chainWork);
    return { state: { ...held, status: "finished" }, elapsed: 0 };
  }

  const stopTime = brakeMotion.stopTime(velocity0, deceleration, drag);
  let elapsed = Math.min(substep, stopTime);
  let motion = brakeMotion.after(distance0, velocity0, deceleration, drag, elapsed);
  let distance = motion.distance;

  if (distance > track.totalLength) {
    // Instante exacto en que se agota la zona de frenado.
    elapsed = brakeMotion.timeTo(velocity0, deceleration, drag, track.totalLength - distance0) ?? elapsed;
    motion = brakeMotion.after(distance0, velocity0, deceleration, drag, elapsed);
    distance = track.totalLength;
  }
  const velocity = elapsed >= stopTime ? 0 : motion.speed;
  const dissipated = dissipated0 + 0.5 * config.mass * (velocity0 ** 2 - velocity ** 2);

  const state = checked(
    makeState(current.time + elapsed, distance, velocity, dissipated, config, track, current.events, input, chainWork),
    config,
    track
  );

  if (state.status !== "running") return { state, elapsed };
  if (stopTime <= substep) return { state: { ...state, status: "finished" }, elapsed };

  return { state, elapsed };
}

/**
 * Coordenadas s de los bordes de las zonas (lanzadores y frenos de ajuste).
 * @param {import("../track/builder.js").Track} track
 * @returns {number[]}
 */
function zoneBoundaries(track) {
  return (track.zones ?? []).flatMap(zone => [zone.start, zone.end]);
}

/**
 * Coordenadas del carro delantero en que algún carro cruza un borde donde la
 * fuerza cambia de golpe: los bordes de las zonas y, con varios carros, la
 * entrada al frenado y A (el carro deja la subida). Con un carro, solo las zonas.
 * @param {import("../track/builder.js").Track} track
 * @param {import("../config.js").SimulationConfig} config
 * @returns {number[]}
 */
function trainBoundaries(track, config) {
  const zones = zoneBoundaries(track);
  if (config.trainCars <= 1) return zones;

  // Se calculan una vez por trazado y tren (cada subpaso las consulta).
  const key = `${config.trainCars}:${config.carSpacing}`;
  const cached = BOUNDARY_CACHE.get(track)?.get(key);
  if (cached) return cached;

  const offsets = Array.from({ length: config.trainCars }, (_, index) => index * config.carSpacing);
  const perCar = [...zones, track.brakeStart, 0];
  const boundaries = offsets.flatMap(offset => perCar.map(boundary => boundary + offset)).filter(boundary => boundary > 0 || zones.includes(boundary));
  const forTrack = BOUNDARY_CACHE.get(track) ?? new Map();
  forTrack.set(key, boundaries);
  BOUNDARY_CACHE.set(track, forTrack);
  return boundaries;
}

/** Bordes por trazado (los trazados se memorizan y no cambian) y por tren. */
const BOUNDARY_CACHE = new WeakMap();

/** Opciones de la derivada del tren articulado: solo escalares. */
const LEAN = Object.freeze({ lean: true });

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
      makeState(current.time + elapsed, result[0], result[1], result[2], config, track, current.events, result[3], result[4]),
      config,
      track
    )
  });

  /**
   * El tren quedó con v = 0 en `distance`: si la fricción estática lo sostiene,
   * está en reposo; si no, el próximo paso arranca desde v = 0.
   * @param {number} elapsed
   * @param {number[]} stopped
   */
  const settle = (elapsed, stopped) => {
    const result = finish(elapsed, stopped);

    if (result.state.status !== "running") return result;

    const atRest = calculateForces(track, config, stopped[0], 0);

    if (Math.abs(atRest.acceleration) < REST_ACCELERATION_EPSILON) {
      return {
        elapsed,
        state: { ...result.state, status: restingStatus(stopped[0], config, track) }
      };
    }

    return result;
  };

  // Con |v| < |a|·h, la fuerza que se opone al movimiento lo detiene dentro del paso. RK4 no
  // sirve ahí: sus etapas cambian el signo de la fricción (Coulomb) y se anulan, y v quedaría
  // fija para siempre. El tramo hasta v = 0 se integra en forma cerrada (aceleración constante).
  const [, acceleration, dissipationRate, inputRate, chainRate] = derivative(values);

  if (values[1] * acceleration < 0 && Math.abs(values[1]) < Math.abs(acceleration) * h) {
    const tau = Math.abs(values[1] / acceleration);
    return settle(tau, [values[0] + (values[1] * tau) / 2, 0, values[2] + (dissipationRate * tau) / 2, values[3] + (inputRate * tau) / 2, values[4] + (chainRate * tau) / 2]);
  }

  if (values[1] * next[1] < 0) {
    const tau = locateEvent(derivative, values, h, candidate => values[1] * candidate[1] <= 0);
    const turning = rk4(derivative, values, tau);
    return settle(tau, [turning[0], 0, turning[2], turning[3], turning[4]]);
  }

  // Bordes donde la fuerza cambia de golpe: la entrada al frenado, el final, A y los bordes de cada zona
  // (estos, en los dos sentidos: un tren puede volver a cruzar una zona hacia atrás).
  const crossings = [
    { active: values[0] < track.brakeStart && next[0] >= track.brakeStart, boundary: track.brakeStart, forward: true },
    { active: values[0] < track.totalLength && next[0] >= track.totalLength, boundary: track.totalLength, forward: true },
    { active: values[0] > 0 && next[0] <= 0, boundary: 0, forward: false },
    ...trainBoundaries(track, config).flatMap(boundary => [
      { active: values[0] < boundary && next[0] >= boundary, boundary, forward: true },
      { active: values[0] > boundary && next[0] <= boundary, boundary, forward: false }
    ])
  ].filter(crossing => crossing.active);

  if (crossings.length) {
    // Hasta el borde rige la fuerza del lado donde está el tren: las etapas de RK4 que asoman del otro lado
    // no deben ver el empuje (o el frenado) de una zona en la que todavía no entró.
    const before = config.trainCars > 1 ? derivativeFor(track, config, undefined, values[0]) : derivativeFor(track, config, zoneAt(track, values[0]));
    const located = crossings
      .map(crossing => ({
        boundary: crossing.boundary,
        tau: locateEvent(before, values, h, candidate => (crossing.forward ? candidate[0] >= crossing.boundary : candidate[0] <= crossing.boundary))
      }))
      .sort((first, second) => first.tau - second.tau)[0];

    const crossing = rk4(before, values, located.tau);

    return finish(located.tau, [located.boundary, crossing[1], crossing[2], crossing[3], crossing[4]]);
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
    const values = [current.distance, current.velocity, current.energies.dissipated, current.energies.input ?? 0, current.energies.chainWork ?? 0];
    const forces = calculateForces(track, config, values[0], values[1]);

    if (
      Math.abs(values[1]) < REST_SPEED_EPSILON &&
      Math.abs(forces.acceleration) < REST_ACCELERATION_EPSILON
    ) {
      return { ...current, status: restingStatus(values[0], config, track) };
    }

    const result =
      config.brakeMode === "station" && values[0] >= track.brakeStart && config.trainCars <= 1
        ? advanceInBrakeZone(current, values, h, config, track)
        : advanceFree(current, values, h, config, track);

    current = result.state;
    remaining -= result.elapsed;

    if (current.status !== "running") return current;
  }

  return current;
}
