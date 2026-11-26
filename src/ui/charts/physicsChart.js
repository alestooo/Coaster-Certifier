/**
 * Creación y actualización de las gráficas físicas con Chart.js.
 * La interfaz solo entrega el historial de estados; aquí no se calcula
 * ninguna magnitud física.
 */
import { Chart, LineController, LineElement, PointElement, LinearScale, Legend, Tooltip } from "chart.js";

// Solo lo que usan las gráficas: con «chart.js/auto» viajaban también barras, tortas, radares y escalas de tiempo.
Chart.register(LineController, LineElement, PointElement, LinearScale, Legend, Tooltip);

import { chartDefinition, yAxisRange, CHART_PALETTE } from "./definitions.js";
import { decimateHistory, DEFAULT_MAX_POINTS } from "./decimate.js";
import { coasterAnnotationsPlugin } from "./annotations.js";
import { readChartTheme, resolveColor } from "./chart-theme.js";

/**
 * @typedef {import("../../physics/integration/step.js").SimulationState} SimulationState
 * @typedef {import("../../physics/config.js").SimulationConfig} SimulationConfig
 * @typedef {import("../../physics/track/builder.js").Track} Track
 * @typedef {import("../../physics/evaluation/criteria.js").ViolationEvent} ViolationEvent
 * @typedef {import("chart.js").Chart<"line", {x: number, y: number}[]>} PhysicsChart
 * @typedef {import("./annotation-types.js").VerticalMarker} VerticalMarker
 */

/**
 * @typedef {Object} UpdateOptions
 * @property {string} kind Tipo de gráfica (ver CHART_KINDS).
 * @property {"time"|"distance"} [xAxis] Magnitud del eje horizontal.
 * @property {SimulationConfig} config Configuración resuelta.
 * @property {Track} [track] Trazado construido.
 * @property {ReadonlyArray<ViolationEvent>} [events] Incumplimientos a marcar.
 * @property {boolean} [markers] Dibujar los puntos críticos A–F.
 * @property {boolean} [sections] Sombrear los tramos del trazado.
 * @property {number} [maxPoints] Máximo de puntos dibujados.
 */

const X_AXIS_TITLES = Object.freeze({ time: "Tiempo (s)", distance: "Posición s (m)" });
const X_AXIS_UNITS = Object.freeze({ time: "s", distance: "m" });
const LINE_WIDTH = 2;
const MAX_DECIMALS = 2;

/**
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  if (!Number.isFinite(value)) return "—";

  return value.toLocaleString("es-CR", { maximumFractionDigits: MAX_DECIMALS });
}

/**
 * Crea una gráfica vacía configurada para el tipo indicado.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string} [kind]
 * @returns {PhysicsChart}
 */
export function createPhysicsChart(canvas, kind = "speed") {
  const definition = chartDefinition(kind);
  // Fuente y colores de los ejes salen de los tokens: la gráfica sigue al sistema de diseño.
  const theme = readChartTheme();
  Chart.defaults.font.family = theme.font;

  /** @type {import("chart.js").ChartConfiguration<"line", {x: number, y: number}[]>} */
  const configuration = {
    type: "line",
    data: { datasets: [] },
    plugins: [coasterAnnotationsPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,
      normalized: true,
      interaction: { mode: "nearest", axis: "x", intersect: false },
      elements: {
        point: { radius: 0, hitRadius: 6 },
        line: { borderWidth: LINE_WIDTH, tension: 0 }
      },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: X_AXIS_TITLES.time, color: theme.text },
          grid: { color: theme.grid },
          ticks: { color: theme.text, maxTicksLimit: 10, callback: value => formatNumber(Number(value)) }
        },
        y: {
          type: "linear",
          title: { display: true, text: definition.yTitle, color: theme.text },
          grid: { color: theme.grid },
          ticks: { color: theme.text, callback: value => formatNumber(Number(value)) }
        }
      },
      plugins: {
        legend: { display: definition.showLegend, position: "bottom", labels: { color: theme.text, boxWidth: 14, usePointStyle: false } },
        tooltip: {
          callbacks: {
            title: items => {
              const first = items[0];
              if (!first) return "";

              const xAxis = first.chart.canvas.dataset.xAxis === "distance" ? "distance" : "time";
              return `${xAxis === "time" ? "t" : "s"} = ${formatNumber(Number(first.parsed.x))} ${X_AXIS_UNITS[xAxis]}`;
            },
            label: item =>
              `${item.dataset.label}: ${formatNumber(Number(item.parsed.y))} ` +
              chartDefinition(String(item.chart.canvas.dataset.kind ?? kind)).unit
          }
        },
        coasterAnnotations: { fontFamily: theme.font }
      }
    }
  };

  canvas.dataset.kind = definition.id;
  canvas.dataset.xAxis = "time";

  return new Chart(canvas, configuration);
}

/**
 * Valor del eje horizontal de un estado.
 * @param {SimulationState} state
 * @param {"time"|"distance"} xAxis
 */
function readX(state, xAxis) {
  return xAxis === "distance" ? state.distance : state.time;
}

/**
 * Convierte una coordenada s del trazado al eje horizontal elegido.
 * Con eje temporal usa el primer estado que alcanza esa posición.
 *
 * @param {ReadonlyArray<SimulationState>} history
 * @param {number} distance
 * @param {"time"|"distance"} xAxis
 * @returns {number | null}
 */
function distanceToX(history, distance, xAxis) {
  if (xAxis === "distance") return distance;

  const reached = history.find(state => state.distance >= distance);
  return reached ? reached.time : null;
}

/**
 * @param {ReadonlyArray<SimulationState>} history
 * @param {UpdateOptions} options
 * @param {"time"|"distance"} xAxis
 * @returns {VerticalMarker[]}
 */
function criticalPointMarkers(history, options, xAxis) {
  if (!options.markers || !options.track) return [];

  return options.track.markers.flatMap(marker => {
    const x = distanceToX(history, marker.distance, xAxis);
    return x === null ? [] : [{ x, label: marker.label, dashed: true }];
  });
}

/**
 * @param {UpdateOptions} options
 * @param {"time"|"distance"} xAxis
 * @returns {VerticalMarker[]}
 */
function eventMarkers(options, xAxis) {
  return (options.events ?? []).map(event => ({
    x: xAxis === "distance" ? event.position : event.time,
    label: `${formatNumber(event.value)} ${event.unit}`,
    color: resolveColor(CHART_PALETTE.marker),
    dashed: false
  }));
}

/**
 * @param {ReadonlyArray<SimulationState>} history
 * @param {UpdateOptions} options
 * @param {"time"|"distance"} xAxis
 */
function sectionBands(history, options, xAxis) {
  if (!options.sections || !options.track) return [];

  return options.track.sections.flatMap(section => {
    const from = distanceToX(history, section.start, xAxis);
    const to = distanceToX(history, section.end, xAxis) ?? readX(history[history.length - 1], xAxis);
    return from === null ? [] : [{ from, to, label: section.name, color: resolveColor(CHART_PALETTE.section) }];
  });
}

/**
 * @param {ReadonlyArray<SimulationState>} history
 * @param {UpdateOptions} options
 * @param {"time"|"distance"} xAxis
 * @returns {VerticalMarker[]}
 */
function brakeMarker(history, options, xAxis) {
  if (!options.track) return [];

  const x = distanceToX(history, options.track.brakeStart, xAxis);
  return x === null ? [] : [{ x, label: "Inicio del frenado (E)", color: resolveColor(CHART_PALETTE.elastic), dashed: true }];
}

/**
 * Actualiza series, ejes y anotaciones de una gráfica existente.
 *
 * @param {PhysicsChart} chart
 * @param {ReadonlyArray<SimulationState>} history Estados consecutivos.
 * @param {UpdateOptions} options
 */
export function updatePhysicsChart(chart, history, options) {
  const definition = chartDefinition(options.kind);
  const xAxis = options.xAxis ?? "time";
  const points = decimateHistory(history, options.maxPoints ?? DEFAULT_MAX_POINTS);
  chart.canvas.dataset.kind = definition.id;
  chart.canvas.dataset.xAxis = xAxis;

  chart.data.datasets = definition.series.map(series => ({
    label: series.label,
    borderColor: resolveColor(series.color),
    backgroundColor: resolveColor(series.color),
    borderDash: series.dashed ? [5, 5] : [],
    borderWidth: series.width ?? LINE_WIDTH,
    data: points.map(state => ({ x: readX(state, xAxis), y: series.read(state) }))
  }));

  const values = chart.data.datasets.flatMap(dataset => dataset.data.map(point => point.y));
  const range = yAxisRange(definition.id, options.config, values);
  const scales = chart.options.scales;

  if (scales?.x?.title) scales.x.title.text = X_AXIS_TITLES[xAxis];

  if (scales?.y) {
    if (scales.y.title) scales.y.title.text = definition.yTitle;
    scales.y.suggestedMin = range.suggestedMin;
    scales.y.suggestedMax = range.suggestedMax;
  }

  if (chart.options.plugins) {
    if (chart.options.plugins.legend) chart.options.plugins.legend.display = definition.showLegend;

    chart.options.plugins.coasterAnnotations = {
      fontFamily: chart.options.plugins.coasterAnnotations?.fontFamily,
      horizontalLines: definition.references(options.config).map(line => ({ ...line, color: line.color && resolveColor(line.color) })),
      band: definition.band(options.config),
      markers: [
        ...criticalPointMarkers(history, options, xAxis),
        ...(definition.brakeMarker ? brakeMarker(history, options, xAxis) : [])
      ],
      events: eventMarkers(options, xAxis),
      sections: sectionBands(history, options, xAxis)
    };
  }

  // "none" omite la animación tanto al cambiar de tipo como al añadir datos.
  chart.update("none");
}

/**
 * Libera los recursos de la gráfica.
 * @param {PhysicsChart | undefined | null} chart
 */
export function destroyPhysicsChart(chart) {
  chart?.destroy();
}

/**
 * Imagen PNG (data URL) de la gráfica, lista para descargar.
 * @param {PhysicsChart} chart
 * @returns {string}
 */
export function chartImageUrl(chart) {
  return chart.toBase64Image();
}
