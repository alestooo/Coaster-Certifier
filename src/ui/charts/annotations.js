/**
 * Plugin de Chart.js que dibuja anotaciones sobre las gráficas físicas:
 * líneas horizontales de referencia, banda permitida, marcadores de
 * puntos críticos, marcadores de incumplimientos y bandas por tramo.
 *
 * Qué dibujar se declara en `chart.options.plugins.coasterAnnotations`
 * (ver `annotation-types.d.ts`).
 */

/** @typedef {import("chart.js").Chart} Chart */
/** @typedef {import("./annotation-types.js").CoasterAnnotations} CoasterAnnotations */
/** @typedef {import("./annotation-types.js").VerticalMarker} VerticalMarker */

export const ANNOTATION_PLUGIN_ID = "coasterAnnotations";

const LINE_DASH = Object.freeze([6, 4]);
const MARKER_DASH = Object.freeze([4, 4]);
const LABEL_FONT = "600 10px system-ui, sans-serif";
const LABEL_PADDING = 3;
const LABEL_OFFSET = 4;
const EVENT_LABEL_HEIGHT = 14;
const SECTION_LABEL_FONT = "500 9px system-ui, sans-serif";
const SECTION_TEXT_COLOR = "#9a86ac";
const DEFAULT_LINE_COLOR = "#ba6d77";
const DEFAULT_BAND_COLOR = "rgba(57,147,107,0.10)";
const DEFAULT_MARKER_COLOR = "#8a6ba5";
const DEFAULT_EVENT_COLOR = "#c9444e";
const DEFAULT_SECTION_COLOR = "rgba(128,80,200,0.06)";
const LABEL_BACKGROUND = "rgba(255,255,255,0.85)";

/**
 * @param {Chart} chart
 * @returns {CoasterAnnotations}
 */
function annotationsOf(chart) {
  // Chart.js tipa sus opciones como parciales profundas; aquí se declaran completas.
  return /** @type {CoasterAnnotations} */ (
    /** @type {unknown} */ (chart.options.plugins?.coasterAnnotations ?? {})
  );
}

/**
 * Dibuja una etiqueta pequeña con fondo semitransparente.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {string} color
 * @param {CanvasTextAlign} align
 * @param {CanvasTextBaseline} baseline
 */
function drawLabel(ctx, text, x, y, color, align, baseline) {
  ctx.save();
  ctx.font = LABEL_FONT;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;

  const width = ctx.measureText(text).width + 2 * LABEL_PADDING;
  const left = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
  const top = baseline === "bottom" ? y - EVENT_LABEL_HEIGHT : y;

  ctx.fillStyle = LABEL_BACKGROUND;
  ctx.fillRect(left, top, width, EVENT_LABEL_HEIGHT);
  ctx.fillStyle = color;
  ctx.fillText(text, x + (align === "left" ? LABEL_PADDING : align === "right" ? -LABEL_PADDING : 0), baseline === "bottom" ? y - LABEL_PADDING : y + LABEL_PADDING);
  ctx.restore();
}

/**
 * @param {Chart} chart
 * @param {CanvasRenderingContext2D} ctx
 */
function drawSectionBands(chart, ctx) {
  const { sections = [] } = annotationsOf(chart);
  const { chartArea, scales } = chart;
  const xScale = scales.x;

  if (!xScale || !sections.length) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
  ctx.clip();

  sections.forEach((section, index) => {
    const left = xScale.getPixelForValue(section.from);
    const right = xScale.getPixelForValue(section.to);

    if (right < chartArea.left || left > chartArea.right) return;

    if (index % 2 === 0) {
      ctx.fillStyle = section.color ?? DEFAULT_SECTION_COLOR;
      ctx.fillRect(left, chartArea.top, right - left, chartArea.height);
    }

    ctx.save();
    ctx.font = SECTION_LABEL_FONT;
    ctx.fillStyle = SECTION_TEXT_COLOR;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";

    const textWidth = ctx.measureText(section.label).width;

    if (right - left > textWidth + 2 * LABEL_PADDING) {
      ctx.fillText(section.label, left + LABEL_PADDING, chartArea.bottom - LABEL_PADDING);
    }

    ctx.restore();
  });

  ctx.restore();
}

/**
 * @param {Chart} chart
 * @param {CanvasRenderingContext2D} ctx
 */
function drawHorizontalBand(chart, ctx) {
  const { band } = annotationsOf(chart);
  const { chartArea, scales } = chart;
  const yScale = scales.y;

  if (!band || !yScale) return;

  const top = Math.max(chartArea.top, Math.min(yScale.getPixelForValue(band.to), yScale.getPixelForValue(band.from)));
  const bottom = Math.min(chartArea.bottom, Math.max(yScale.getPixelForValue(band.to), yScale.getPixelForValue(band.from)));

  if (bottom <= top) return;

  ctx.save();
  ctx.fillStyle = band.color ?? DEFAULT_BAND_COLOR;
  ctx.fillRect(chartArea.left, top, chartArea.width, bottom - top);
  ctx.restore();
}

/**
 * @param {Chart} chart
 * @param {CanvasRenderingContext2D} ctx
 */
function drawHorizontalLines(chart, ctx) {
  const { horizontalLines = [] } = annotationsOf(chart);
  const { chartArea, scales } = chart;
  const yScale = scales.y;

  if (!yScale) return;

  for (const line of horizontalLines) {
    const y = yScale.getPixelForValue(line.value);

    if (y < chartArea.top || y > chartArea.bottom) continue;

    const color = line.color ?? DEFAULT_LINE_COLOR;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash(LINE_DASH);
    ctx.beginPath();
    ctx.moveTo(chartArea.left, y);
    ctx.lineTo(chartArea.right, y);
    ctx.stroke();
    ctx.restore();

    drawLabel(ctx, line.label, chartArea.right - LABEL_OFFSET, y - LABEL_OFFSET, color, "right", "bottom");
  }
}

/**
 * @param {Chart} chart
 * @param {CanvasRenderingContext2D} ctx
 * @param {VerticalMarker[]} markers
 * @param {string} defaultColor
 * @param {boolean} labelAtTop
 */
function drawVerticalMarkers(chart, ctx, markers, defaultColor, labelAtTop) {
  const { chartArea, scales } = chart;
  const xScale = scales.x;

  if (!xScale) return;

  markers.forEach((marker, index) => {
    const x = xScale.getPixelForValue(marker.x);

    if (!Number.isFinite(x) || x < chartArea.left - 1 || x > chartArea.right + 1) return;

    const color = marker.color ?? defaultColor;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = marker.dashed === false ? 1.5 : 1;
    ctx.setLineDash(marker.dashed === false ? [] : MARKER_DASH);
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();

    const y = labelAtTop
      ? chartArea.top + LABEL_OFFSET
      : chartArea.top + LABEL_OFFSET + EVENT_LABEL_HEIGHT * (1 + (index % 2));

    drawLabel(ctx, marker.label, x, y, color, "center", "top");
  });
}

/** @type {import("chart.js").Plugin<"line">} */
export const coasterAnnotationsPlugin = {
  id: ANNOTATION_PLUGIN_ID,

  beforeDatasetsDraw(chart) {
    drawSectionBands(chart, chart.ctx);
    drawHorizontalBand(chart, chart.ctx);
  },

  afterDatasetsDraw(chart) {
    const { markers = [], events = [] } = annotationsOf(chart);

    drawHorizontalLines(chart, chart.ctx);
    drawVerticalMarkers(chart, chart.ctx, markers, DEFAULT_MARKER_COLOR, true);
    drawVerticalMarkers(chart, chart.ctx, events, DEFAULT_EVENT_COLOR, false);
  }
};
