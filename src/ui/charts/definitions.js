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
 * @property {string} yTitle Título del eje vertical con unidad.
 * @property {ReadonlyArray<SeriesDefinition>} series
 * @property {(config: SimulationConfig) => ReferenceLine[]} references Líneas horizontales de referencia.
 * @property {(config: SimulationConfig) => {from: number, to: number} | null} band Banda horizontal permitida.
 * @property {boolean} brakeMarker Marca vertical en el inicio del frenado (E).
 */

export const CHART_PALETTE = Object.freeze({
  speed: "#8050cf",
  kinetic: "#d49927",
  gravitational: "#368bc0",
  elastic: "#9b65bb",
  mechanical: "#39936b",
  dissipated: "#cf737b",
  normal: "#8050cf",
  tangential: "#8050cf",
  normalAcceleration: "#39936b",
  load: "#8050cf",
  limit: "#ba6d77",
  band: "rgba(57,147,107,0.10)",
  marker: "#c9444e",
  section: "rgba(128,80,200,0.06)"
});

/** Tipos de gráfica disponibles, en el orden planificado en el Avance 1. */
export const CHART_KINDS = Object.freeze([
  { id: "speed", label: "Rapidez", unit: "m/s" },
  { id: "energy", label: "Energías", unit: "J" },
  { id: "dissipated", label: "Energía disipada acumulada", unit: "J" },
  { id: "normal", label: "Fuerza normal", unit: "N" },
  { id: "acceleration", label: "Aceleraciones", unit: "m/s²" },
  { id: "load", label: "Carga sobre los pasajeros", unit: "g" },
  { id: "spring", label: "Energía elástica del frenado", unit: "J" }
]);

/** Grosor de las líneas de referencia tenues (px). */
const FAINT_LINE_WIDTH = 1.2;

/** @type {ReadonlyArray<SeriesDefinition>} */
const ENERGY_SERIES = Object.freeze([
  { key: "kinetic", label: "Cinética", color: CHART_PALETTE.kinetic, read: state => state.energies.kinetic },
  { key: "gravitational", label: "Potencial gravitatoria", color: CHART_PALETTE.gravitational, read: state => state.energies.gravitational },
  { key: "elastic", label: "Potencial elástica", color: CHART_PALETTE.elastic, read: state => state.energies.elastic },
  { key: "mechanical", label: "Mecánica total", color: CHART_PALETTE.mechanical, read: state => state.energies.mechanical }
]);

/** @param {string} sign @param {number} value */
function loadLabel(sign, value) {
  return `${sign}${Math.abs(value)} g`;
}

/** @type {ReadonlyArray<ChartDefinition>} */
const DEFINITIONS = Object.freeze([
  {
    id: "speed",
    label: "Rapidez",
    unit: "m/s",
    yTitle: "Rapidez (m/s)",
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
    unit: "J",
    yTitle: "Energía (J)",
    series: ENERGY_SERIES,
    references: () => [],
    band: () => null,
    brakeMarker: false
  },
  {
    id: "dissipated",
    label: "Energía disipada acumulada",
    unit: "J",
    yTitle: "Energía (J)",
    series: [
      { key: "dissipated", label: "Disipada acumulada", color: CHART_PALETTE.dissipated, read: state => state.energies.dissipated },
      {
        key: "mechanical",
        label: "Mecánica total (referencia)",
        color: CHART_PALETTE.mechanical,
        read: state => state.energies.mechanical,
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
    yTitle: "Fuerza normal (N)",
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
    yTitle: "Aceleración (m/s²)",
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
    label: "Carga sobre los pasajeros",
    unit: "g",
    yTitle: "Carga n = N/(mg) (g)",
    series: [
      { key: "load", label: "Carga n", color: CHART_PALETTE.load, read: state => state.load }
    ],
    references: config => [
      { value: config.maxLoad, label: loadLabel("+", config.maxLoad), color: CHART_PALETTE.limit },
      { value: config.minLoad, label: loadLabel(config.minLoad < 0 ? "−" : "+", config.minLoad), color: CHART_PALETTE.limit }
    ],
    band: config => ({ from: config.minLoad, to: config.maxLoad }),
    brakeMarker: false
  },
  {
    id: "spring",
    label: "Energía elástica del frenado",
    unit: "J",
    yTitle: "Energía elástica (J)",
    series: [
      { key: "elastic", label: "Resorte ½·k·x²", color: CHART_PALETTE.elastic, read: state => state.energies.elastic }
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
  return DEFINITIONS.find(definition => definition.id === kind) ?? DEFINITIONS[0];
}

/** Margen añadido alrededor de los límites de carga (g). */
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
  const dataMin = finite.length ? Math.min(...finite) : 0;
  const dataMax = finite.length ? Math.max(...finite) : 0;

  if (kind === "load") {
    return {
      suggestedMin: Math.min(config.minLoad, dataMin) - LOAD_RANGE_PADDING,
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
