/**
 * Gráficas físicas en tiempo real (Chart.js).
 *
 * API pública consumida por la interfaz:
 *   createPhysicsChart(canvas, kind) → Chart
 *   updatePhysicsChart(chart, history, options)
 *   destroyPhysicsChart(chart)
 *   chartImageUrl(chart) → data URL PNG
 */
export { CHART_KINDS, CHART_PALETTE, chartDefinition } from "./definitions.js";
export { decimateHistory, DEFAULT_MAX_POINTS } from "./decimate.js";
export { coasterAnnotationsPlugin, ANNOTATION_PLUGIN_ID } from "./annotations.js";

export {
  createPhysicsChart,
  updatePhysicsChart,
  destroyPhysicsChart,
  chartImageUrl,
  formatNumber
} from "./physicsChart.js";
