import type {
  resolveConfig,
  buildTrack,
  createInitialState,
  evaluateRun
} from "../physics/index.js";

/** Configuración resuelta de la librería de física. */
export type SimulationConfig = ReturnType<typeof resolveConfig>;

/** Entrada parcial aceptada por la librería. */
export type ConfigInput = Partial<SimulationConfig>;

/** Trazado construido. */
export type Track = ReturnType<typeof buildTrack>;

/** Estado físico del tren. */
export type SimulationState = ReturnType<typeof createInitialState>;

/** Dictamen de un recorrido. */
export type Verdict = ReturnType<typeof evaluateRun>;

/** Punto del editor de pista personalizada. */
export type TrackPoint = SimulationConfig["customPoints"][number];
