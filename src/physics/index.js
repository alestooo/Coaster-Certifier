// Responsable: Alejandro.
// API pública: la interfaz y el script headless importan desde aquí.

export { DEFAULT_CONFIG, validateConfig } from "./config.js";
export { getTrackGeometry } from "./track.js";
export { createInitialState } from "./state.js";
export { step } from "./motion.js";

export {
  kineticEnergy,
  gravitationalEnergy,
  elasticEnergy,
  calculateEnergies,
} from "./energy.js";