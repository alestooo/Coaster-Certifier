import { LOAD_MARGIN } from "../recommendations/search.js";

/**
 * Objetivos del optimizador. `value` es lo que se muestra; `score` es lo que
 * se minimiza (el valor, o su opuesto si se busca el mayor).
 */

/**
 * @typedef {Object} Objective
 * @property {string} label
 * @property {string} unit
 * @property {"lower" | "higher"} better
 * @property {(run: any) => number} value
 *
 * @typedef {Object} LoadMargin
 * @property {"upper" | "lower" | "loop"} kind
 * @property {number} margin Distancia al límite (g).
 * @property {number} value Fuerza g en ese punto.
 * @property {string} section
 */

/**
 * Márgenes de fuerza g frente a los límites: el techo, el piso (o el
 * contacto, en modo estricto) y el contacto en cada loop.
 * @param {any} run
 * @returns {LoadMargin[]}
 */
export function loadMargins(run) {
  const { config, verdict } = run;
  const { summary } = verdict;
  const floor = config.contactModel === "strict" ? 0 : config.minLoad;
  /** @type {LoadMargin[]} */
  const margins = [
    { kind: "upper", margin: config.maxLoad - summary.maxLoad.value, value: summary.maxLoad.value, section: summary.maxLoad.section },
    { kind: "lower", margin: summary.minLoad.value - floor, value: summary.minLoad.value, section: summary.minLoad.section }
  ];

  for (const section of summary.sections) {
    if (section.kind === "loop" && section.reached) margins.push({ kind: "loop", margin: section.minLoad, value: section.minLoad, section: section.name });
  }

  return margins;
}

/**
 * Margen de fuerza g frente a los límites (g): el menor de todos.
 * @param {any} run
 */
export function loadMargin(run) {
  return Math.min(...loadMargins(run).map(margin => margin.margin));
}

/** @type {Readonly<Record<string, Objective>>} */
export const OBJECTIVES = Object.freeze({
  maxLoad: { label: "Menor fuerza g máxima", unit: "g", better: "lower", value: run => run.verdict.summary.maxLoad.value },
  margin: { label: "Mayor margen frente a los límites", unit: "g", better: "higher", value: run => loadMargin(run) },
  height: { label: "Menor altura H (menos energía)", unit: "m", better: "lower", value: run => run.config.initialHeight },
  length: { label: "Menor largo", unit: "m", better: "lower", value: run => run.track.totalLength }
});

/**
 * Valor que se minimiza.
 * @param {Objective} objective
 * @param {number} value
 */
export function scoreOf(objective, value) {
  return objective.better === "lower" ? value : -value;
}

/**
 * Qué tan lejos está una corrida de aceptarse (se minimiza para conseguir un
 * diseño que apruebe): 0 si se acepta; menos de 1 si aprueba sin el margen;
 * 1 o más si se rechaza, sumando lo que le faltó recorrer hasta el primer
 * incumplimiento y cuánto se pasó del límite (relativo).
 * @param {any} run
 * @param {boolean} acceptable
 */
export function infeasibility(run, acceptable) {
  if (acceptable) return 0;
  const { verdict, track, history } = run;

  if (verdict.approved) {
    const shortfall = Math.max(0, ...loadMargins(run).map(margin => LOAD_MARGIN - margin.margin));
    return 0.5 + 0.5 * Math.min(1, shortfall / LOAD_MARGIN);
  }

  let reached = 0;
  for (const state of history) if (state.distance > reached) reached = state.distance;
  const missing = 1 - Math.min(1, Math.max(0, reached / track.totalLength));
  const violation = verdict.violations[0];
  return 1 + missing + excessOf(run, violation);
}

/** Rapidez con que llegar a F cuenta como el peor exceso (m/s). */
const OVERRUN_SPEED_SCALE = 20;

/**
 * Exceso relativo del primer incumplimiento, entre 0 y 1. Pasarse de F se
 * mide con la rapidez con que llega (su posición es siempre el límite).
 * @param {any} run
 * @param {any} violation
 */
function excessOf(run, violation) {
  if (violation?.code === "overrun") return Math.min(1, Math.abs(run.final.speed ?? 0) / OVERRUN_SPEED_SCALE);
  if (!violation || !Number.isFinite(violation.value) || !Number.isFinite(violation.limit)) return 1;
  return Math.min(1, Math.abs(violation.value - violation.limit) / excessScale(run, violation));
}

/**
 * Escala del exceso de un incumplimiento según su unidad: una normal se
 * compara con el peso del tren; una fuerza g, una rapidez o un tiempo, con su
 * límite (al menos 1); una distancia, con el largo de la vía.
 * @param {any} run
 * @param {{unit?: string, limit: number}} violation
 */
function excessScale(run, violation) {
  if (violation.unit === "N") return run.config.mass * run.config.gravity;
  if (violation.unit === "m") return Math.max(run.track.totalLength, 1);
  return Math.max(Math.abs(violation.limit), 1);
}
