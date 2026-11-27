import { resolveConfig } from "../config.js";
import { runSimulation } from "../run.js";
import { buildTrack } from "../track/builder.js";
import { checkDesignConditions } from "../evaluation/verdict.js";
import { recommendationSearch, isAcceptable } from "../recommendations/search.js";
import { changesBetween } from "../recommendations/fields.js";
import { loopElementForSection, crestElementNear } from "../recommendations/element-patches.js";
import { optimizationVariables, readVariable, writeVariable, widen, resolution } from "./variables.js";
import { OBJECTIVES, scoreOf, infeasibility } from "./objectives.js";
import { limitingFactor, runFacts, PROBE_FRACTION } from "./limit.js";

/** Simulaciones que puede gastar una optimización (búsqueda y verificación). */
export const OPTIMIZATION_BUDGET = 300;
/** Evaluaciones de la sección áurea por variable y por vuelta. */
const GOLDEN_EVALUATIONS = 7;
/** Una vuelta que mejora menos que esto (relativo) termina la búsqueda. */
const MIN_CYCLE_IMPROVEMENT = 0.005;
/** Ventana inicial de cada variable: esta fracción de su rango hacia cada lado. */
const INITIAL_WINDOW = 0.35;
/** Paso de las corridas de búsqueda y de la verificación final (s). */
const SEARCH_STEP = 0.02;
const VERIFY_STEP = 0.01;
/** Corridas que se reservan para verificar el resultado (y retroceder si no pasa). */
const VERIFY_RESERVE = 3;
/** Corridas por valor elegido para probar qué limita la mejora (un paso hacia cada lado). */
const LIMIT_PROBES_PER_VARIABLE = 2;
/** Corridas para medir el diseño original y el punto de partida a dt 0,01. */
const MEASURE_RESERVE = 2;
/** Veces que se adopta un paso más que todavía mejora (y se vuelve a probar). */
const MAX_POLISH_ROUNDS = 3;
/** Mejora relativa mínima para aceptar una candidata (por debajo, es ruido de la simulación). */
const IMPROVEMENT_EPS = 1e-4;
/** Mejora relativa mínima del resultado verificado para ofrecerlo. */
const MIN_REPORTED_IMPROVEMENT = 1e-3;
/** Fracción del presupuesto restante para cada vía de factibilidad. */
const FEASIBILITY_SHARE = 0.5;
/** Holgura de la semilla analítica de H sobre el mínimo por energía. */
const SEED_HEAD_FACTOR = 1.06;
const GOLDEN_RATIO = (Math.sqrt(5) - 1) / 2;

/**
 * @typedef {Object} Entry
 * @property {any} config
 * @property {number} score Lo que se minimiza; Infinity si no aprueba con margen.
 * @property {number} value Valor del objetivo en esa corrida.
 * @property {number} penalty Distancia a aprobar (0 si se acepta).
 * @property {ReturnType<typeof runFacts> | null} facts Lo que explica el límite.
 *
 * @typedef {Object} OptimizationProgress
 * @property {"feasibility" | "improve" | "verify"} phase
 * @property {number} tested
 * @property {number} budget
 * @property {number | null} best Mejor valor del objetivo hasta ahora.
 */

/**
 * Valores de un elemento del trazado que el optimizador puede cambiar.
 * @param {any} config
 * @param {number | null} index
 */
function elementVariables(config, index) {
  if (index === null || index === undefined) return [];
  const element = config.track[index];
  if (element?.type === "point" && element.loop) return [`loopHeight:${index}`, `loopTopRadius:${index}`];
  if (element?.type === "hill") return [`hillHeight:${index}`, `hillCrestRadius:${index}`];
  if (element?.type === "booster") return [`boosterPower:${index}`, `boosterAcceleration:${index}`];
  if (element?.type === "trim") return [`trimDamping:${index}`];
  return [];
}

/**
 * Elemento del trazado donde está un tramo (o null).
 * @param {any} config
 * @param {any} track Trazado construido.
 * @param {{section: string, distance: number}} where
 */
function elementAt(config, track, where) {
  const loop = loopElementForSection(config.track, where.section ?? "");
  if (loop !== null) return loop;
  if (/colina|cresta/i.test(where.section ?? "")) return crestElementNear(track, where.distance);

  const zone = track.zones?.find((/** @type {any} */ item) => where.distance >= item.start && where.distance <= item.end);
  return zone?.element ?? null;
}

/**
 * Valores que se cambian por defecto: los del elemento donde ocurre el valor
 * crítico del objetivo, más H (entre 2 y 4).
 * @param {any} input
 * @param {any} run Corrida del diseño.
 * @param {string} objective
 * @returns {string[]}
 */
export function defaultVariables(input, run, objective) {
  const config = resolveConfig(input);
  const track = buildTrack(config);
  const summary = run.verdict.summary;
  /** @type {string[]} */
  let critical = [];

  if (objective === "length") {
    critical = ["trackWidth"];
  } else if (objective === "height") {
    // El elemento que más energía pide (la condición de diseño con menos holgura).
    const tightest = checkDesignConditions(config)
      .filter(check => /^(loop|crest)-/.test(check.id) && Number.isFinite(check.actual) && Number.isFinite(check.limit))
      .sort((a, b) => /** @type {number} */ (a.actual) - /** @type {number} */ (a.limit) - (/** @type {number} */ (b.actual) - /** @type {number} */ (b.limit)))[0];
    if (tightest?.id.startsWith("loop-")) critical = elementVariables(config, loopElementForSection(config.track, tightest.id.slice(5)));
    else if (tightest) critical = elementVariables(config, track.nodes.filter((/** @type {any} */ node) => node.role === "crest")[Number(tightest.id.slice(6)) - 1]?.element ?? null);
  } else {
    const upper = config.maxLoad - summary.maxLoad.value;
    const lower = summary.minLoad.value - (config.contactModel === "strict" ? 0 : config.minLoad);
    const where = objective === "margin" && lower < upper ? summary.minLoad : summary.maxLoad;
    critical = variablesAt(config, track, where);
  }

  // Un diseño rechazado necesita primero lo que lo rechaza: los valores del lugar del primer incumplimiento.
  const violation = run.verdict.approved ? null : run.verdict.violations[0];
  const fixing = violation ? variablesAt(config, track, { section: violation.section, distance: violation.position }) : [];

  const available = new Set(optimizationVariables(config).map(variable => variable.id));
  const wanted = [...new Set([...fixing, ...critical])];
  const ids = [...new Set([...wanted, "initialHeight", "initialSpeed"])].filter(id => available.has(id));
  // Mínimo 2 (el elemento y H, o H y v₀); máximo 4.
  return ids.slice(0, Math.max(2, Math.min(4, wanted.length + 1)));
}

/**
 * Valores del lugar de un punto crítico: los de su elemento o, en la zona de
 * frenado, los del frenado.
 * @param {any} config
 * @param {any} track Trazado construido.
 * @param {{section: string, distance: number}} where
 */
function variablesAt(config, track, where) {
  const own = elementVariables(config, elementAt(config, track, where));
  if (own.length || !(where.distance >= track.brakeStart)) return own;
  return config.brakeMode === "station" ? ["brakingLength", "brakeDeceleration"] : ["springConstant", "springDamping"];
}

/**
 * Busca un diseño mejor para un objetivo, cambiando solo los valores
 * elegidos. Primero consigue un diseño que apruebe (correcciones dentro de los
 * rangos, la H que pide la energía o los valores elegidos acercándose a
 * aprobar); después lo mejora con semillas analíticas y búsqueda por
 * coordenadas cíclica, con sección áurea en cada valor, hasta que las
 * ventanas llegan al paso de la prueba final. El resultado se verifica a
 * dt 0,01 y se prueba un paso más para decir qué lo limita (si ese paso
 * todavía mejora, se adopta). Cada `next()` simula una configuración.
 *
 * @param {any} input
 * @param {{objective?: string, variables?: string[], annexRanges?: boolean, budget?: number}} [options]
 * @returns {Generator<OptimizationProgress, any>}
 */
export function* optimizeDesign(input, { objective = "maxLoad", variables = [], annexRanges = true, budget = OPTIMIZATION_BUDGET } = {}) {
  const config = resolveConfig(input);
  const goal = OBJECTIVES[objective];
  const catalog = optimizationVariables(config, { annexRanges });
  let chosen = variables.map(id => catalog.find(variable => variable.id === id)).filter(variable => variable !== undefined);
  const fail = (/** @type {string} */ reason, tested = 0) => ({ ok: false, objective, reason, tested });

  if (!goal) return fail(`Objetivo desconocido: ${objective}.`);
  if (!chosen.length) return fail("Elegí al menos un valor para cambiar.");

  // Se reservan corridas para medir y verificar el resultado y para probar qué lo limita.
  const reserve = MEASURE_RESERVE + VERIFY_RESERVE + LIMIT_PROBES_PER_VARIABLE * chosen.length;
  const searchBudget = Math.max(1, budget - reserve);
  /** @type {Map<string, Entry>} */
  const cache = new Map();
  let tested = 0;
  let cap = searchBudget;
  let phase = /** @type {OptimizationProgress["phase"]} */ ("feasibility");
  /** @type {Entry | null} */
  let leader = null;
  const progress = () => ({ phase, tested, budget, best: leader ? leader.value : null });

  /** Una configuración que no saca ningún valor de su rango (con la Tabla 2, si está activada). */
  const inDomain = (/** @type {any} */ candidate) =>
    catalog.every(variable => {
      const value = safeRead(candidate, variable.id);
      return value === null || (value >= variable.range[0] - 1e-9 && value <= variable.range[1] + 1e-9);
    });

  /** Simula una candidata (si queda presupuesto); null si no queda. */
  const evaluate = function* (/** @type {any} */ candidate) {
    const key = JSON.stringify(candidate);
    const known = cache.get(key);
    if (known) return known;
    if (tested >= cap) return null;

    tested += 1;
    /** @type {Entry} */
    let entry;
    try {
      const resolved = resolveConfig(candidate);
      const run = runSimulation(resolved, { timeStep: SEARCH_STEP });
      const value = goal.value(run);
      const acceptable = isAcceptable(run);
      entry = { config: resolved, value, score: acceptable ? scoreOf(goal, value) : Infinity, penalty: infeasibility(run, acceptable), facts: runFacts(run) };
    } catch (problem) {
      // Una combinación que no forma una pista válida no se acepta; su mensaje explica por qué.
      const why = problem instanceof Error ? problem.message.replace(/\.$/, "") : null;
      entry = { config: candidate, value: NaN, score: Infinity, penalty: Infinity, facts: null };
      if (why) entry.facts = /** @type {any} */ ({ why, maxLoad: NaN, maxSection: "", sectionMax: {}, margins: [] });
    }
    cache.set(key, entry);
    yield progress();
    return entry;
  };

  /** Corrida completa a dt 0,01 (para medir antes y después con el mismo paso). */
  const measure = function* (/** @type {any} */ candidate) {
    tested += 1;
    const run = runSimulation(candidate, { timeStep: VERIFY_STEP });
    yield progress();
    return run;
  };

  const original = /** @type {Entry} */ (yield* evaluate(config));
  /** @type {Entry | null} */
  let start = Number.isFinite(original.score) ? original : null;

  if (!start) {
    const corrected = yield* feasibleStart(config, Math.floor((searchBudget - tested) * FEASIBILITY_SHARE), done => (tested = done), () => tested, budget, inDomain);
    start = corrected ? yield* evaluate(corrected) : null;

    // Si las correcciones no alcanzan: la H que pide la energía y, si no basta, los valores elegidos acercándose a aprobar.
    if (!start || !Number.isFinite(start.score)) {
      const seed = energySeed(original.config, chosen);
      const seeded = seed ? yield* evaluate(seed) : null;
      const from = seeded && seeded.penalty < original.penalty ? seeded : original;
      const reachable = from.penalty === 0 ? from : yield* approach(from, chosen, evaluate, () => tested, tested + Math.floor((searchBudget - tested) * FEASIBILITY_SHARE));
      start = reachable && Number.isFinite(reachable.score) ? reachable : null;
    }
    if (!start) {
      return fail("El diseño no aprueba y ni las correcciones ni los valores elegidos llegaron a una configuración que apruebe: no hay un punto de partida verificado. Probá con otros valores o sin los rangos del anexo.", tested);
    }
  }

  // El dominio de cada valor llega hasta el punto de partida: la búsqueda puede volver a llevarlo al rango.
  const startConfig = start.config;
  chosen = chosen.map(variable => widen(variable, readVariable(startConfig, variable.id)));

  phase = "improve";
  /** @type {Entry} */
  let current = start;
  leader = current;
  /** @type {Entry[]} */
  const incumbents = [current];
  // Una mejora menor que el ruido de la simulación (relativa) no cuenta.
  const accept = (/** @type {Entry | null} */ entry) => {
    if (!entry || !(entry.score < current.score - IMPROVEMENT_EPS * Math.max(Math.abs(current.score), 1e-9))) return false;
    current = entry;
    leader = entry;
    incumbents.push(entry);
    return true;
  };

  for (const seed of analyticSeeds(current.config, chosen, objective)) accept(yield* evaluate(seed));

  const windows = new Map(chosen.map(variable => [variable.id, (variable.range[1] - variable.range[0]) * INITIAL_WINDOW]));
  const windowOf = (/** @type {import("./variables.js").OptimizationVariable} */ variable) => /** @type {number} */ (windows.get(variable.id));
  const refined = () => chosen.every(variable => windowOf(variable) <= probeStep(variable));

  while (tested < searchBudget) {
    const cycleStart = current.score;

    for (const variable of chosen) {
      if (tested >= searchBudget) break;
      const found = yield* goldenSection(current, variable, windowOf(variable), evaluate);
      if (!accept(found)) windows.set(variable.id, windowOf(variable) / 2);
    }

    const gain = (cycleStart - current.score) / Math.max(Math.abs(cycleStart), 1e-9);
    if (gain >= MIN_CYCLE_IMPROVEMENT) continue;
    // Una vuelta que casi no mejora termina la búsqueda solo si ya se refinó hasta el paso de la prueba.
    if (refined()) break;
    for (const variable of chosen) windows.set(variable.id, Math.max(probeStep(variable), windowOf(variable) / 2));
  }

  phase = "verify";
  cap = budget;
  let checked = yield* verified(incumbents, () => (tested += 1), () => tested, budget);
  if (!checked) return fail("Ningún resultado de la búsqueda pasó la verificación con la simulación completa (dt 0,01 s).", tested);

  // Antes y punto de partida con el mismo paso que el resultado.
  const originalRun = yield* measure(config);
  const before = goal.value(originalRun);
  const corrected = !Number.isFinite(original.score);
  const startValue = corrected ? goal.value(yield* measure(start.config)) : before;

  let limiting = yield* limitingFactor(checked.entry, chosen, goal, objective, evaluate);
  for (let round = 0; limiting.better && round < MAX_POLISH_ROUNDS && tested < budget; round++) {
    const polished = yield* verified([/** @type {Entry} */ (limiting.better)], () => (tested += 1), () => tested, budget);
    if (!polished) break;
    checked = polished;
    limiting = yield* limitingFactor(checked.entry, chosen, goal, objective, evaluate);
  }
  const limitText = limiting.better ? "La búsqueda se cortó por el presupuesto: un paso más de algún valor todavía mejora" : limiting.text;

  const after = goal.value(checked.run);
  const improvement = Number.isFinite(startValue) && startValue !== 0 ? (scoreOf(goal, startValue) - scoreOf(goal, after)) / Math.abs(startValue) : 0;
  const improved = improvement > MIN_REPORTED_IMPROVEMENT;
  const changes = changesBetween(config, checked.entry.config);

  if (!corrected && !improved) {
    return {
      ok: true,
      objective,
      applicable: false,
      improved: false,
      corrected: false,
      startReason: null,
      before,
      start: before,
      after: before,
      improvement: 0,
      config,
      changes: [],
      limiting: { text: limitText },
      tested,
      verified: true,
      reason: "Con esos valores el diseño ya está en su mejor punto: ninguna mejora verificada supera el 0,1 %."
    };
  }

  return {
    ok: true,
    objective,
    // Un diseño corregido se puede aplicar aunque después no mejore: la corrección ya está verificada.
    applicable: changes.length > 0,
    improved,
    corrected,
    startReason: corrected ? (originalRun.verdict.approved ? "margin" : "rejected") : null,
    before,
    start: startValue,
    after,
    improvement,
    config: checked.entry.config,
    changes,
    limiting: { text: limitText },
    tested,
    verified: true,
    reason: ""
  };
}

/**
 * Lee un valor sin fallar si la configuración no lo tiene (null).
 * @param {any} config
 * @param {string} id
 */
function safeRead(config, id) {
  try {
    const value = readVariable(config, id);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Paso de la prueba final de un valor: la búsqueda refina hasta acá.
 * @param {import("./variables.js").OptimizationVariable} variable
 */
function probeStep(variable) {
  return Math.max((variable.range[1] - variable.range[0]) * PROBE_FRACTION, resolution(variable.id));
}

/**
 * Punto de partida que aprueba: la primera corrección verificada.
 * @param {any} config
 * @param {number} available Simulaciones disponibles.
 * @param {(tested: number) => void} setTested
 * @param {() => number} getTested
 * @param {number} budget
 * @param {(config: any) => boolean} filter Las correcciones que no sacan valores de su rango.
 */
function* feasibleStart(config, available, setTested, getTested, budget, filter) {
  if (available <= 1) return null;
  // La búsqueda de correcciones simula el diseño una vez antes de sus candidatas.
  const base = getTested() + 1;
  const search = recommendationSearch(config, { target: 1, maxTested: available - 1, filter });
  let step = search.next();

  while (!step.done) {
    setTested(base + step.value.tested);
    yield { phase: /** @type {const} */ ("feasibility"), tested: getTested(), budget, best: null };
    step = search.next();
  }

  setTested(base + step.value.tested);
  return step.value.recommendations[0]?.config ?? null;
}

/**
 * Factibilidad con los valores elegidos: búsqueda por coordenadas que
 * minimiza la distancia a aprobar hasta llegar a 0 o gastar su parte.
 * @param {Entry} original
 * @param {import("./variables.js").OptimizationVariable[]} chosen
 * @param {(candidate: any) => Generator<any, Entry | null>} evaluate
 * @param {() => number} getTested
 * @param {number} cap Simulaciones hasta las que puede llegar.
 * @returns {Generator<any, Entry | null>}
 */
function* approach(original, chosen, evaluate, getTested, cap) {
  let current = original;
  const windows = new Map(chosen.map(variable => [variable.id, (variable.range[1] - variable.range[0]) * INITIAL_WINDOW]));

  while (getTested() < cap && current.penalty > 0) {
    const cycleStart = current.penalty;
    for (const variable of chosen) {
      if (getTested() >= cap || current.penalty === 0) break;
      const found = yield* goldenSection(current, variable, /** @type {number} */ (windows.get(variable.id)), evaluate, entry => entry.penalty);
      if (found && found.penalty < current.penalty) current = found;
      else windows.set(variable.id, /** @type {number} */ (windows.get(variable.id)) / 2);
    }
    if (!(current.penalty < cycleStart)) break;
  }

  return current.penalty === 0 ? current : null;
}

/**
 * H que piden las condiciones de energía (cada loop y cada cresta), con
 * holgura y dentro del rango; null si H no se puede cambiar o no hay condiciones.
 * @param {any} config
 * @param {import("./variables.js").OptimizationVariable[]} chosen
 */
function energySeed(config, chosen) {
  const height = chosen.find(variable => variable.id === "initialHeight");
  if (!height) return null;

  /** @type {any[]} */
  let checks;
  try {
    checks = checkDesignConditions(config).filter(check => /^(loop|crest)-/.test(check.id) && Number.isFinite(check.actual) && Number.isFinite(check.limit));
  } catch {
    return null;
  }
  if (!checks.length) return null;

  // actual = H + v₀²/(2g) (+ lanzadores): la H que hace falta es H + (límite − actual).
  const needed = Math.max(...checks.map(check => config.initialHeight + check.limit - check.actual));
  const seed = Math.min(height.range[1], Math.max(height.range[0], needed * SEED_HEAD_FACTOR));
  return Math.abs(seed - config.initialHeight) > 1e-6 ? writeVariable(config, "initialHeight", seed) : null;
}

/**
 * Semillas analíticas de la mejora: H en el mínimo por energía (con holgura)
 * para los objetivos que bajan la energía.
 * @param {any} config
 * @param {import("./variables.js").OptimizationVariable[]} chosen
 * @param {string} objective
 */
function analyticSeeds(config, chosen, objective) {
  if (objective !== "height" && objective !== "maxLoad") return [];
  const seed = energySeed(config, chosen);
  return seed && seed.initialHeight < config.initialHeight ? [seed] : [];
}

/**
 * Sección áurea sobre una variable, en una ventana alrededor del valor actual.
 * Lo que no aprueba vale +∞; un empate se resuelve hacia el valor actual.
 * @param {Entry} best
 * @param {import("./variables.js").OptimizationVariable} variable
 * @param {number} window
 * @param {(candidate: any) => Generator<any, Entry | null>} evaluate
 * @param {(entry: Entry) => number} [measure] Lo que se minimiza (por defecto, el objetivo).
 * @returns {Generator<any, Entry | null>}
 */
function* goldenSection(best, variable, window, evaluate, measure = (/** @type {Entry} */ entry) => entry.score) {
  const x0 = readVariable(best.config, variable.id);
  let lo = Math.max(variable.range[0], x0 - window);
  let hi = Math.min(variable.range[1], x0 + window);
  if (!(hi - lo > 1e-9)) return null;

  /** @type {Entry | null} */
  let found = null;
  const at = function* (/** @type {number} */ x) {
    const entry = yield* evaluate(writeVariable(best.config, variable.id, x));
    if (entry && (!found || measure(entry) < measure(found))) found = entry;
    return entry ? measure(entry) : null;
  };

  let c = hi - GOLDEN_RATIO * (hi - lo);
  let d = lo + GOLDEN_RATIO * (hi - lo);
  let fc = yield* at(c);
  let fd = fc === null ? null : yield* at(d);

  for (let evaluations = 2; evaluations < GOLDEN_EVALUATIONS && fc !== null && fd !== null; evaluations++) {
    const left = fc < fd || (fc === fd && x0 <= (c + d) / 2);
    if (left) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - GOLDEN_RATIO * (hi - lo);
      fc = yield* at(c);
    } else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + GOLDEN_RATIO * (hi - lo);
      fd = yield* at(d);
    }
  }

  return found;
}

/**
 * Verifica el mejor resultado con la corrida completa a dt 0,01; si no pasa,
 * retrocede al mejor anterior.
 * @param {Entry[]} incumbents
 * @param {() => void} count
 * @param {() => number} getTested
 * @param {number} budget
 * @returns {Generator<OptimizationProgress, {entry: Entry, run: any} | null>}
 */
function* verified(incumbents, count, getTested, budget) {
  for (const entry of [...incumbents].reverse().slice(0, VERIFY_RESERVE)) {
    count();
    const run = runSimulation(entry.config, { timeStep: VERIFY_STEP });
    yield { phase: "verify", tested: getTested(), budget, best: entry.value };
    if (isAcceptable(run)) return { entry, run };
  }
  return null;
}
