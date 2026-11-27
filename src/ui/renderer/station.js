import { PALETTE } from "./palette.js";
import { box, circle, hash } from "./draw.js";
import { drawPerson } from "./scenery.js";
import { drawRails } from "./track.js";
import { liftHeightAt, liftLength, pointFromBase, LIFT_LEAD_IN_M } from "./lift.js";
import { stationSpan } from "./camera.js";

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
  columnCount: 4,
  waiting: 3
});

/** Subida: separación de soportes, trinquetes y eslabones, y separación de la cadena bajo el riel (m). */
/** Tamaño mínimo para escribir en el cartel (px); más chico, el texto sería una mancha. */
const MIN_SIGN_TEXT_PX = 5;

const LIFT = Object.freeze({ supportSpacing: 6, dogSpacing: 2.2, linkSpacing: 1.1, chainOffset: 0.25, motorFromTop: 4, footingSpacing: 3, footingWidth: 0.6 });

/**
 * @param {import("./index.js").Frame} frame
 * @returns {{left: number, right: number, scale: number, groundY: number}}
 */
function stationBox({ camera, scene }) {
  const { track } = scene;

  return {
    ...stationSpan(track),
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
  box(ctx, toX(left), platformTop - m(0.1), width, m(0.18), PALETTE.stationEdge, 0);

  // Cerca de la fila con postes.
  const fenceTop = platformTop - m(STATION.fenceHeight);
  ctx.strokeStyle = PALETTE.stationFence;
  ctx.lineWidth = m(0.06);
  ctx.beginPath();
  ctx.moveTo(toX(left + 0.5), fenceTop);
  ctx.lineTo(toX(right - 0.5), fenceTop);
  ctx.moveTo(toX(left + 0.5), fenceTop + m(0.5));
  ctx.lineTo(toX(right - 0.5), fenceTop + m(0.5));
  ctx.stroke();

  for (let x = left + 0.5; x <= right - 0.5; x += 1.6) {
    box(ctx, toX(x) - m(0.05), fenceTop - m(0.05), m(0.1), m(STATION.fenceHeight) + m(0.05), PALETTE.stationFence, 1);
  }

  // Gente esperando.
  for (let index = 0; index < STATION.waiting; index++) {
    const x = left + 1.5 + ((right - left - 3) * (index + 0.5)) / STATION.waiting + (hash(index, 11) - 0.5) * 1.5;
    drawPerson(ctx, toX(x), platformTop, scale, 40 + index);
  }

  // Columnas y cerchas.
  for (let index = 0; index < STATION.columnCount; index++) {
    const x = left + 0.9 + ((right - left - 1.8) * index) / (STATION.columnCount - 1);
    box(ctx, toX(x) - m(STATION.columnWidth) / 2, roofBottom, m(STATION.columnWidth), platformTop - roofBottom, PALETTE.truss, 1);
  }

  ctx.strokeStyle = PALETTE.truss;
  ctx.lineWidth = m(0.07);
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
  box(ctx, toX(left - 0.6), roofTop, width + m(1.2), m(STATION.roofThickness), PALETTE.stationRoof, m(0.15));
  box(ctx, toX(left - 0.6), roofBottom - m(0.12), width + m(1.2), m(0.12), PALETTE.stationRoofDark, 0);

  const subtitle =
    scene.config.brakeMode === "spring"
      ? `Resorte · k = ${scene.config.springConstant} N/m · x_máx = ${scene.config.maxCompression} m`
      : `Frenos · d_f = ${scene.config.brakingLength} m · a_f = ${scene.config.brakeDeceleration} m/s²`;
  const signWidth = Math.min(width * 0.7, m(12));
  const signHeight = m(STATION.signHeight) + m(0.7);
  const signTop = roofTop - signHeight + m(0.1);
  const signCenter = toX((left + right) / 2);

  box(ctx, signCenter - signWidth / 2, signTop, signWidth, signHeight, PALETTE.stationSign, m(0.2));
  box(ctx, signCenter - signWidth / 2, signTop, signWidth, m(0.12), PALETTE.stationEdge, 0);
  // Letras en metros, como el cartel: si quedan ilegibles (< MIN_SIGN_TEXT_PX) no se escriben.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (m(0.8) >= MIN_SIGN_TEXT_PX) {
    ctx.fillStyle = PALETTE.stationSignText;
    ctx.font = `800 ${m(0.8)}px Nunito, 'Segoe UI', system-ui, sans-serif`;
    ctx.fillText("ESTACIÓN", signCenter, signTop + signHeight * 0.36);
  }

  if (m(0.42) >= MIN_SIGN_TEXT_PX) {
    ctx.font = `600 ${m(0.42)}px Nunito, 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = scene.config.brakeMode === "spring" ? PALETTE.springDark : PALETTE.brake;
    ctx.fillText(subtitle, signCenter, signTop + signHeight * 0.75);
  }

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
 * Puntos con ángulo y distancia a lo largo de la subida (cada metro y en cada vértice).
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

    for (let step = index === 0 ? 0 : 1; step <= steps; step++) {
      const t = step / steps;
      points.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, angle, distance: distance + length * t });
    }

    distance += length;
  }

  return points;
}

/**
 * Punto de la cadena (en pantalla) a `distance` m de la base: bajo el riel, sobre la normal.
 * @param {import("./camera.js").Camera} camera
 * @param {number} distance
 * @param {number} [below] Separación bajo el eje de la vía (m).
 */
function chainPoint(camera, distance, below = LIFT.chainOffset) {
  const point = pointFromBase(camera.lift, distance);
  const nx = Math.sin(point.angle);
  const ny = -Math.cos(point.angle);
  return {
    x: camera.toX(point.x + nx * below),
    y: camera.toY(point.y + ny * below),
    angle: point.angle
  };
}

/**
 * Estructura fija de la subida por cadena: soportes, rieles, cadena,
 * trinquetes, casa de máquinas y zapata. Todo sigue la misma polilínea.
 * @param {import("./index.js").Frame} frame
 */
export function drawChainLift({ ctx, camera }) {
  const { scale, groundY, lift } = camera;
  const m = (/** @type {number} */ v) => v * scale;
  const length = liftLength(lift);
  if (length <= 0) return;
  // La cadena va solo por la rampa: del pie (tras el tramo de embarque) hasta A.
  const chainStart = LIFT_LEAD_IN_M;

  // Zapatas bajo el tramo de embarque, como la vía a nivel.
  for (let x = lift.base.x + 1; x < lift.foot.x; x += LIFT.footingSpacing) {
    const sx = camera.toX(x);
    const top = camera.toY(-0.75);
    box(ctx, sx - m(LIFT.footingWidth) / 2, top, m(LIFT.footingWidth), Math.max(0, groundY - top), PALETTE.footing, m(0.05));
  }

  // Soportes en celosía, del suelo al eje de la subida.
  ctx.strokeStyle = PALETTE.liftStructure;
  ctx.lineWidth = m(0.1);
  ctx.beginPath();

  for (let x = lift.foot.x + 3; x < lift.crest.x; x += LIFT.supportSpacing) {
    const y = liftHeightAt(lift, x) - 0.5;
    if (y <= 0) continue;
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

  // Rieles de la subida, con el mismo estilo que la vía.
  drawRails(ctx, camera, liftPoints(lift.points), { spine: PALETTE.lift, rail: PALETTE.liftStructure });

  // Sin subida (lanzada) el andén no lleva cadena, trinquetes ni casa de máquinas.
  if (!lift.chain) return;

  // Cadena estática bajo el riel.
  ctx.strokeStyle = PALETTE.chain;
  ctx.lineWidth = m(0.09);
  ctx.beginPath();

  for (let distance = chainStart; distance <= length; distance += 1) {
    const point = chainPoint(camera, distance);
    if (distance === chainStart) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }

  const top = chainPoint(camera, length);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();

  // Trinquetes (anti-retroceso) a lo largo de la cadena.
  ctx.fillStyle = PALETTE.chain;

  for (let distance = chainStart + LIFT.dogSpacing; distance < length; distance += LIFT.dogSpacing) {
    const point = chainPoint(camera, distance, 0);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(-point.angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-m(0.2), m(0.45));
    ctx.lineTo(m(0.25), 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Casa de máquinas bajo la subida, cerca de A.
  const motor = chainPoint(camera, Math.max(chainStart + (length - chainStart) * 0.55, length - LIFT.motorFromTop), 0.9);
  const houseWidth = m(2.4);
  const houseHeight = m(1.7);

  box(ctx, motor.x - houseWidth / 2, motor.y, houseWidth, houseHeight, PALETTE.motorHouse, m(0.15));
  box(ctx, motor.x - houseWidth / 2 - m(0.15), motor.y - m(0.12), houseWidth + m(0.3), m(0.3), PALETTE.motorRoof, m(0.08));
  circle(ctx, motor.x, motor.y + houseHeight / 2, m(0.42), PALETTE.chainLink);
  circle(ctx, motor.x, motor.y + houseHeight / 2, m(0.16), PALETTE.motorRoof);

  // Zapata bajo el pie de la rampa, del nivel de la vía al suelo dibujado.
  const footX = camera.toX(lift.foot.x);
  const footY = camera.toY(lift.foot.y);
  box(ctx, footX - m(0.9), footY, m(1.8), Math.max(m(0.3), groundY - footY), PALETTE.footing, m(0.1));
}

/**
 * Eslabones de la cadena en movimiento (capa dinámica), a la rapidez de la cadena.
 * @param {import("./index.js").Frame} frame
 */
export function drawChainLinks({ ctx, camera, scene }) {
  const { scale, lift } = camera;
  const length = liftLength(lift);
  if (length <= 0 || !lift.chain) return;
  const offset = ((scene.state.time * lift.chainSpeed) % LIFT.linkSpacing + LIFT.linkSpacing) % LIFT.linkSpacing;
  const radius = 0.12 * scale;

  ctx.fillStyle = PALETTE.chainLink;

  for (let distance = LIFT_LEAD_IN_M + offset; distance < length; distance += LIFT.linkSpacing) {
    const point = chainPoint(camera, distance);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
