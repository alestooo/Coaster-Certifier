import { PALETTE } from "./palette.js";
import { box } from "./draw.js";

/** Separación entre pilares, en píxeles del encuadre completo. */
const SUPPORT_PIXEL_SPACING = 44;

/** Altura mínima de la vía para dibujar un pilar (m). */
const MIN_SUPPORT_HEIGHT = 0.6;

/** Separación entre eslabones de la cadena (px). */
const CHAIN_TICK_SPACING = 11;

const STATION = Object.freeze({
  leftOverhang: 25,
  rightOverhang: 70,
  wallHeight: 110,
  wallTop: 105,
  innerInset: 10,
  innerHeight: 78,
  innerTop: 80,
  roofTop: 120,
  roofHeight: 25,
  roofOverhang: 10,
  platformTop: 8,
  platformHeight: 12,
  windowWidth: 16,
  windowHeight: 22,
  windowGap: 26,
  signOffset: 104,
  signSize: 11
});

/**
 * Cielo degradado.
 * @param {import("./index.js").Frame} frame
 */
export function drawSky({ ctx, camera }) {
  const sky = ctx.createLinearGradient(0, 0, 0, camera.height);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(1, PALETTE.skyBottom);

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, camera.width, camera.height);
}

/**
 * Suelo bajo la vía.
 * @param {import("./index.js").Frame} frame
 */
export function drawGround({ ctx, camera }) {
  const top = camera.groundY + 7;

  if (top >= camera.height) return;

  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, Math.max(0, top), camera.width, camera.height - top);

  ctx.strokeStyle = PALETTE.groundEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(camera.width, top);
  ctx.stroke();
}

/**
 * Edificio de la estación sobre la zona de frenado.
 * @param {import("./index.js").Frame} frame
 */
export function drawStation({ ctx, camera, scene }) {
  const { track, config } = scene;
  const z = camera.zoom;
  const groundY = camera.groundY;
  const left = camera.toX(track.brakeX) - STATION.leftOverhang * z;
  const width = (track.endX - track.brakeX) * camera.scale + (STATION.leftOverhang + STATION.rightOverhang) * z;

  box(ctx, left, groundY - STATION.wallTop * z, width, STATION.wallHeight * z, PALETTE.stationWall);
  box(
    ctx,
    left + STATION.innerInset * z,
    groundY - STATION.innerTop * z,
    width - 2 * STATION.innerInset * z,
    STATION.innerHeight * z,
    PALETTE.stationInner
  );

  const windowCount = Math.max(0, Math.floor((width - 2 * STATION.innerInset * z) / (STATION.windowGap * z)));
  const windowStart = left + width / 2 - ((windowCount - 1) * STATION.windowGap * z) / 2;

  for (let index = 0; index < windowCount; index++) {
    box(
      ctx,
      windowStart + index * STATION.windowGap * z - (STATION.windowWidth * z) / 2,
      groundY - 66 * z,
      STATION.windowWidth * z,
      STATION.windowHeight * z,
      PALETTE.stationWindow,
      3
    );
  }

  box(
    ctx,
    left - STATION.roofOverhang * z,
    groundY - STATION.roofTop * z,
    width + 2 * STATION.roofOverhang * z,
    STATION.roofHeight * z,
    PALETTE.stationRoof
  );

  box(
    ctx,
    left - STATION.roofOverhang * z,
    groundY + STATION.platformTop * z,
    width + 2 * STATION.roofOverhang * z,
    STATION.platformHeight * z,
    PALETTE.stationPlatform
  );

  ctx.fillStyle = PALETTE.stationSign;
  ctx.font = `bold ${STATION.signSize * z}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    config.brakeMode === "spring" ? "ESTACIÓN · RESORTE" : "ESTACIÓN · FRENOS",
    left + width / 2,
    groundY - (STATION.roofTop - STATION.roofHeight / 2) * z
  );
}

/**
 * Rampa decorativa de la subida por cadena que termina en A.
 * @param {import("./index.js").Frame} frame
 */
export function drawChainLift({ ctx, camera }) {
  const z = camera.zoom;
  const points = camera.lift.map(point => ({ x: camera.toX(point.x), y: camera.toY(point.y) }));
  const [base, crest] = points;

  ctx.strokeStyle = PALETTE.trackLift;
  ctx.lineWidth = 4 * z;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  points.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
  ctx.stroke();

  const length = Math.hypot(crest.x - base.x, crest.y - base.y);
  const ticks = Math.floor(length / (CHAIN_TICK_SPACING * z));
  const nx = -(crest.y - base.y) / length;
  const ny = (crest.x - base.x) / length;

  ctx.strokeStyle = PALETTE.chain;
  ctx.lineWidth = 1.5 * z;
  ctx.beginPath();

  for (let index = 1; index < ticks; index++) {
    const t = index / ticks;
    const x = base.x + (crest.x - base.x) * t;
    const y = base.y + (crest.y - base.y) * t;

    ctx.moveTo(x - nx * 3 * z, y - ny * 3 * z);
    ctx.lineTo(x + nx * 3 * z, y + ny * 3 * z);
  }

  ctx.stroke();

  box(ctx, base.x - 11 * z, camera.groundY - 13 * z, 22 * z, 14 * z, PALETTE.wall, 3);

  ctx.fillStyle = PALETTE.muted;
  ctx.font = `${9 * z}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("cadena", base.x, camera.groundY + 10 * z);
}

/**
 * Pilares de soporte bajo la vía, fuera de los loops.
 * @param {import("./index.js").Frame} frame
 */
export function drawSupports({ ctx, camera, scene }) {
  const spacing = SUPPORT_PIXEL_SPACING / camera.baseScale;
  const groundLine = camera.groundY + 7;
  let lastDistance = -Infinity;

  ctx.strokeStyle = PALETTE.support;
  ctx.lineWidth = 3 * camera.zoom;
  ctx.lineCap = "butt";
  ctx.beginPath();

  for (const point of scene.track.points) {
    if (point.kind === "loop" || point.y < MIN_SUPPORT_HEIGHT) continue;
    if (point.distance - lastDistance < spacing) continue;

    lastDistance = point.distance;
    const x = camera.toX(point.x);

    ctx.moveTo(x, camera.toY(point.y));
    ctx.lineTo(x, groundLine);
  }

  ctx.stroke();
}
