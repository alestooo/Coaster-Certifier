import { geometryAt } from "../../physics/track/geometry.js";
import { PALETTE, SECTION_COLORS } from "./palette.js";
import { box, label, tracePolyline } from "./draw.js";

/**
 * Vía tipo "caja": dos rieles, traviesas, larguero y soportes en celosía.
 * Todas las dimensiones en metros; la cámara las convierte a píxeles.
 */

const RAIL_OFFSET_M = 0.34;
const SPINE_OFFSET_M = 0.75;
const TIE_SPACING_M = 1.5;
const SUPPORT_SPACING_M = 10;
const SUPPORT_MIN_HEIGHT_M = 1.6;
const BRACE_SPACING_M = 3;
const BRAKE_FIN_SPACING_M = 1.2;
const MARKER_LIFT_M = 2.6;
const SPRING_COILS = 22;
const EVENT_CROSS_PX = 8;

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
 * Punto de la vía desplazado una distancia (m) a lo largo de su normal.
 * @param {import("./camera.js").Camera} camera
 * @param {{x: number, y: number, angle: number}} point
 * @param {number} offset
 */
function offsetPoint(camera, point, offset) {
  return {
    x: camera.toX(point.x - Math.sin(point.angle) * offset),
    y: camera.toY(point.y + Math.cos(point.angle) * offset)
  };
}

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
 * Resplandor tintado por tramo con su nombre.
 * @param {import("./index.js").Frame} frame
 */
export function drawSectionBands({ ctx, camera, scene }) {
  const { track } = scene;
  const m = (/** @type {number} */ v) => v * camera.scale;

  ctx.lineCap = "butt";
  ctx.lineJoin = "round";

  /** @type {any[]} */
  const allPoints = track.points;

  for (const section of track.sections) {
    const points = allPoints.filter(point => point.segmentIndex === section.index);

    if (points.length < 2) continue;

    ctx.strokeStyle = sectionColor(section, track);
    ctx.lineWidth = Math.max(8, m(2.2));
    tracePolyline(ctx, points.map(point => offsetPoint(camera, point, -SPINE_OFFSET_M / 2)));
    ctx.stroke();

    const first = points[0];
    const last = points[points.length - 1];
    const pixelLength = Math.hypot(camera.toX(last.x) - camera.toX(first.x), camera.toY(last.y) - camera.toY(first.y));

    if (pixelLength < 70 || section.kind === "loop") continue;

    const middle = points[Math.floor(points.length / 2)];

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 ${Math.max(8, Math.min(11, m(0.6)))}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(section.name, camera.toX(middle.x), camera.toY(middle.y) + Math.max(12, m(1.6)));
  }
}

/**
 * Soportes en celosía bajo la vía y columnas junto a los loops.
 * @param {import("./index.js").Frame} frame
 */
export function drawSupports({ ctx, camera, scene }) {
  const { track } = scene;
  const m = (/** @type {number} */ v) => v * camera.scale;
  const groundY = camera.groundY;
  const lineWidth = Math.max(1, m(0.12));

  ctx.lineCap = "butt";
  ctx.lineJoin = "round";

  let nextX = -Infinity;

  for (const point of track.points) {
    if (point.x < nextX || point.kind === "loop" || point.y < SUPPORT_MIN_HEIGHT_M) continue;

    nextX = point.x + SUPPORT_SPACING_M;
    const spine = offsetPoint(camera, point, -SPINE_OFFSET_M);
    const spread = m(0.6 + point.y * 0.12);

    ctx.strokeStyle = PALETTE.support;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(spine.x - m(0.25), spine.y);
    ctx.lineTo(spine.x - spread, groundY);
    ctx.moveTo(spine.x + m(0.25), spine.y);
    ctx.lineTo(spine.x + spread, groundY);

    const height = groundY - spine.y;
    const levels = Math.floor(point.y / BRACE_SPACING_M);

    for (let level = 1; level <= levels; level++) {
      const t = (level * BRACE_SPACING_M) / point.y;
      const y = groundY - height * t;
      const half = spread + (m(0.25) - spread) * t;
      ctx.moveTo(spine.x - half, y);
      ctx.lineTo(spine.x + half, y);

      if (level < levels) {
        const tNext = ((level + 1) * BRACE_SPACING_M) / point.y;
        const yNext = groundY - height * tNext;
        const halfNext = spread + (m(0.25) - spread) * tNext;
        ctx.moveTo(spine.x - half, y);
        ctx.lineTo(spine.x + halfNext, yNext);
      }
    }

    ctx.stroke();
    box(ctx, spine.x - spread - m(0.25), groundY - m(0.3), spread * 2 + m(0.5), m(0.35), PALETTE.footing, 1);
  }

  for (const loop of track.loops) {
    const topX = loop.x + loop.shape * loop.reference * (Math.PI / 2);
    const topY = loop.y + loop.height + SPINE_OFFSET_M;
    const sideX = loop.x + loop.reference * (1 + loop.shape * (Math.PI / 4)) + SPINE_OFFSET_M;
    const sideY = loop.y + loop.reference * (1 + loop.shape / 2);
    const columnX = sideX + 2.2;
    const columnWidth = Math.max(2, m(0.55));

    // Columna exterior al loop con riostras hacia la cima y el costado.
    box(ctx, camera.toX(columnX) - columnWidth / 2, camera.toY(topY + 0.6), columnWidth, groundY - camera.toY(topY + 0.6), PALETTE.supportDark, 1);
    box(ctx, camera.toX(columnX) - columnWidth * 1.4, groundY - m(0.35), columnWidth * 2.8, m(0.4), PALETTE.footing, 1);

    ctx.strokeStyle = PALETTE.supportDark;
    ctx.lineWidth = Math.max(1, m(0.18));
    ctx.beginPath();
    ctx.moveTo(camera.toX(columnX), camera.toY(topY + 0.6));
    ctx.lineTo(camera.toX(topX), camera.toY(topY));
    ctx.moveTo(camera.toX(columnX), camera.toY(sideY));
    ctx.lineTo(camera.toX(sideX), camera.toY(sideY));
    ctx.moveTo(camera.toX(columnX), camera.toY(sideY * 0.5));
    ctx.lineTo(camera.toX(sideX), camera.toY(sideY));
    ctx.stroke();
  }
}

/**
 * Rieles, traviesas y larguero de toda la vía.
 * @param {import("./index.js").Frame} frame
 */
export function drawTrack({ ctx, camera, scene }) {
  drawRails(ctx, camera, scene.track.points);
}

/**
 * Dibuja rieles, traviesas y larguero sobre una secuencia de puntos con
 * ángulo y distancia acumulada (la vía o la rampa de la cadena).
 * @param {CanvasRenderingContext2D} ctx
 * @param {import("./camera.js").Camera} camera
 * @param {ReadonlyArray<{x: number, y: number, angle: number, distance: number}>} points
 * @param {{spine?: string, rail?: string}} [colors]
 */
export function drawRails(ctx, camera, points, colors = {}) {
  const m = (/** @type {number} */ v) => v * camera.scale;

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.strokeStyle = colors.spine ?? PALETTE.spine;
  ctx.lineWidth = Math.max(2.2, m(0.32));
  tracePolyline(ctx, points.map(point => offsetPoint(camera, point, -SPINE_OFFSET_M)));
  ctx.stroke();

  ctx.strokeStyle = PALETTE.tie;
  ctx.lineWidth = Math.max(1, m(0.12));
  ctx.beginPath();
  let nextTie = 0;

  for (const point of points) {
    if (point.distance < nextTie) continue;
    nextTie = point.distance + TIE_SPACING_M;

    const top = offsetPoint(camera, point, RAIL_OFFSET_M + 0.1);
    const bottom = offsetPoint(camera, point, -SPINE_OFFSET_M);
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
  }

  ctx.stroke();

  for (const offset of [RAIL_OFFSET_M, -RAIL_OFFSET_M]) {
    ctx.strokeStyle = colors.rail ?? PALETTE.rail;
    ctx.lineWidth = Math.max(1.6, m(0.2));
    tracePolyline(ctx, points.map(point => offsetPoint(camera, point, offset)));
    ctx.stroke();

    ctx.strokeStyle = PALETTE.railLight;
    ctx.lineWidth = Math.max(0.6, m(0.06));
    tracePolyline(ctx, points.map(point => offsetPoint(camera, point, offset + 0.05)));
    ctx.stroke();
  }
}

/**
 * Aletas de freno entre los rieles (modo frenos) o el tope del resorte.
 * @param {import("./index.js").Frame} frame
 */
export function drawBrakeHardware({ ctx, camera, scene }) {
  const { track, config } = scene;
  const m = (/** @type {number} */ v) => v * camera.scale;
  const railY = camera.groundY;

  if (config.brakeMode === "spring") {
    const wallX = camera.toX(track.endX);
    box(ctx, wallX, railY - m(2.2), Math.max(3, m(0.7)), m(2.2), PALETTE.bumper, Math.max(1, m(0.1)));
    box(ctx, wallX - Math.max(1, m(0.15)), railY - m(1.6), Math.max(2, m(0.2)), m(1.2), PALETTE.bumperFace, 1);
    return;
  }

  for (let x = track.brakeX + 0.6; x < track.endX - 0.3; x += BRAKE_FIN_SPACING_M) {
    const px = camera.toX(x);
    box(ctx, px - m(0.3), railY - m(0.55), Math.max(1.5, m(0.6)), Math.max(1.5, m(0.42)), PALETTE.brakeFin, 1);
    box(ctx, px - m(0.3), railY - m(0.55), Math.max(1.5, m(0.6)), Math.max(0.8, m(0.1)), PALETTE.brakeFinLight, 0);
  }
}

/**
 * Resorte comprimido según el estado (capa dinámica).
 * @param {import("./index.js").Frame} frame
 */
export function drawSpring({ ctx, camera, scene }) {
  const { track, config, state } = scene;
  const m = (/** @type {number} */ v) => v * camera.scale;
  const compression = Math.min(config.brakingLength, state.springCompression);
  const left = camera.toX(track.brakeX + compression);
  const right = camera.toX(track.endX);
  const axisY = camera.groundY - m(0.9);
  const amplitude = Math.max(3, m(0.45));

  ctx.strokeStyle = PALETTE.spring;
  ctx.lineWidth = Math.max(1.5, m(0.14));
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(left, axisY);

  for (let index = 1; index <= SPRING_COILS; index++) {
    ctx.lineTo(left + ((right - left) * index) / SPRING_COILS, axisY + (index % 2 ? -amplitude : amplitude));
  }

  ctx.lineTo(right, axisY);
  ctx.stroke();

  box(ctx, left - Math.max(2, m(0.25)), axisY - amplitude - m(0.2), Math.max(3, m(0.3)), amplitude * 2 + m(0.4), PALETTE.springDark, 1);
}

/**
 * Insignias A–F sobre los puntos críticos.
 * @param {import("./index.js").Frame} frame
 */
export function drawMarkers({ ctx, camera, scene }) {
  const m = (/** @type {number} */ v) => v * camera.scale;
  const radius = Math.max(8, Math.min(13, m(0.9)));
  const lift = Math.max(22, m(MARKER_LIFT_M));

  for (const marker of scene.track.markers) {
    const geometry = geometryAt(scene.track, marker.distance);
    const x = camera.toX(geometry.x);
    const y = camera.toY(geometry.y);
    const badgeY = y - lift;

    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y - m(0.5));
    ctx.lineTo(x, badgeY + radius);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.arc(x, badgeY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = PALETTE.markerText;
    ctx.font = `800 ${Math.round(radius * 1.1)}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(marker.label, x, badgeY + 0.5);
  }
}

/**
 * Cruz roja con etiqueta en el último incumplimiento registrado.
 * @param {import("./index.js").Frame} frame
 */
export function drawEventMarker({ ctx, camera, scene }) {
  const event = scene.state.events?.at?.(-1);

  if (!event) return;

  const x = camera.toX(event.x);
  const y = camera.toY(event.y);
  const size = EVENT_CROSS_PX;

  ctx.strokeStyle = PALETTE.danger;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.stroke();

  const text = EVENT_LABELS[/** @type {keyof typeof EVENT_LABELS} */ (event.code)] ?? event.condition;

  // La etiqueta se aparta del tren: arriba a la derecha de la cruz.
  const labelX = Math.min(camera.width - 120, Math.max(120, x + 90));
  const labelY = Math.max(24, y - Math.max(46, camera.trainScale * 2.4));

  ctx.strokeStyle = PALETTE.danger;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(labelX, labelY + 9);
  ctx.stroke();
  ctx.setLineDash([]);

  label(ctx, `${text} · t = ${event.time.toFixed(2)} s`, labelX, labelY, {
    size: 10,
    color: PALETTE.danger,
    background: PALETTE.panel
  });
}
