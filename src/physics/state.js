// Responsable: Alejandro.
// Este archivo no debe depender del navegador.

import { validateConfig } from "./config.js";
import { getTrackGeometry } from "./track.js";
import { calculateEnergies } from "./energy.js";
import { calculateForces } from "./forces.js";

export function createInitialState(config) {
  validateConfig(config);

  const geometry = getTrackGeometry(0, config);

  const state = {
    time: 0,
    distance: 0,
    position: { x: geometry.x, y: geometry.y },
    velocity: 0,
    speed: 0,
    springCompression: 0,
    status: "running",
    events: [],
  };

  const forces = calculateForces(state, geometry, config);

  return {
    ...state,
    forces,
    tangentialAcceleration: forces.tangential / config.mass,
    energies: calculateEnergies({
      mass: config.mass,
      gravity: config.gravity,
      velocity: 0,
      height: geometry.y,
    }),
  };
}