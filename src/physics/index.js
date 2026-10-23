/**
 * Coaster-Certifier · Librería de física
 *
 * API pública del motor de simulación. Todas las funciones son puras,
 * deterministas y trabajan en unidades del Sistema Internacional.
 * Ningún módulo de esta carpeta depende del navegador ni de la interfaz.
 */

export {
  DEFAULT_CONFIG,
  CONFIG_LIMITS,
  CUSTOM_LIMITS,
  MAP_IDS,
  BRAKE_MODES,
  CONTACT_MODELS,
  ConfigError,
  resolveConfig,
  assertLoopShape
} from "./config.js";

export * from "./constants.js";

export {
  buildTrack,
  geometryAt,
  segmentPoint,
  hermitePoint,
  createLoop,
  loopPoint,
  loopExtent,
  hillHalfWidth,
  layoutNodes
} from "./track/index.js";

export { calculateForces, resistiveForce } from "./dynamics/forces.js";
export { calculateEnergies, initialEnergy } from "./dynamics/energy.js";
export * from "./dynamics/kinematics.js";

export { rk4 } from "./integration/rk4.js";
export { createInitialState, step, makeState } from "./integration/step.js";

export { evaluateState, CRITERIA } from "./evaluation/criteria.js";
export { summarizeRun, interpolateAtDistance } from "./evaluation/summary.js";
export { evaluateRun, checkDesignConditions } from "./evaluation/verdict.js";

export { runSimulation } from "./run.js";
export { toCsv, CSV_COLUMNS } from "./export/csv.js";

export {
  recommendationSearch,
  explainFailure,
  candidateList,
  changesBetween,
  RECOMMENDATION_FIELDS
} from "./recommendations/index.js";

export { SCENARIOS, findScenario } from "./scenarios.js";
