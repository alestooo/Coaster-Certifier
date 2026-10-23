import { PALETTE } from "./palette.js";
import { box, circle, hash } from "./draw.js";
import { drawPerson } from "./scenery.js";
import { drawRails } from "./track.js";

/**
 * Estación con andén, techo sobre cerchas, letrero, banderines y gente
 * esperando; subida por cadena con casa de máquinas y trinquetes.
 */

const STATION = Object.freeze({
  platformHeight: 1,
  fenceHeight: 1.05,
  roofBottom: 5.4,
  roofThickness: 0.55,
  columnWidth: 0.3,
  signHeight: 1.5,
  overhangLeft: 4,
  overhangRight: 6,
  columnCount: 4,
  waiting: 3
});

const LIFT = Object.freeze({ supportSpacing: 6, dogSpacing: 2.2, linkSpacing: 1.1, chainSpeed: 1.4 });

/**
 * @param {import("./index.js").Frame} frame
 * @returns {{left: number, right: number, scale: number, groundY: number}}
 */
function stationBox({ camera, scene }) {
  const { track } = scene;

  return {
    left: track.brakeX - STATION.overhangLeft,
    right: track.endX + STATION.overhangRight,
    scale: camera.scale,
    groundY: camera.groundY
  };
}

/**
 * Edificio de la estación (todo detrás del tren).
 * @param {import("./index.js").Frame} frame
 */
export function drawStation(frame) {
  const { ctx, camera, scene } = frame;
  const { left, right, scale, groundY } = stationBox(frame);
  const toX = camera.toX;
  const m = (/** @type {number} */ v) => v * scale;
  const platformTop = groundY - m(STATION.platformHeight);
  const roofBottom = groundY - m(STATION.roofBottom);
  const roofTop = roofBottom - m(STATION.roofThickness);
  const width = toX(right) - toX(left);

  // Pared de fondo y andén.
  box(ctx, toX(left), roofBottom, width, groundY - roofBottom, PALETTE.stationWall, 0);
  box(ctx, toX(left), platformTop - m(0.1), width, m(STATION.platformHeight) + m(0.1), PALETTE.stationPlatform, 0);
  box(ctx, toX(left), platformTop - m(0.1), width, Math.max(1.5, m(0.18)), PALETTE.stationEdge, 0);

  // Cerca de la fila con postes.
  const fenceTop = platformTop - m(STATION.fenceHeight);
  ctx.strokeStyle = PALETTE.stationFence;
  ctx.lineWidth = Math.max(1, m(0.06));
  ctx.beginPath();
  ctx.moveTo(toX(left + 0.5), fenceTop);
  ctx.lineTo(toX(right - 0.5), fenceTop);
  ctx.moveTo(toX(left + 0.5), fenceTop + m(0.5));
  ctx.lineTo(toX(right - 0.5), fenceTop + m(0.5));
  ctx.stroke();

  for (let x = left + 0.5; x <= right - 0.5; x += 1.6) {
    box(ctx, toX(x) - m(0.05), fenceTop - m(0.05), Math.max(1.2, m(0.1)), m(STATION.fenceHeight) + m(0.05), PALETTE.stationFence, 1);
  }

  // Gente esperando.
  for (let index = 0; index < STATION.waiting; index++) {
    const x = left + 1.5 + ((right - left - 3) * (index + 0.5)) / STATION.waiting + (hash(index, 11) - 0.5) * 1.5;
    drawPerson(ctx, toX(x), platformTop, scale, 40 + index);
  }

  // Columnas y cerchas.
  for (let index = 0; index < STATION.columnCount; index++) {
    const x = left + 0.9 + ((right - left - 1.8) * index) / (STATION.columnCount - 1);
    box(ctx, toX(x) - m(STATION.columnWidth) / 2, roofBottom, Math.max(1.5, m(STATION.columnWidth)), platformTop - roofBottom, PALETTE.truss, 1);
  }

  ctx.strokeStyle = PALETTE.truss;
  ctx.lineWidth = Math.max(1, m(0.07));
  ctx.beginPath();
  const trussTop = roofBottom - m(0.02);
  const trussBottom = roofBottom + m(0.8);
  let flip = false;

  for (let x = left; x <= right; x += 1.2) {
    ctx.lineTo(toX(x), flip ? trussTop : trussBottom);
    flip = !flip;
  }

  ctx.moveTo(toX(left), trussBottom);
  ctx.lineTo(toX(right), trussBottom);
  ctx.stroke();

  // Techo con sombra y letrero.
  box(ctx, toX(left - 0.6), roofTop, width + m(1.2), m(STATION.roofThickness), PALETTE.stationRoof, Math.max(2, m(0.15)));
  box(ctx, toX(left - 0.6), roofBottom - m(0.12), width + m(1.2), m(0.12), PALETTE.stationRoofDark, 0);

  const subtitle =
    scene.config.brakeMode === "spring"
      ? `Resorte · k = ${scene.config.springConstant} N/m · x_máx = ${scene.config.maxCompression} m`
      : `Frenos · d_f = ${scene.config.brakingLength} m · a_f = ${scene.config.brakeDeceleration} m/s²`;
  const signWidth = Math.min(width * 0.7, m(12));
  const signHeight = m(STATION.signHeight) + m(0.7);
  const signTop = roofTop - signHeight + m(0.1);
  const signCenter = toX((left + right) / 2);

  box(ctx, signCenter - signWidth / 2, signTop, signWidth, signHeight, PALETTE.stationSign, Math.max(2, m(0.2)));
  box(ctx, signCenter - signWidth / 2, signTop, signWidth, Math.max(1, m(0.12)), PALETTE.stationEdge, 0);
  ctx.fillStyle = PALETTE.stationSignText;
  ctx.font = `800 ${Math.max(8, m(0.8))}px Nunito, 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ESTACIÓN", signCenter, signTop + signHeight * 0.36);
  ctx.font = `600 ${Math.max(6, m(0.42))}px Nunito, 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = scene.config.brakeMode === "spring" ? PALETTE.springDark : PALETTE.brake;
  ctx.fillText(subtitle, signCenter, signTop + signHeight * 0.75);

  // Banderines colgando del techo.
  const flagCount = Math.max(4, Math.round((right - left) / 1.1));
  const stringY = roofBottom + m(0.9);

  for (let index = 0; index < flagCount; index++) {
    const t = index / (flagCount - 1);
    const x = toX(left + (right - left) * t);
    const sag = Math.sin(t * Math.PI) * m(0.35);
    const color = PALETTE.bunting[index % PALETTE.bunting.length];

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - m(0.3), stringY + sag);
    ctx.lineTo(x + m(0.3), stringY + sag);
    ctx.lineTo(x, stringY + sag + m(0.55));
    ctx.closePath();
    ctx.fill();
  }

  // Puerta de salida a la derecha.
  const gateX = right - 0.9;
  box(ctx, toX(gateX) - m(0.9), platformTop - m(2.1), m(0.2), m(2.1), PALETTE.gate, 1);
  box(ctx, toX(gateX) + m(0.7), platformTop - m(2.1), m(0.2), m(2.1), PALETTE.gate, 1);
  box(ctx, toX(gateX) - m(1), platformTop - m(2.35), m(2), m(0.3), PALETTE.gate, 2);

}

/**
 * Puntos con ángulo y distancia a lo largo de la rampa de la cadena.
 * @param {{x: number, y: number}[]} lift
 */
function liftPoints(lift) {
  const points = [];
  let distance = 0;

  for (let index = 0; index < lift.length - 1; index++) {
    const from = lift[index];
    const to = lift[index + 1];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const steps = Math.max(1, Math.ceil(length));

    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      points.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, angle, distance: distance + length * t });
    }

    distance += length;
  }

  return points;
}

/**
 * Estructura fija de la subida por cadena.
 * @param {import("./index.js").Frame} frame
 */
export function drawChainLift({ ctx, camera }) {
  const { scale, groundY, lift } = camera;
  const m = (/** @type {number} */ v) => v * scale;
  const points = lift.map(point => ({ x: camera.toX(point.x), y: camera.toY(point.y) }));
  const [base, , crest] = points;
  const length = Math.hypot(crest.x - base.x, crest.y - base.y);
  const nx = (crest.y - base.y) / length;
  const ny = -(crest.x - base.x) / length;

  // Soportes en celosía bajo la rampa.
  ctx.strokeStyle = PALETTE.liftStructure;
  ctx.lineWidth = Math.max(1, m(0.1));
  ctx.beginPath();

  for (let x = lift[0].x + 3; x < lift[2].x; x += LIFT.supportSpacing) {
    const t = (x - lift[0].x) / (lift[2].x - lift[0].x);
    const y = lift[0].y + (lift[2].y - lift[0].y) * t;
    const sx = camera.toX(x);
    const sy = camera.toY(y);

    ctx.moveTo(sx - m(0.6), groundY);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx + m(0.6), groundY);

    for (let level = 2; level < y; level += 2.5) {
      const spread = m(0.6) * (1 - level / y);
      ctx.moveTo(sx - spread, camera.toY(level));
      ctx.lineTo(sx + spread, camera.toY(level));
    }
  }

  ctx.stroke();

  // Rieles de la rampa, con el mismo estilo que la vía.
  drawRails(ctx, camera, liftPoints(lift), { spine: PALETTE.lift, rail: PALETTE.liftStructure });

  // Cadena estática y trinquetes.
  ctx.strokeStyle = PALETTE.chain;
  ctx.lineWidth = Math.max(1, m(0.09));
  ctx.beginPath();
  ctx.moveTo(base.x + nx * m(0.25), base.y + ny * m(0.25));
  ctx.lineTo(crest.x + nx * m(0.25), crest.y + ny * m(0.25));
  ctx.stroke();

  const dogs = Math.floor(length / m(LIFT.dogSpacing));
  ctx.fillStyle = PALETTE.chain;

  for (let index = 1; index < dogs; index++) {
    const t = index / dogs;
    const x = base.x + (crest.x - base.x) * t;
    const y = base.y + (crest.y - base.y) * t;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + nx * m(0.45) - m(0.2), y + ny * m(0.45));
    ctx.lineTo(x + m(0.25), y);
    ctx.closePath();
    ctx.fill();
  }

  // Casa de máquinas colgada bajo la rampa, cerca de la cresta.
  const houseWidth = m(2.4);
  const houseHeight = m(1.7);
  const t = Math.max(0.55, 1 - m(4) / Math.max(1, length));
  const houseCenterX = base.x + (crest.x - base.x) * t;
  const houseTop = base.y + (crest.y - base.y) * t + m(0.9);

  box(ctx, houseCenterX - houseWidth / 2, houseTop, houseWidth, houseHeight, PALETTE.motorHouse, Math.max(2, m(0.15)));
  box(ctx, houseCenterX - houseWidth / 2 - m(0.15), houseTop - m(0.12), houseWidth + m(0.3), m(0.3), PALETTE.motorRoof, Math.max(1, m(0.08)));
  circle(ctx, houseCenterX, houseTop + houseHeight / 2, Math.max(2, m(0.42)), PALETTE.chainLink);
  circle(ctx, houseCenterX, houseTop + houseHeight / 2, Math.max(1, m(0.16)), PALETTE.motorRoof);

  box(ctx, base.x - m(0.9), groundY - m(0.6), m(1.8), m(0.6), PALETTE.footing, 1);
}

/**
 * Eslabones de la cadena en movimiento (capa dinámica).
 * @param {import("./index.js").Frame} frame
 */
export function drawChainLinks({ ctx, camera, scene }) {
  const { scale, lift } = camera;
  const m = (/** @type {number} */ v) => v * scale;
  const points = lift.map(point => ({ x: camera.toX(point.x), y: camera.toY(point.y) }));
  const [base, , crest] = points;
  const length = Math.hypot(crest.x - base.x, crest.y - base.y);

  if (length < 20) return;

  const nx = (crest.y - base.y) / length;
  const ny = -(crest.x - base.x) / length;
  const spacing = m(LIFT.linkSpacing);
  const offset = ((scene.state.time * LIFT.chainSpeed * scale) % spacing + spacing) % spacing;
  const radius = Math.max(1, m(0.12));

  ctx.fillStyle = PALETTE.chainLink;

  for (let d = offset; d < length; d += spacing) {
    const t = d / length;
    ctx.beginPath();
    ctx.arc(base.x + (crest.x - base.x) * t + nx * m(0.25), base.y + (crest.y - base.y) * t + ny * m(0.25), radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
