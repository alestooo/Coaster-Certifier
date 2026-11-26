/**
 * Definiciones de las gráficas en tiempo real.
 *
 * Cada tipo de gráfica declara sus series (qué magnitud del estado lee,
 * con qué etiqueta y color), el título de su eje vertical con unidad y
 * las referencias que se dibujan encima (líneas límite, bandas).
 * No contiene fórmulas físicas: solo lee valores ya calculados.
 */

/**
 * @typedef {import("../../physics/integration/step.js").SimulationState} SimulationState
 * @typedef {import("../../physics/config.js").SimulationConfig} SimulationConfig
 */

/**
 * @typedef {Object} SeriesDefinition
 * @property {string} key Identificador de la serie.
 * @property {string} label Etiqueta mostrada en la leyenda.
 * @property {string} color Color de la línea.
 * @property {(state: SimulationState) => number} read Lee el valor del estado.
 * @property {boolean} [dashed] Línea discontinua (referencias tenues).
 * @property {number} [width] Grosor de línea en píxeles.
 */

/**
 * @typedef {Object} ReferenceLine
 * @property {number} value Valor en el eje vertical.
 * @property {string} label Etiqueta corta mostrada junto a la línea.
 * @property {string} [color]
 */

/**
 * @typedef {Object} ChartDefinition
 * @property {string} id
 * @property {string} label
 * @property {string} unit
 * @property {string} yTitle Título del eje vertical: símbolo y unidad (el encabezado de la tarjeta nombra la magnitud).
 * @property {ReadonlyArray<SeriesDefinition>} series
 * @property {(config: SimulationConfig) => ReferenceLine[]} references Líneas horizontales de referencia.
 * @property {(config: SimulationConfig) => {from: number, to: number} | null} band Banda horizontal permitida.
 * @property {boolean} brakeMarker Marca vertical en el inicio del frenado (E).
 * @property {boolean} showLegend Leyenda solo con más de una serie (con una, el título ya la nombra).
 */

/**
 * Colores de las series y referencias. Los sólidos son tokens del sistema
 * de diseño (los resuelve chart-theme.js); los translúcidos son literales.
 */
export const CHART_PALETTE = Object.freeze({
  speed: "var(--primary)",
  kinetic: "var(--accent)",
  gravitational: "var(--float)",
  elastic: "var(--primary)",
  mechanical: "var(--success)",
  dissipated: "var(--danger)",
  normal: "var(--primary)",
  tangential: "var(--primary)",
  normalAcceleration: "var(--success)",
  load: "var(--primary)",
  limit: "var(--danger)",
  band: "rgba(57,147,107,0.10)",
  marker: "var(--danger)",
  section: "rgba(128,80,200,0.06)"
});

/** Tipos de gráfica disponibles, en el orden planificado en el Avance 1. */
export const CHART_KINDS = Object.freeze([
  { id: "speed", label: "Rapidez", unit: "m/s" },
  { id: "energy", label: "Energías", unit: "kJ" },
  { id: "dissipated", label: "Energía disipada acumulada", unit: "kJ" },
  { id: "normal", label: "Fuerza normal", unit: "N" },
  { id: "acceleration", label: "Aceleraciones", unit: "m/s²" },
  { id: "load", label: "Fuerza g", unit: "g" },
  { id: "spring", label: "Energía elástica del frenado", unit: "kJ" }
]);

/** Grosor de las líneas de referencia tenues (px). */
const FAINT_LINE_WIDTH = 1.2;

/** Las energías se grafican en kJ (el CSV las conserva en J). */
const J_PER_KJ = 1000;

/**
 * Lee una energía del estado en kJ.
 * @param {"kinetic"|"gravitational"|"elastic"|"mechanical"|"dissipated"} key
 * @returns {(state: SimulationState) => number}
 */
const energyKj = key => state => state.energies[key] / J_PER_KJ;

/** @type {ReadonlyArray<SeriesDefinition>} */
const ENERGY_SERIES = Object.freeze([
  { key: "kinetic", label: "Cinética", color: CHART_PALETTE.kinetic, read: energyKj("kinetic") },
  { key: "gravitational", label: "Potencial gravitatoria", color: CHART_PALETTE.gravitational, read: energyKj("gravitational") },
  { key: "elastic", label: "Elástica ½·k·x²", color: CHART_PALETTE.elastic, read: energyKj("elastic") },
  { key: "mechanical", label: "Mecánica total", color: CHART_PALETTE.mechanical, read: energyKj("mechanical") }
]);

/** Signo menos tipográfico, como en el resto de la interfaz. */
const MINUS = "−";

/** Etiqueta de un límite de fuerza g: «+5 g», «0 g», «−1 g». @param {number} value */
function loadLabel(value) {
  const sign = value > 0 ? "+" : value < 0 ? MINUS : "";
  return `${sign}${Math.abs(value)} g`;
}

/**
 * Límite inferior de fuerza g que aplica el motor: con «siempre apoyado» es 0 g
 * (rechaza N ≤ 0); con ruedas anti-levantamiento, n_mín.
 * @param {SimulationConfig} config
 */
export function lowerLoadLimit(config) {
  return config.contactModel === "strict" ? 0 : config.minLoad;
}

/** @type {ReadonlyArray<Omit<ChartDefinition, "showLegend">>} */
const DEFINITIONS = Object.freeze([
  {
    id: "speed",
    label: "Rapidez",
    unit: "m/s",
    yTitle: "v (m/s)",
    series: [
      { key: "speed", label: "Rapidez", color: CHART_PALETTE.speed, read: state => state.speed }
    ],
    references: () => [],
    band: () => null,
    brakeMarker: false
  },
  {
    id: "energy",
    label: "Energías",
    unit: "kJ",
    yTitle: "E (kJ)",
    series: ENERGY_SERIES,
    references: () => [],
    band: () => null,
    brakeMarker: false
  },
  {
    id: "dissipated",
    label: "Energía disipada acumulada",
    unit: "kJ",
    yTitle: "E (kJ)",
    series: [
      { key: "dissipated", label: "Disipada acumulada", color: CHART_PALETTE.dissipated, read: energyKj("dissipated") },
      {
        key: "mechanical",
        label: "Mecánica total (referencia)",
        color: CHART_PALETTE.mechanical,
        read: energyKj("mechanical"),
        dashed: true,
        width: FAINT_LINE_WIDTH
      }
    ],
    references: () => [],
    band: () => null,
    brakeMarker: false
  },
  {
    id: "normal",
    label: "Fuerza normal",
    unit: "N",
    yTitle: "N (N)",
    series: [
      { key: "normal", label: "Normal N", color: CHART_PALETTE.normal, read: state => state.forces.normal }
    ],
    references: () => [{ value: 0, label: "N = 0", color: CHART_PALETTE.limit }],
    band: () => null,
    brakeMarker: false
  },
  {
    id: "acceleration",
    label: "Aceleraciones",
    unit: "m/s²",
    yTitle: "a (m/s²)",
    series: [
      { key: "tangential", label: "Tangencial a_t", color: CHART_PALETTE.tangential, read: state => state.tangentialAcceleration },
      { key: "normalAcceleration", label: "Normal a_n (con signo)", color: CHART_PALETTE.normalAcceleration, read: state => state.normalAcceleration }
    ],
    references: () => [{ value: 0, label: "0", color: CHART_PALETTE.limit }],
    band: () => null,
    brakeMarker: false
  },
  {
    id: "load",
    label: "Fuerza g",
    unit: "g",
    yTitle: "n (g)",
    series: [
      { key: "load", label: "Fuerza g (n)", color: CHART_PALETTE.load, read: state => state.load }
    ],
    references: config => [
      { value: config.maxLoad, label: loadLabel(config.maxLoad), color: CHART_PALETTE.limit },
      { value: lowerLoadLimit(config), label: loadLabel(lowerLoadLimit(config)), color: CHART_PALETTE.limit }
    ],
    band: config => ({ from: lowerLoadLimit(config), to: config.maxLoad }),
    brakeMarker: false
  },
  {
    id: "spring",
    label: "Energía elástica del frenado",
    unit: "kJ",
    yTitle: "U (kJ)",
    series: [
      { key: "elastic", label: "Elástica ½·k·x²", color: CHART_PALETTE.elastic, read: energyKj("elastic") }
    ],
    references: () => [],
    band: () => null,
    brakeMarker: true
  }
]);

/**
 * Definición de una gráfica; si el tipo no existe devuelve la de rapidez.
 * @param {string} kind
 * @returns {ChartDefinition}
 */
export function chartDefinition(kind) {
  const definition = DEFINITIONS.find(candidate => candidate.id === kind) ?? DEFINITIONS[0];
  return { ...definition, showLegend: definition.series.length > 1 };
}

/** Margen añadido alrededor de los límites de fuerza g (g). */
const LOAD_RANGE_PADDING = 0.5;

/**
 * Rango sugerido del eje vertical según el tipo de gráfica.
 *
 * @param {string} kind
 * @param {SimulationConfig} config
 * @param {number[]} values Valores dibujados.
 * @returns {{suggestedMin?: number, suggestedMax?: number}}
 */
export function yAxisRange(kind, config, values) {
  const finite = values.filter(Number.isFinite);
  const dataMin = finite.length ? finite.reduce((low, value) => Math.min(low, value), Infinity) : 0;
  const dataMax = finite.length ? finite.reduce((high, value) => Math.max(high, value), -Infinity) : 0;

  if (kind === "load") {
    return {
      suggestedMin: Math.min(lowerLoadLimit(config), dataMin) - LOAD_RANGE_PADDING,
      suggestedMax: Math.max(config.maxLoad, dataMax) + LOAD_RANGE_PADDING
    };
  }

  if (kind === "normal") {
    return { suggestedMin: Math.min(0, dataMin) };
  }

  if (kind === "speed" || kind === "energy" || kind === "dissipated" || kind === "spring") {
    return { suggestedMin: 0 };
  }

  return {};
}
