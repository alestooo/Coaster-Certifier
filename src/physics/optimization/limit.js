import { LOAD_MARGIN } from "../recommendations/search.js";
import { loadMargins, scoreOf } from "./objectives.js";
import { readVariable, writeVariable, resolution } from "./variables.js";

/**
 * Qué limita la mejora: se simula un paso más de cada valor hacia cada lado.
 * - Si el paso mejora y se acepta, la búsqueda no había terminado: se devuelve
 *   para adoptarlo.
 * - Si mejora pero no se acepta, su incumplimiento (o margen) es el límite.
 * - Si el valor está en el borde de su rango (a menos de su redondeo), lo es el borde.
 * - Si ningún lado mejora: un equilibrio entre dos puntos (solo si sus valores
 *   coinciden) o un objetivo que no depende de los valores elegidos.
 * Los textos no terminan en punto: lo pone la interfaz.
 */

/** Paso de la prueba: esta fracción del dominio de cada valor. */
export const PROBE_FRACTION = 0.02;
/** Dos fuerzas g (o márgenes) a menos de esto se consideran iguales (g). */
const BALANCE_TOLERANCE = 0.05;
/** Cambio relativo del objetivo por debajo del cual un valor no influye. */
const INDEPENDENT_TOLERANCE = 1e-4;
/** Cambio de la fuerza g de un tramo por debajo del cual no cambió (g). */
const UNCHANGED_G = 1e-3;
/** Un tramo a menos de esto de la fuerza g máxima también está en el máximo (g). */
const CO_MAXIMUM_G = 0.01;

/** @param {number} value @param {number} [digits] */
function format(value, digits = 2) {
  return new Intl.NumberFormat("es-CR", { maximumFractionDigits: digits }).format(value);
}

/** Artículo según la primera palabra del tramo (los demás llevan «la»). */
const SECTION_ARTICLES = Object.freeze({ loop: "el", lanzador: "el", descenso: "el", plano: "el", resorte: "el", tramo: "el", recorrido: "el", frenos: "los" });

/**
 * El tramo con su artículo: «Loop 1» → «el loop 1», «Colina (subida)» → «la colina (subida)».
 * @param {string | undefined} section
 */
export function sectionPhrase(section) {
  if (!section) return "el recorrido";
  const name = section.charAt(0).toLowerCase() + section.slice(1);
  const first = name.split(/[\s(]/)[0];
  return `${SECTION_ARTICLES[/** @type {keyof typeof SECTION_ARTICLES} */ (first)] ?? "la"} ${name}`;
}

/**
 * «de» con el tramo, contrayendo «de el» en «del».
 * @param {string | undefined} section
 */
export function ofPhrase(section) {
  const phrase = sectionPhrase(section);
  return phrase.startsWith("el ") ? `del ${phrase.slice(3)}` : `de ${phrase}`;
}

/**
 * Hechos de una corrida que hacen falta para explicar el límite.
 * @param {any} run
 */
export function runFacts(run) {
  const { summary } = run.verdict;
  /** @type {Record<string, number>} */
  const sectionMax = {};
  for (const section of summary.sections) if (section.reached) sectionMax[section.name] = section.maxLoad;
  return { why: rejection(run), maxLoad: summary.maxLoad.value, maxSection: summary.maxLoad.section, sectionMax, margins: loadMargins(run) };
}

/**
 * Por qué una corrida no se acepta (null si se acepta): el primer
 * incumplimiento del dictamen o el margen que no se respeta.
 * @param {any} run
 * @returns {string | null}
 */
export function rejection(run) {
  const { verdict, config } = run;
  const violation = verdict.violations[0];

  if (!verdict.approved && violation) {
    // El nombre del criterio, sin su fórmula (sus símbolos llevan subíndices que el texto no muestra).
    const [name] = String(violation.condition).split(":").map(part => part.trim());
    return `${name.charAt(0).toLowerCase()}${name.slice(1)} en ${sectionPhrase(violation.section)}`;
  }
  if (!verdict.approved) return "el recorrido no termina detenido en la zona de frenado";

  const tight = loadMargins(run).find(margin => margin.margin < LOAD_MARGIN);
  if (!tight) return null;

  const limit = tight.kind === "upper" ? `${format(config.maxLoad)} g` : tight.kind === "lower" && config.contactModel !== "strict" ? `${format(config.minLoad)} g` : "0 g (contacto)";
  const what = tight.kind === "upper" ? "la fuerza g máxima" : tight.kind === "loop" ? "la fuerza g en la cima" : "la fuerza g mínima";
  return `${what} quedaría en ${format(tight.value)} g en ${sectionPhrase(tight.section)}, sin el margen de ${format(LOAD_MARGIN)} g frente a ${limit}`;
}

/**
 * «la fuerza g máxima en el loop 1 (margen de 0,75 g)».
 * @param {import("./objectives.js").LoadMargin} margin
 */
function marginName(margin) {
  const where = sectionPhrase(margin.section);
  const what =
    margin.kind === "upper" ? `la fuerza g máxima en ${where}` : margin.kind === "lower" ? `la fuerza g mínima en ${where}` : `el contacto en la cima ${ofPhrase(margin.section)}`;
  return `${what} (margen de ${format(margin.margin)} g)`;
}

/**
 * @typedef {ReturnType<typeof runFacts>} Facts
 *
 * @typedef {Object} ProbeEntry
 * @property {any} config
 * @property {number} score
 * @property {number} value
 * @property {Facts | null} facts
 */

/**
 * Equilibrio de la fuerza g máxima: un paso baja la de un tramo que estaba en
 * el máximo y sube la de otro, que pasa a ser el máximo.
 * @param {Facts} best
 * @param {Facts[]} neighbors Corridas aceptadas a un paso.
 */
function loadBalance(best, neighbors) {
  for (const neighbor of neighbors) {
    const risen = neighbor.maxSection;
    const before = best.sectionMax[risen];
    if (!risen || before === undefined || !(neighbor.sectionMax[risen] > before + UNCHANGED_G)) continue;
    const fallen = coMaxima(best).find(section => section !== risen && neighbor.sectionMax[section] < best.sectionMax[section] - UNCHANGED_G);
    if (fallen) return `Se equilibra la fuerza g máxima ${ofPhrase(fallen)} con la ${ofPhrase(risen)}: bajarla en uno la sube en el otro`;
  }
  return null;
}

/**
 * Tramos que están en la fuerza g máxima del resultado (o casi).
 * @param {Facts} best
 */
function coMaxima(best) {
  return Object.keys(best.sectionMax).filter(section => best.sectionMax[section] >= best.maxLoad - CO_MAXIMUM_G);
}

/**
 * Un tramo en el máximo cuya fuerza g no cambia con ningún paso: es él el que
 * fija el máximo, y no depende de los valores elegidos.
 * @param {Facts} best
 * @param {Facts[]} neighbors
 */
function fixedMaximum(best, neighbors) {
  if (!neighbors.length) return null;
  return coMaxima(best).find(section => neighbors.every(neighbor => Math.abs((neighbor.sectionMax[section] ?? Infinity) - best.sectionMax[section]) <= UNCHANGED_G)) ?? null;
}

/**
 * Equilibrio que frena la mejora cuando ningún paso mejora: solo si de
 * verdad ocurre (dos márgenes iguales, o un máximo que pasa de un tramo a otro).
 * @param {string} objective
 * @param {Facts} best
 * @param {Facts[]} neighbors Corridas aceptadas a un paso.
 */
function balance(objective, best, neighbors) {
  if (objective === "maxLoad") return loadBalance(best, neighbors);
  if (objective === "margin") {
    const [first, second] = [...best.margins].sort((a, b) => a.margin - b.margin);
    if (second && second.margin - first.margin <= BALANCE_TOLERANCE) return `Se equilibran ${marginName(first)} y ${marginName(second)}`;
  }
  return null;
}

/**
 * El objetivo no cambia con ningún valor elegido.
 * @param {string} objective
 * @param {Facts | null} facts
 */
function independenceText(objective, facts) {
  if (objective === "maxLoad" && facts) return `La fuerza g máxima (${format(facts.maxLoad)} g en ${sectionPhrase(facts.maxSection)}) no depende de los valores elegidos`;
  if (objective === "margin" && facts) {
    const [first] = [...facts.margins].sort((a, b) => a.margin - b.margin);
    return `El margen más chico, ${marginName(first)}, no depende de los valores elegidos`;
  }
  if (objective === "height") return "La altura H no depende de los valores elegidos: hay que elegir H";
  return "El largo no depende de los valores elegidos";
}

/**
 * Texto del borde de un valor: el del rango (anexo o configuración) o, si el
 * valor ya estaba afuera, que no se lo lleva más lejos.
 * @param {import("./variables.js").OptimizationVariable} variable
 * @param {"mínimo" | "máximo"} side
 */
function boundText(variable, side) {
  const [lo, hi] = variable.base;
  const bound = side === "mínimo" ? variable.range[0] : variable.range[1];
  const show = (/** @type {number} */ value) => `${format(value / variable.scale)} ${variable.unit}`.trim();
  const inBase = side === "mínimo" ? Math.abs(bound - lo) <= resolution(variable.id) : Math.abs(bound - hi) <= resolution(variable.id);

  if (inBase) return `${variable.label} llegó al ${side} ${variable.annex ? "del rango del anexo" : "de su rango"}: ${show(bound)}`;
  return `${variable.label} ya estaba fuera ${variable.annex ? "del rango del anexo" : "de su rango"} (${show(lo)} a ${show(hi)}) y no se lo lleva más lejos`;
}

/**
 * Prueba cada valor un paso más allá del resultado.
 * @param {ProbeEntry} best Resultado (aceptado).
 * @param {import("./variables.js").OptimizationVariable[]} chosen
 * @param {import("./objectives.js").Objective} goal
 * @param {string} objective
 * @param {(candidate: any) => Generator<any, ProbeEntry | null>} evaluate
 * @returns {Generator<any, {text: string, better?: ProbeEntry}>}
 */
export function* limitingFactor(best, chosen, goal, objective, evaluate) {
  /** @type {string[]} */
  const bounds = [];
  /** @type {string[]} */
  const balances = [];
  let independent = 0;
  /** @type {Facts[]} */
  const allNeighbors = [];
  const tolerance = Math.max(1e-9, INDEPENDENT_TOLERANCE * Math.abs(best.value));

  for (const variable of chosen) {
    const x = readVariable(best.config, variable.id);
    const [lo, hi] = variable.range;
    const step = Math.max((hi - lo) * PROBE_FRACTION, resolution(variable.id));
    /** @type {{x: number, entry: ProbeEntry}[]} */
    const tried = [];
    /** @type {("mínimo" | "máximo")[]} */
    const atBound = [];

    for (const direction of [-1, 1]) {
      const bound = direction < 0 ? lo : hi;
      if (Math.abs(x - bound) <= resolution(variable.id)) {
        atBound.push(direction < 0 ? "mínimo" : "máximo");
        continue;
      }
      // Cerca del borde, la prueba es el borde mismo.
      const next = direction < 0 ? Math.max(lo, x - step) : Math.min(hi, x + step);
      const entry = yield* evaluate(writeVariable(best.config, variable.id, next));
      if (!entry) return { text: summaryText(bounds, balances) };
      tried.push({ x: next, entry });
    }

    const better = tried
      .filter(item => Number.isFinite(item.entry.value) && scoreOf(goal, item.entry.value) < best.score - tolerance)
      .sort((a, b) => scoreOf(goal, a.entry.value) - scoreOf(goal, b.entry.value))[0];

    // Un paso más mejora y se acepta: la búsqueda no había terminado.
    if (better && Number.isFinite(better.entry.score)) return { text: "", better: better.entry };
    if (better) {
      const why = better.entry.facts?.why ?? "la pista no se puede armar con ese valor";
      return { text: capitalize(`${why}, si ${variable.phrase} pasa a ${format(better.x / variable.scale)} ${variable.unit}`.trim()) };
    }

    // Ningún lado cambia el objetivo: este valor no influye.
    if (tried.length && tried.every(item => Number.isFinite(item.entry.value) && Math.abs(item.entry.value - best.value) <= tolerance)) {
      independent += 1;
      continue;
    }
    if (atBound.length) {
      bounds.push(boundText(variable, atBound[0]));
      continue;
    }

    const neighbors = tried.flatMap(item => (item.entry.facts && Number.isFinite(item.entry.score) ? [item.entry.facts] : []));
    allNeighbors.push(...neighbors);
    const text = best.facts ? balance(objective, best.facts, neighbors) : null;
    if (text) balances.push(text);
  }

  // La fuerza g máxima la fija un tramo que ningún valor elegido mueve.
  const fixed = objective === "maxLoad" && best.facts && !bounds.length ? fixedMaximum(best.facts, allNeighbors) : null;
  if (fixed && best.facts) return { text: `La fuerza g máxima (${format(best.facts.sectionMax[fixed])} g en ${sectionPhrase(fixed)}) no depende de los valores elegidos` };
  if (!bounds.length && !balances.length && independent === chosen.length) return { text: independenceText(objective, best.facts) };
  return { text: summaryText(bounds, balances) };
}

/**
 * Texto cuando ningún paso más choca con un criterio: un borde del rango, un
 * equilibrio o, si no, un óptimo local.
 * @param {string[]} bounds
 * @param {string[]} balances
 */
function summaryText(bounds, balances) {
  return bounds[0] ?? balances[0] ?? "Ningún cambio pequeño de los valores elegidos mejora el objetivo: es un óptimo local";
}

/** @param {string} text */
function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
