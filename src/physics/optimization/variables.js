import { CONFIG_LIMITS } from "../config.js";
import { ZONE_LIMITS, withElement } from "../track/elements.js";
import { stretchTrack } from "../recommendations/element-patches.js";
import { RECOMMENDATION_FIELDS } from "../recommendations/fields.js";

/**
 * Valores de diseño que el optimizador puede cambiar. Un id es la clave del
 * valor y, si es de un elemento, su índice: `loopHeight:1`, `initialHeight`.
 * La masa y la fricción no entran: son del tren y las ruedas, no de la pista.
 */

/** Rangos de la Tabla 2 del anexo (SI). */
export const ANNEX_RANGES = Object.freeze({
  initialHeight: /** @type {const} */ ([10, 80]),
  initialSpeed: /** @type {const} */ ([0.5, 5]),
  loopHeight: /** @type {const} */ ([8, 40]),
  loopTopRadius: /** @type {const} */ ([3, 15]),
  hillHeight: /** @type {const} */ ([5, 40]),
  hillCrestRadius: /** @type {const} */ ([5, 60]),
  brakingLength: /** @type {const} */ ([5, 60]),
  brakeDeceleration: /** @type {const} */ ([1, 15])
});

/** Símbolos de cada valor (los del anexo y la interfaz). */
const SYMBOLS = Object.freeze({
  initialHeight: "H",
  initialSpeed: "v₀",
  loopHeight: "h_L",
  loopTopRadius: "R",
  hillHeight: "h_c",
  hillCrestRadius: "ρ_c",
  brakingLength: "d_f",
  brakeDeceleration: "a_f",
  springConstant: "k",
  springDamping: "c_r",
  boosterPower: "P",
  boosterAcceleration: "a_máx",
  trimDamping: "c",
  trackWidth: "W"
});

/** Artículo de cada valor, para las frases («si la altura del loop pasa a…»). */
const MASCULINE = new Set(["loopTopRadius", "hillCrestRadius", "springDamping", "trimDamping", "trackWidth"]);

/** Decimales con que se guarda cada valor (los resultados se leen sin ruido). */
const DECIMALS = Object.freeze({ boosterPower: -2, trimDamping: 0, springConstant: 0, springDamping: 0 });
const DEFAULT_DECIMALS = 2;


/**
 * @typedef {Object} OptimizationVariable
 * @property {string} id
 * @property {string} key
 * @property {number} [element] Índice del elemento del trazado.
 * @property {string} label
 * @property {string} phrase El nombre en una frase, con artículo («la altura del loop»).
 * @property {string} symbol
 * @property {string} unit Unidad en que se muestra.
 * @property {number} scale Divisor para mostrarlo (W → kW: 1000).
 * @property {[number, number]} range Dominio de búsqueda (SI): el rango, extendido hasta el valor de partida.
 * @property {[number, number]} base El rango sin extender (Tabla 2 ∩ configuración, o la configuración).
 * @property {boolean} annex Verdadero si el rango es el de la Tabla 2.
 */

/** @param {string} key */
const digitsOf = key => DECIMALS[/** @type {keyof typeof DECIMALS} */ (key)] ?? DEFAULT_DECIMALS;

/** @param {number} value @param {string} key */
function rounded(value, key) {
  const factor = 10 ** digitsOf(key);
  return Math.round(value * factor) / factor;
}

/**
 * Menor diferencia que se guarda para un valor (su redondeo): un valor está
 * en el borde de su rango si queda a menos que esto.
 * @param {string} id
 */
export function resolution(id) {
  return 10 ** -digitsOf(id.split(":")[0]);
}

/**
 * La misma variable con el dominio extendido hasta `value` (el punto de
 * partida de una corrección): la búsqueda puede volver a llevarla al rango.
 * @param {OptimizationVariable} variable
 * @param {number} value
 * @returns {OptimizationVariable}
 */
export function widen(variable, value) {
  return { ...variable, range: [Math.min(variable.range[0], value), Math.max(variable.range[1], value)] };
}

/** @param {string} id */
function parseId(id) {
  const [key, index] = id.split(":");
  return { key, element: index === undefined ? undefined : Number(index) };
}

/**
 * Lee un valor de diseño.
 * @param {any} config
 * @param {string} id
 * @returns {number}
 */
export function readVariable(config, id) {
  const { key, element } = parseId(id);
  const item = element === undefined ? null : config.track[element];

  switch (key) {
    case "loopHeight":
      return item.loop.height;
    case "loopTopRadius":
      return item.loop.topRadius;
    case "hillHeight":
      return item.height;
    case "hillCrestRadius":
      return item.crestRadius;
    case "boosterPower":
      return item.power;
    case "boosterAcceleration":
      return item.maxAcceleration;
    case "trimDamping":
      return item.damping;
    case "trackWidth":
      return config.track[config.track.length - 1].x;
    default:
      return config[key];
  }
}

/**
 * Devuelve una configuración nueva con el valor cambiado (redondeado); no
 * modifica la recibida.
 * @param {any} config
 * @param {string} id
 * @param {number} value
 */
export function writeVariable(config, id, value) {
  const { key, element } = parseId(id);
  const next = rounded(value, key);

  if (key === "trackWidth") return { ...config, ...stretchTrack(config, next / readVariable(config, id)) };
  if (element === undefined) return { ...config, [key]: next };

  const item = config.track[element];
  /** @type {Record<string, any>} */
  const changes = {
    loopHeight: { loop: { ...item.loop, height: next } },
    loopTopRadius: { loop: { ...item.loop, topRadius: next } },
    hillHeight: { height: next },
    hillCrestRadius: { crestRadius: next },
    boosterPower: { power: next },
    boosterAcceleration: { maxAcceleration: next },
    trimDamping: { damping: next }
  };
  return { ...config, track: withElement(config.track, element, changes[key]) };
}

/**
 * Intersección del rango de la configuración con el del anexo (si se pide),
 * extendida hasta el valor actual: un valor que ya está afuera no se fuerza.
 * @param {readonly [number, number]} limits
 * @param {readonly [number, number] | undefined} annex
 * @param {number} current
 * @returns {{range: [number, number], base: [number, number], annex: boolean}}
 */
function domain(limits, annex, current) {
  const lo = annex ? Math.max(limits[0], annex[0]) : limits[0];
  const hi = annex ? Math.min(limits[1], annex[1]) : limits[1];
  const usable = lo <= hi;
  /** @type {[number, number]} */
  const base = usable ? [lo, hi] : [limits[0], limits[1]];
  return { range: [Math.min(base[0], current), Math.max(base[1], current)], base, annex: Boolean(annex) && usable };
}

/**
 * @param {any} config
 * @param {boolean} annexRanges
 * @param {string} key
 * @param {number} [element]
 * @param {string} [ordinal] Sufijo con el número del elemento cuando hay varios del mismo tipo.
 * @returns {OptimizationVariable}
 */
function variable(config, annexRanges, key, element, ordinal = "") {
  const id = element === undefined ? key : `${key}:${element}`;
  const current = readVariable(config, id);
  const [label, unit] = RECOMMENDATION_FIELDS[/** @type {keyof typeof RECOMMENDATION_FIELDS} */ (key)];
  const annex = annexRanges ? ANNEX_RANGES[/** @type {keyof typeof ANNEX_RANGES} */ (key)] : undefined;
  const limits = limitsFor(key);

  return {
    id,
    key,
    ...(element === undefined ? {} : { element }),
    label: `${label}${ordinal}`,
    phrase: `${MASCULINE.has(key) ? "el" : "la"} ${label.charAt(0).toLowerCase()}${label.slice(1)}${ordinal}`,
    symbol: SYMBOLS[/** @type {keyof typeof SYMBOLS} */ (key)],
    unit,
    scale: key === "boosterPower" ? 1000 : 1,
    ...domain(limits, annex, current)
  };
}

/**
 * Límites de la configuración o de los elementos para una clave.
 * @param {string} key
 * @returns {readonly [number, number]}
 */
function limitsFor(key) {
  if (key === "boosterPower") return ZONE_LIMITS.power;
  if (key === "boosterAcceleration") return ZONE_LIMITS.maxAcceleration;
  if (key === "trimDamping") return ZONE_LIMITS.damping;
  // El ancho no tiene un tope relativo: una geometría imposible ya no se acepta.
  const [lo, hi] = CONFIG_LIMITS[/** @type {keyof typeof CONFIG_LIMITS} */ (key)];
  return [lo, hi];
}

/**
 * « 2» si hay más de un elemento de ese tipo.
 * @param {number} ordinal
 * @param {number} count
 */
const suffix = (ordinal, count) => (count > 1 ? ` ${ordinal}` : "");

/**
 * Valores de diseño que se pueden optimizar en una configuración.
 * @param {any} config Configuración resuelta (con `track`).
 * @param {{annexRanges?: boolean}} [options]
 * @returns {OptimizationVariable[]}
 */
export function optimizationVariables(config, { annexRanges = true } = {}) {
  const make = (/** @type {string} */ key, /** @type {number | undefined} */ element = undefined, /** @type {string} */ ordinal = "") =>
    variable(config, annexRanges, key, element, ordinal);
  /** @type {OptimizationVariable[]} */
  const list = [make("initialHeight"), make("initialSpeed")];
  const track = /** @type {any[]} */ (config.track);
  const count = (/** @type {(element: any) => boolean} */ test) => track.filter(test).length;
  const isLoop = (/** @type {any} */ element) => element.type === "point" && Boolean(element.loop);
  const ordinals = { loop: 0, hill: 0, booster: 0, trim: 0 };

  track.forEach((element, index) => {
    if (isLoop(element)) {
      const ordinal = suffix(++ordinals.loop, count(isLoop));
      list.push(make("loopHeight", index, ordinal), make("loopTopRadius", index, ordinal));
    } else if (element.type === "hill") {
      const ordinal = suffix(++ordinals.hill, count(item => item.type === "hill"));
      list.push(make("hillHeight", index, ordinal), make("hillCrestRadius", index, ordinal));
    } else if (element.type === "booster") {
      const ordinal = suffix(++ordinals.booster, count(item => item.type === "booster"));
      list.push(make("boosterPower", index, ordinal), make("boosterAcceleration", index, ordinal));
    } else if (element.type === "trim") {
      list.push(make("trimDamping", index, suffix(++ordinals.trim, count(item => item.type === "trim"))));
    }
  });

  if (config.brakeMode === "station") list.push(make("brakingLength"), make("brakeDeceleration"));
  else list.push(make("springConstant"), make("springDamping"));
  list.push(make("trackWidth"));

  return list;
}
