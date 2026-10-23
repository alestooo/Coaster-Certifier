import { PALETTE } from "./palette.js";
import { panel, arrow, clamp, fmt } from "./draw.js";
import { CART } from "./train.js";

const GAUGE = Object.freeze({
  radius: 44,
  marginRight: 74,
  centerY: 86,
  ring: 11,
  needle: 0.82,
  panelWidth: 128,
  panelHeight: 100,
  panelTop: 20,
  nearBand: 0.12,
  padding: 1
});

const HUD_PANEL = Object.freeze({ left: 16, top: 16, width: 206, height: 84, line: 17 });

/** Píxeles de flecha por cada peso (m·g) de fuerza. */
const ARROW_PX_PER_WEIGHT = 42;
const MAX_ARROW_WEIGHTS = 6;
const MPS_TO_KMH = 3.6;

/**
 * Color semántico de una carga respecto a los límites.
 * @param {number} load
 * @param {number} minLoad
 * @param {number} maxLoad
 */
function loadColor(load, minLoad, maxLoad) {
  const band = GAUGE.nearBand * (maxLoad - minLoad);

  if (load < minLoad || load > maxLoad) return PALETTE.danger;
  if (load < minLoad + band || load > maxLoad - band) return PALETTE.warning;
  return PALETTE.safe;
}

/**
 * Indicador semicircular de carga n = N/(mg).
 * @param {import("./index.js").Frame} frame
 */
export function drawGauge({ ctx, camera, scene }) {
  const { config, state } = scene;
  const centerX = camera.width - GAUGE.marginRight;
  const centerY = GAUGE.centerY;
  const low = config.minLoad - GAUGE.padding;
  const high = config.maxLoad + GAUGE.padding;
  const angleFor = (/** @type {number} */ value) => Math.PI + ((clamp(value, low, high) - low) / (high - low)) * Math.PI;
  const band = GAUGE.nearBand * (config.maxLoad - config.minLoad);

  panel(
    ctx,
    centerX - GAUGE.panelWidth / 2,
    GAUGE.panelTop,
    GAUGE.panelWidth,
    GAUGE.panelHeight,
    PALETTE.panel,
    PALETTE.panelBorder
  );

  const zones = [
    [low, config.minLoad, PALETTE.danger],
    [config.minLoad, config.minLoad + band, PALETTE.warning],
    [config.minLoad + band, config.maxLoad - band, PALETTE.safe],
    [config.maxLoad - band, config.maxLoad, PALETTE.warning],
    [config.maxLoad, high, PALETTE.danger]
  ];

  ctx.lineWidth = GAUGE.ring;
  ctx.lineCap = "butt";

  for (const [from, to, color] of zones) {
    ctx.strokeStyle = /** @type {string} */ (color);
    ctx.beginPath();
    ctx.arc(centerX, centerY, GAUGE.radius, angleFor(Number(from)), angleFor(Number(to)));
    ctx.stroke();
  }

  const needleAngle = angleFor(state.load);

  ctx.strokeStyle = PALETTE.text;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(
    centerX + Math.cos(needleAngle) * GAUGE.radius * GAUGE.needle,
    centerY + Math.sin(needleAngle) * GAUGE.radius * GAUGE.needle
  );
  ctx.stroke();

  ctx.fillStyle = PALETTE.text;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "9px sans-serif";
  ctx.fillStyle = PALETTE.muted;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`${fmt(config.minLoad, 0)} g`, centerX - GAUGE.radius - 8, centerY + 4);
  ctx.textAlign = "right";
  ctx.fillText(`${fmt(config.maxLoad, 0)} g`, centerX + GAUGE.radius + 8, centerY + 4);

  ctx.textAlign = "center";
  ctx.font = "bold 15px sans-serif";
  ctx.fillStyle = loadColor(state.load, config.minLoad, config.maxLoad);
  ctx.fillText(`${fmt(state.load, 2)} g`, centerX, centerY + 6);

  ctx.font = "9px sans-serif";
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText("carga N/(mg)", centerX, centerY + 24);
}

/**
 * Lecturas numéricas principales.
 * @param {import("./index.js").Frame} frame
 */
export function drawHudText({ ctx, scene }) {
  const { state } = scene;

  panel(ctx, HUD_PANEL.left, HUD_PANEL.top, HUD_PANEL.width, HUD_PANEL.height, PALETTE.panel, PALETTE.panelBorder);

  const rows = [
    ["Rapidez", `${fmt(state.speed, 2)} m/s · ${fmt(state.speed * MPS_TO_KMH, 0)} km/h`],
    ["Carga", `${fmt(state.load, 2)} g`],
    ["Tramo", state.section],
    ["Tiempo", `${fmt(state.time, 2)} s`]
  ];

  ctx.textBaseline = "middle";

  rows.forEach(([name, value], index) => {
    const y = HUD_PANEL.top + 14 + index * HUD_PANEL.line;

    ctx.textAlign = "left";
    ctx.font = "600 10px sans-serif";
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(name, HUD_PANEL.left + 12, y);

    ctx.textAlign = "right";
    ctx.font = "600 11px sans-serif";
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(value, HUD_PANEL.left + HUD_PANEL.width - 12, y);
  });
}

/**
 * Flechas de las fuerzas sobre el tren: peso (P), normal (N) y
 * fricción/frenos (f); resorte (F_r) cuando está comprimido.
 * @param {import("./index.js").Frame} frame
 */
export function drawForces({ ctx, camera, scene }) {
  const { state, config } = scene;
  const weight = config.mass * config.gravity;
  const unit = ARROW_PX_PER_WEIGHT * camera.zoom;
  const cos = Math.cos(state.angle);
  const sin = Math.sin(state.angle);

  const originX = camera.toX(state.position.x) + (-sin * CART.bodyTop * 0.5) * camera.zoom;
  const originY = camera.toY(state.position.y) + (CART.bodyTop * 0.5 * cos) * camera.zoom;

  /**
   * @param {number} force
   * @param {[number, number]} direction Dirección mundo (x, y hacia arriba).
   * @param {string} color
   * @param {string} name
   */
  const draw = (force, direction, color, name) => {
    const weights = clamp(force / weight, -MAX_ARROW_WEIGHTS, MAX_ARROW_WEIGHTS);

    if (Math.abs(weights) < 0.02) return;

    const length = weights * unit;
    const toX = originX + direction[0] * length;
    const toY = originY - direction[1] * length;

    arrow(ctx, originX, originY, toX, toY, color, 2.5 * camera.zoom);

    ctx.font = `bold ${11 * camera.zoom}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, toX + direction[0] * 9 * camera.zoom, toY - direction[1] * 9 * camera.zoom - 4 * camera.zoom);
  };

  draw(weight, [0, -1], PALETTE.weight, "P");
  draw(state.forces.normal, [-sin, cos], PALETTE.normal, "N");
  draw(state.forces.friction + state.forces.brake, [cos, sin], PALETTE.friction, "f");

  if (state.forces.spring !== 0 || state.forces.damper !== 0) {
    draw(state.forces.spring + state.forces.damper, [cos, sin], PALETTE.springForce, "Fᵣ");
  }
}
