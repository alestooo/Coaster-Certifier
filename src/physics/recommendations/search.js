import { resolveConfig } from "../config.js";
import { runSimulation } from "../run.js";
import { candidateList } from "./candidates.js";
import { targetedPatches } from "./targeted.js";

/** Máximo de candidatas simuladas por búsqueda. */
export const MAX_CANDIDATES = 160;

/** Cantidad de recomendaciones distintas que se buscan. */
export const TARGET_RECOMMENDATIONS = 3;

/** Margen de seguridad respecto a los límites de carga (g). */
const LOAD_MARGIN = 0.02;

/** Error de balance energético relativo máximo admitido. */
const MAX_BALANCE_ERROR = 0.01;

/**
 * Comprueba que una ejecución sea aprobada con margen.
 * @param {import("../run.js").SimulationRun} run
 */
function isAcceptable(run) {
  const { verdict, config } = run;
  const { summary } = verdict;

  return (
    verdict.approved &&
    summary.maxBalanceError.value / summary.initialEnergy < MAX_BALANCE_ERROR &&
    summary.maxLoad.value <= config.maxLoad - LOAD_MARGIN &&
    (config.contactModel === "strict"
      ? summary.minLoad.value > LOAD_MARGIN
      : summary.minLoad.value >= config.minLoad + LOAD_MARGIN)
  );
}

/**
 * Busca hasta tres configuraciones cercanas que aprueben el dictamen.
 * Es un generador: cada `next()` simula una candidata y reporta el
 * progreso, lo que permite ejecutarlo en un worker sin bloquear.
 *
 * @param {Partial<import("../config.js").SimulationConfig>} input
 * @returns {Generator<{tested: number, total: number, found: number}, {recommendations: any[], tested: number, reason: string}>}
 */
export function* recommendationSearch(input) {
  const config = resolveConfig(input);
  const original = runSimulation(config, { timeStep: 0.02 });
  const candidates = candidateList(config, targetedPatches(config, original)).slice(0, MAX_CANDIDATES);

  const found = [];
  const strategies = new Set();
  let tested = 0;

  for (const candidate of candidates) {
    const strategy = candidate.changes.map(change => change.key).sort().join("|");

    if (strategies.has(strategy)) continue;

    const run = runSimulation(candidate.config, { timeStep: 0.02 });
    tested += 1;

    if (isAcceptable(run)) {
      strategies.add(strategy);
      found.push({
        ...candidate,
        time: run.final.time,
        maxLoad: run.verdict.summary.maxLoad.value,
        minLoad: run.verdict.summary.minLoad.value,
        maxCompression: run.verdict.summary.braking.maxCompression ?? 0
      });
    }

    yield { tested, total: candidates.length, found: found.length };

    if (found.length === TARGET_RECOMMENDATIONS) break;
  }

  return {
    recommendations: found,
    tested,
    reason:
      found.length === TARGET_RECOMMENDATIONS
        ? ""
        : `La búsqueda comprobó ${tested} configuraciones y encontró ` +
          `${found.length} estrategias que aprueban el dictamen. ` +
          "No se ofrecen alternativas sin verificar."
  };
}
