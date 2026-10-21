import { resolveConfig } from "./config.js";
import { getTrackInfo } from "./geometry.js";
import { calculateForces } from "./forces.js";
import { calculateEnergies } from "./energy.js";
import { evaluateState } from "./evaluation.js";

function makeState(
  time,
  distance,
  velocity,
  dissipated,
  config,
  track,
  events = []
) {
  const forces = calculateForces(
    distance,
    velocity,
    config,
    track
  );

  return {
    time,
    distance,
    velocity,
    speed: Math.abs(velocity),

    position: {
      x: forces.geometry.x,
      y: forces.geometry.y
    },

    section:
      config.brakeMode === "station" &&
      distance >= track.springStart
        ? "Frenado de estación"
        : forces.geometry.section,

    status: "running",
    events,

    springCompression:
      forces.compression,

    load: forces.load,

    tangentialAcceleration:
      forces.acceleration,

    normalAcceleration:
      forces.normalAcceleration,

    forces: {
      normal: forces.normal,
      tangential: forces.tangential,
      friction: forces.friction,
      brake: forces.brake,
      spring: forces.spring,
      gravity: forces.gravity
    },

    energies: calculateEnergies(
      config,
      velocity,
      forces.geometry.y,
      forces.compression,
      dissipated
    )
  };
}

function derivative(values, config, track) {
  const forces = calculateForces(
    values[0],
    values[1],
    config,
    track
  );

  return [
    values[1],
    forces.acceleration,

    Math.abs(forces.friction * values[1]) +
      Math.abs(forces.brake * values[1])
  ];
}

function rk4(values, dt, config, track) {
  function add(first, second, factor) {
    return first.map(
      (value, index) =>
        value + second[index] * factor
    );
  }

  const k1 = derivative(
    values,
    config,
    track
  );

  const k2 = derivative(
    add(values, k1, dt / 2),
    config,
    track
  );

  const k3 = derivative(
    add(values, k2, dt / 2),
    config,
    track
  );

  const k4 = derivative(
    add(values, k3, dt),
    config,
    track
  );

  return values.map(
    (value, index) =>
      value +
      dt *
        (
          k1[index] +
          2 * k2[index] +
          2 * k3[index] +
          k4[index]
        ) /
        6
  );
}

function checked(state, config, track) {
  const result = evaluateState(
    state,
    config,
    track
  );

  if (!result) return state;

  return {
    ...state,
    status: result.status,

    events: [
      ...state.events,
      result.event
    ]
  };
}

function restingStatus(distance, config, track) {
  if (distance < track.springStart) {
    return "stalled";
  }

  return config.brakeMode === "station"
    ? "finished"
    : "stopped";
}

export function createInitialState(input = {}) {
  const config = resolveConfig(input);
  const track = getTrackInfo(config);

  return checked(
    makeState(
      0,
      0,
      0,
      0,
      config,
      track
    ),
    config,
    track
  );
}

export function step(state, input, dt) {
  const config = resolveConfig(input);
  const duration = dt ?? config.timeStep;

  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 1
  ) {
    throw new Error(
      "dt debe ser mayor que 0 y menor o igual que 1 segundo."
    );
  }

  if (state.status !== "running") {
    return state;
  }

  const track = getTrackInfo(config);

  const maximumSubstep = Math.min(
    0.001,

    0.03 *
      Math.sqrt(
        config.mass / config.springConstant
      )
  );

  const count = Math.ceil(
    duration / maximumSubstep
  );

  const substep = duration / count;

  let current = state;

  for (let index = 0; index < count; index++) {
    const values = [
      current.distance,
      current.velocity,
      current.energies.dissipated
    ];

    const forces = calculateForces(
      values[0],
      values[1],
      config,
      track
    );

    if (
      Math.abs(values[1]) < 1e-10 &&
      Math.abs(forces.acceleration) < 1e-9
    ) {
      return {
        ...current,

        status: restingStatus(
          values[0],
          config,
          track
        )
      };
    }

    // Solución exacta del frenado horizontal:
    // evita oscilaciones numéricas alrededor de velocidad cero.
    if (
      config.brakeMode === "station" &&
      values[0] >= track.springStart
    ) {
      const deceleration =
        config.brakeDeceleration +
        config.friction * config.gravity;

      const stopTime =
        Math.abs(values[1]) / deceleration;

      const elapsed = Math.min(
        substep,
        stopTime
      );

      const direction =
        Math.sign(values[1]);

      const distance =
        values[0] +
        values[1] * elapsed -
        direction *
          0.5 *
          deceleration *
          elapsed ** 2;

      const velocity =
        direction *
        Math.max(
          0,
          Math.abs(values[1]) -
            deceleration * elapsed
        );

      const dissipated =
        values[2] +
        0.5 *
          config.mass *
          (values[1] ** 2 - velocity ** 2);

      current = checked(
        makeState(
          current.time + elapsed,
          distance,
          velocity,
          dissipated,
          config,
          track,
          current.events
        ),
        config,
        track
      );

      if (current.status !== "running") {
        return current;
      }

      if (stopTime <= substep) {
        return {
          ...current,
          status: "finished"
        };
      }

      continue;
    }

    let next = rk4(
      values,
      substep,
      config,
      track
    );

    if (values[1] * next[1] < 0) {
      let low = 0;
      let high = substep;

      for (let iteration = 0; iteration < 35; iteration++) {
        const middle = (low + high) / 2;

        const candidate = rk4(
          values,
          middle,
          config,
          track
        );

        if (values[1] * candidate[1] > 0) {
          low = middle;
        } else {
          high = middle;
        }
      }

      const turning = rk4(
        values,
        high,
        config,
        track
      );

      turning[1] = 0;

      const turningState = checked(
        makeState(
          current.time + high,
          turning[0],
          0,
          turning[2],
          config,
          track,
          current.events
        ),
        config,
        track
      );

      if (turningState.status !== "running") {
        return turningState;
      }

      const atRest = calculateForces(
        turning[0],
        0,
        config,
        track
      );

      if (Math.abs(atRest.acceleration) < 1e-9) {
        return {
          ...turningState,

          status: restingStatus(
            turning[0],
            config,
            track
          )
        };
      }

      next = rk4(
        turning,
        substep - high,
        config,
        track
      );
    }

    current = checked(
      makeState(
        current.time + substep,
        next[0],
        next[1],
        next[2],
        config,
        track,
        current.events
      ),
      config,
      track
    );

    if (current.status !== "running") {
      return current;
    }
  }

  return current;
}