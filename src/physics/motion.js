// Responsable: Alejandro.
// Integración inicial mediante Euler semiimplícito.
// Pendiente: validar precisión, tratar eventos entre pasos e integrar
// el trazado completo, la fricción y el resorte.

import { getTrackGeometry } from "./track.js";
import { calculateForces } from "./forces.js";
import { calculateEnergies } from "./energy.js";

export function step(state, config, dt) {
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new Error("dt debe ser positivo y finito.");
  }

  if (state.status !== "running") {
    return state;
  }

  const geometry = getTrackGeometry(state.distance, config);
  const forces = calculateForces(state, geometry, config);
  const acceleration = forces.tangential / config.mass;

  const velocity = state.velocity + acceleration * dt;
  const proposedDistance = state.distance + velocity * dt;

  // Límite provisional para la demostración de pendiente.
  const distance = Math.max(
    0,
    Math.min(proposedDistance, config.trackLength)
  );

  const nextGeometry = getTrackGeometry(distance, config);
  const reachedEnd = proposedDistance >= config.trackLength;

  const nextState = {
    ...state,
    time: state.time + dt,
    distance,
    position: {
      x: nextGeometry.x,
      y: nextGeometry.y,
    },
    velocity,
    speed: Math.abs(velocity),
    status: reachedEnd ? "finished" : "running",
  };

  const nextForces = calculateForces(
    nextState,
    nextGeometry,
    config
  );

  return {
    ...nextState,
    forces: nextForces,
    tangentialAcceleration: nextForces.tangential / config.mass,
    energies: calculateEnergies({
      mass: config.mass,
      gravity: config.gravity,
      velocity,
      height: nextGeometry.y,
    }),
  };
}