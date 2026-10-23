import { geometryAt } from "../../physics/track/geometry.js";
import { PALETTE, SECTION_COLORS } from "./palette.js";
import { box, label } from "./draw.js";

const TRACK_WIDTH = 5;
const RAIL_WIDTH = 1.4;
const SECTION_BAND_WIDTH = 16;
const SECTION_LABEL_MIN_PIXELS = 70;
const MARKER_RADIUS = 9;
const MARKER_LIFT = 22;
const SPRING_COILS = 24;
const SPRING_AMPLITUDE = 6;
const HATCH_SPACING = 9;
const EVENT_CROSS = 8;

/** Etiquetas cortas por código de incumplimiento. */
const EVENT_LABELS = Object.freeze({
  contact: "N ≤ 0: pérdida de contacto",
  "loop-contact": "N ≤ 0 en el loop",
  "max-load": "n > n_máx",
  "min-load": "n < n_mín",
  compression: "x > x_máx",
  overrun: "Fin de la zona de frenado",
  reverse: "Retroceso hasta A",
  "min-speed": "v < v_mín en subida",
  timeout: "Tiempo agotado"
});

/**
 * Color de banda de un tramo.
 * @param {any} section
 * @param {any} track
 */
function sectionColor(section, track) {
  if (section.start >= track.brakeStart) return SECTION_COLORS.brake;
  return SECTION_COLORS[/** @type {keyof typeof SECTION_COLORS} */ (section.kind)] ?? SECTION_COLORS.flat;
}

/**
 * Traza la polilínea de los puntos de un tramo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import("./camera.js").Camera} camera
 * @param {any[]} points
 */
function tracePoints(ctx, camera, points) {
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = camera.toX(point.x);
    const y = camera.toY(point.y);
    if (index) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
}

/**
 * Bandas translúcidas por tramo con su nombre.
 * @param {import("./index.js").Frame} frame
 */
export function drawSectionBands({ ctx, camera, scene }) {
  const { track } = scene;
  const z = camera.zoom;

  ctx.lineCap = "butt";
  ctx.lineJoin = "round";

  for (const section of track.sections) {
    const points = track.points.filter((/** @type {any} */ point) => point.segmentIndex === section.index);

    if (points.length < 2) continue;

    ctx.strokeStyle = sectionColor(section, track);
    ctx.lineWidth = SECTION_BAND_WIDTH * z;
    tracePoints(ctx, camera, points);
    ctx.stroke();

    const first = points[0];
    const last = points[points.length - 1];
    const pixelLength = Math.hypot(camera.toX(last.x) - camera.toX(first.x), camera.toY(last.y) - camera.toY(first.y));

    if (pixelLength < SECTION_LABEL_MIN_PIXELS * z || section.kind === "loop") continue;

    const middle = points[Math.floor(points.length / 2)];

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `${9 * z}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(section.name, camera.toX(middle.x), camera.toY(middle.y) + 12 * z);
  }
}

/**
 * Vía principal: trazo exterior y riel central claro.
 * @param {import("./index.js").Frame} frame
 */
export function drawTrack({ ctx, camera, scene }) {
  const z = camera.zoom;

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  tracePoints(ctx, camera, scene.track.points);
  ctx.strokeStyle = PALETTE.track;
  ctx.lineWidth = TRACK_WIDTH * z;
  ctx.stroke();

  tracePoints(ctx, camera, scene.track.points);
  ctx.strokeStyle = PALETTE.trackRail;
  ctx.lineWidth = RAIL_WIDTH * z;
  ctx.stroke();
}

/**
 * Zona de frenado de estación: franja roja rayada con su longitud.
 * @param {import("./index.js").Frame} frame
 */
export function drawBrakeZone({ ctx, camera, scene }) {
  const { track, config } = scene;
  const z = camera.zoom;
  const left = camera.toX(track.brakeX);
  const right = camera.toX(track.endX);
  const top = camera.groundY - 9 * z;
  const height = 15 * z;

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, right - left, height);
  ctx.clip();

  ctx.fillStyle = PALETTE.brakeFill;
  ctx.fillRect(left, top, right - left, height);

  ctx.strokeStyle = PALETTE.brakeHatch;
  ctx.lineWidth = 1.5 * z;
  ctx.beginPath();

  for (let x = left - height; x < right + height; x += HATCH_SPACING * z) {
    ctx.moveTo(x, top + height);
    ctx.lineTo(x + height, top);
  }

  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = PALETTE.brake;
  ctx.lineWidth = 1.5 * z;
  ctx.strokeRect(left, top, right - left, height);

  label(ctx, `FRENOS · d_f = ${config.brakingLength} m · a_f = ${config.brakeDeceleration} m/s²`, (left + right) / 2, camera.groundY + 32 * z, {
    font: `600 ${9 * z}px sans-serif`,
    color: PALETTE.brake,
    background: PALETTE.panel
  });
}

/**
 * Resorte de frenado comprimido según el estado, con su pared.
 * @param {import("./index.js").Frame} frame
 */
export function drawSpring({ ctx, camera, scene }) {
  const { track, config, state } = scene;
  const z = camera.zoom;
  const compression = Math.min(config.brakingLength, state.springCompression);
  const springLeft = camera.toX(track.brakeX + compression);
  const wallX = camera.toX(track.endX);
  const axisY = camera.groundY - 14 * z;

  ctx.strokeStyle = PALETTE.spring;
  ctx.lineWidth = 2 * z;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(springLeft, axisY);

  for (let index = 1; index < SPRING_COILS + 1; index++) {
    ctx.lineTo(
      springLeft + ((wallX - springLeft) * index) / SPRING_COILS,
      axisY + (index % 2 ? -SPRING_AMPLITUDE : SPRING_AMPLITUDE) * z
    );
  }

  ctx.lineTo(wallX, axisY);
  ctx.stroke();

  box(ctx, springLeft - 4 * z, axisY - 12 * z, 5 * z, 24 * z, PALETTE.spring, 2);
  box(ctx, wallX, camera.groundY - 40 * z, 7 * z, 45 * z, PALETTE.wall);

  label(ctx, `RESORTE · k = ${config.springConstant} N/m · x = ${state.springCompression.toFixed(2)} m`, (springLeft + wallX) / 2, camera.groundY + 32 * z, {
    font: `600 ${9 * z}px sans-serif`,
    color: PALETTE.spring,
    background: PALETTE.panel
  });
}

/**
 * Insignias A–F sobre los puntos críticos.
 * @param {import("./index.js").Frame} frame
 */
export function drawMarkers({ ctx, camera, scene }) {
  const z = camera.zoom;
  const radius = MARKER_RADIUS * z;

  for (const marker of scene.track.markers) {
    const geometry = geometryAt(scene.track, marker.distance);
    const x = camera.toX(geometry.x);
    const y = camera.toY(geometry.y);
    const badgeY = y - MARKER_LIFT * z;

    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, badgeY + radius);
    ctx.stroke();

    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.arc(x, badgeY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5 * z;
    ctx.stroke();

    ctx.fillStyle = PALETTE.markerText;
    ctx.font = `bold ${10 * z}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(marker.label, x, badgeY + 0.5 * z);
  }
}

/**
 * Cruz roja con etiqueta en el último incumplimiento registrado.
 * @param {import("./index.js").Frame} frame
 */
export function drawEventMarker({ ctx, camera, scene }) {
  const event = scene.state.events?.at?.(-1);

  if (!event) return;

  const z = camera.zoom;
  const x = camera.toX(event.x);
  const y = camera.toY(event.y);
  const size = EVENT_CROSS * z;

  ctx.strokeStyle = PALETTE.danger;
  ctx.lineWidth = 3 * z;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.stroke();

  const text = EVENT_LABELS[/** @type {keyof typeof EVENT_LABELS} */ (event.code)] ?? event.condition;

  label(ctx, `${text} · t = ${event.time.toFixed(2)} s`, x, y + 24 * z, {
    font: `600 ${10 * z}px sans-serif`,
    color: PALETTE.danger,
    background: PALETTE.panel
  });
}
