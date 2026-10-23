import { resolveConfig } from "./config.js";
import { buildTrack } from "./track/builder.js";
import { createInitialState, step } from "./integration/step.js";
import { evaluateRun } from "./evaluation/verdict.js";

/**
 * @typedef {Object} SimulationRun
 * @property {import("./config.js").SimulationConfig} config Configuración resuelta.
 * @property {import("./track/builder.js").Track} track Trazado construido.
 * @property {import("./integration/step.js").SimulationState[]} history Estados en cada paso de reporte.
 * @property {import("./integration/step.js").SimulationState} final Estado final.
 * @property {import("./evaluation/verdict.js").Verdict} verdict Dictamen.
 */

/**
 * Ejecuta un recorrido completo sin interfaz hasta que el tren se
 * detiene, incumple un criterio o agota el tiempo de observación.
 *
 * @param {Partial<import("./config.js").SimulationConfig>} input Configuración.
 * @param {{timeStep?: number, onStep?: (state: any) => void}} [options]
 * @returns {SimulationRun}
 */
export function runSimulation(input = {}, options = {}) {
  const config = resolveConfig(input);
  const track = buildTrack(config);
  const timeStep = options.timeStep ?? config.timeStep;
  const maxSteps = Math.ceil(config.maxTime / timeStep) + 2;

  let state = createInitialState(config);
  const history = [state];

  for (let index = 0; index < maxSteps && state.status === "running"; index++) {
    state = step(state, config, timeStep);
    history.push(state);
    options.onStep?.(state);
  }

  return {
    config,
    track,
    history,
    final: state,
    verdict: evaluateRun(history, config)
  };
}
