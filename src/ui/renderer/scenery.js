import { PALETTE } from "./palette.js";
import { box, circle, ellipse, hash } from "./draw.js";

/**
 * Escenario del parque: cielo y fondos lejanos (dinámicos, con paralaje)
 * y utilería anclada al mundo (árboles, cerca, farolas, rueda de la fortuna).
 * Todo se coloca de forma determinista con `hash`.
 */

const SUN = Object.freeze({ x: 0.86, y: 64, radius: 26 });
const CLOUDS = Object.freeze([
  { x: 0.08, y: 70, size: 1.1, parallax: 0.28 },
  { x: 0.3, y: 44, size: 0.8, parallax: 0.22 },
  { x: 0.52, y: 90, size: 1.3, parallax: 0.34 },
  { x: 0.7, y: 36, size: 0.9, parallax: 0.2 },
  { x: 0.95, y: 110, size: 0.75, parallax: 0.3 }
]);
const HILL_LAYERS = Object.freeze([
  { color: "hillFar", height: 86, wavelength: 420, parallax: 0.12, lift: 28 },
  { color: "hillNear", height: 56, wavelength: 260, parallax: 0.22, lift: 10 }
]);

const TREE_SPACING_M = 7.5;
const TREE_CLEARANCE_M = 5.5;
const FENCE_POST_SPACING_M = 3;
const GRASS_SPACING_M = 2.2;

/**
 * Desplazamiento horizontal de paralaje (px) para una capa.
 * @param {import("./camera.js").Camera} camera
 * @param {number} factor
 */
function parallaxShift(camera, factor) {
  return camera.follow ? -camera.viewCenterX * camera.scale * factor : 0;
}

/**
 * Cielo, sol, nubes y colinas lejanas. Se dibuja cada cuadro (es barato).
 * @param {import("./index.js").Frame} frame
 */
export function drawSkyAndDistant({ ctx, camera }) {
  const { width, height, groundY } = camera;
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, groundY));
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.55, PALETTE.skyMid);
  sky.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  circle(ctx, width * SUN.x, SUN.y, SUN.radius * 1.8, PALETTE.sunHalo);
  circle(ctx, width * SUN.x, SUN.y, SUN.radius, PALETTE.sun);

  for (const layer of HILL_LAYERS) {
    const shift = parallaxShift(camera, layer.parallax);
    const base = Math.min(groundY + 6, height);

    ctx.fillStyle = PALETTE[/** @type {"hillFar"|"hillNear"} */ (layer.color)];
    ctx.beginPath();
    ctx.moveTo(0, base);

    for (let x = 0; x <= width; x += 8) {
      const phase = ((x - shift) / layer.wavelength) * Math.PI * 2;
      const y = base - layer.lift - layer.height * (0.55 + 0.45 * Math.sin(phase) * Math.cos(phase * 0.37 + 1.3));
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, base);
    ctx.closePath();
    ctx.fill();
  }

  for (const [index, cloud] of CLOUDS.entries()) {
    const shift = parallaxShift(camera, cloud.parallax);
    const x = (((cloud.x * width + shift) % (width + 160)) + width + 160) % (width + 160) - 80;
    drawCloud(ctx, x, cloud.y, cloud.size * 28, index);
  }
}

/**
 * Nube esponjosa a partir de círculos.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {number} seed
 */
function drawCloud(ctx, x, y, size, seed) {
  const puffs = [
    [0, 0, 1],
    [-0.9, 0.2, 0.75],
    [0.95, 0.15, 0.8],
    [-0.35, -0.45, 0.7],
    [0.45, -0.4, 0.65]
  ];

  ellipse(ctx, x, y + size * 0.55, size * 1.6, size * 0.32, PALETTE.cloudShade);

  for (const [dx, dy, r] of puffs) {
    circle(ctx, x + dx * size * (1 + hash(seed, 1) * 0.1), y + dy * size, r * size, PALETTE.cloud);
  }
}

/**
 * Relleno del suelo bajo la línea de tierra, con el borde del césped.
 * @param {import("./index.js").Frame} frame
 */
export function drawGroundFill({ ctx, camera }) {
  const top = camera.groundY;

  if (top >= camera.height) return;

  const gradient = ctx.createLinearGradient(0, top, 0, camera.height);
  gradient.addColorStop(0, PALETTE.ground);
  gradient.addColorStop(1, PALETTE.groundDeep);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, Math.max(0, top), camera.width, camera.height - top);

  ctx.strokeStyle = PALETTE.groundEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, top + 1);
  ctx.lineTo(camera.width, top + 1);
  ctx.stroke();
}

/**
 * Altura mínima de la vía (o de la rampa de la cadena) cerca de una x (m).
 * @param {any} track
 * @param {{x: number, y: number}[]} lift
 * @param {number} x
 */
function clearanceAt(track, lift, x) {
  let lowest = Infinity;

  for (const point of track.points) {
    if (Math.abs(point.x - x) < 3) lowest = Math.min(lowest, point.y);
  }

  const [base, , crest] = lift;

  if (x >= base.x - 1 && x <= crest.x + 1) {
    const t = (x - base.x) / Math.max(1e-6, crest.x - base.x);
    lowest = Math.min(lowest, crest.y * t);
  }

  return lowest;
}

/**
 * Árbol de uno de tres tipos, con la base en (x, groundY).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} groundY
 * @param {number} heightPx
 * @param {number} kind
 */
function drawTree(ctx, x, groundY, heightPx, kind) {
  const trunkWidth = Math.max(1.5, heightPx * 0.08);
  const trunkHeight = heightPx * 0.32;

  box(ctx, x - trunkWidth / 2, groundY - trunkHeight, trunkWidth, trunkHeight + 1, PALETTE.treeTrunk, 1);

  if (kind === 0) {
    const r = heightPx * 0.3;
    circle(ctx, x, groundY - trunkHeight - r * 0.9, r, PALETTE.treeRoundDark);
    circle(ctx, x - r * 0.55, groundY - trunkHeight - r * 0.55, r * 0.78, PALETTE.treeRound);
    circle(ctx, x + r * 0.5, groundY - trunkHeight - r * 0.6, r * 0.72, PALETTE.treeRound);
    circle(ctx, x, groundY - trunkHeight - r * 1.35, r * 0.7, PALETTE.treeRound);
    return;
  }

  if (kind === 1) {
    const tiers = 3;
    const width = heightPx * 0.5;

    for (let tier = 0; tier < tiers; tier++) {
      const top = groundY - heightPx + (tier * heightPx * 0.2);
      const half = width * (0.45 + tier * 0.25);
      ctx.fillStyle = tier % 2 ? PALETTE.treePine : PALETTE.treePineDark;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + half, top + heightPx * 0.34);
      ctx.lineTo(x - half, top + heightPx * 0.34);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }

  ellipse(ctx, x, groundY - trunkHeight - heightPx * 0.36, heightPx * 0.22, heightPx * 0.38, PALETTE.treeTall);
  ellipse(ctx, x - heightPx * 0.06, groundY - trunkHeight - heightPx * 0.42, heightPx * 0.12, heightPx * 0.26, PALETTE.treeRound);
}

/**
 * Figura humana sencilla de pie (1,7 m), base en (x, baseY).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} baseY
 * @param {number} scale px/m
 * @param {number} seed
 */
export function drawPerson(ctx, x, baseY, scale, seed) {
  const h = 1.7 * scale;
  const skin = PALETTE.personSkin[Math.floor(hash(seed, 3) * PALETTE.personSkin.length)];
  const shirt = PALETTE.personShirt[Math.floor(hash(seed, 4) * PALETTE.personShirt.length)];
  const hair = PALETTE.personHair[Math.floor(hash(seed, 5) * PALETTE.personHair.length)];

  box(ctx, x - h * 0.1, baseY - h * 0.42, h * 0.08, h * 0.42, PALETTE.personPants, 1);
  box(ctx, x + h * 0.02, baseY - h * 0.42, h * 0.08, h * 0.42, PALETTE.personPants, 1);
  box(ctx, x - h * 0.14, baseY - h * 0.78, h * 0.28, h * 0.38, shirt, h * 0.05);
  circle(ctx, x, baseY - h * 0.88, h * 0.11, skin);
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(x, baseY - h * 0.9, h * 0.11, Math.PI, Math.PI * 2);
  ctx.fill();
}

/**
 * Farola de parque.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} groundY
 * @param {number} scale
 */
function drawLamp(ctx, x, groundY, scale) {
  const height = 4.2 * scale;
  const width = Math.max(1.5, 0.14 * scale);

  box(ctx, x - width / 2, groundY - height, width, height, PALETTE.lamp, 1);
  box(ctx, x - 0.3 * scale, groundY - height - 0.35 * scale, 0.6 * scale, 0.5 * scale, PALETTE.lamp, 2);
  circle(ctx, x, groundY - height - 0.1 * scale, 0.22 * scale, PALETTE.lampLight);
}

/**
 * Rueda de la fortuna y carpas, al fondo a la derecha de la estación.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x Centro (px).
 * @param {number} groundY
 * @param {number} scale
 */
function drawFairground(ctx, x, groundY, scale) {
  const radius = 9 * scale;
  const hub = { x, y: groundY - radius - 2.5 * scale };

  ctx.strokeStyle = PALETTE.ferris;
  ctx.lineWidth = Math.max(1.2, 0.18 * scale);
  ctx.beginPath();
  ctx.moveTo(hub.x - 4 * scale, groundY);
  ctx.lineTo(hub.x, hub.y);
  ctx.lineTo(hub.x + 4 * scale, groundY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(hub.x, hub.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  const spokes = 8;

  for (let index = 0; index < spokes; index++) {
    const angle = (index / spokes) * Math.PI * 2;
    const px = hub.x + Math.cos(angle) * radius;
    const py = hub.y + Math.sin(angle) * radius;

    ctx.beginPath();
    ctx.moveTo(hub.x, hub.y);
    ctx.lineTo(px, py);
    ctx.stroke();

    box(ctx, px - 0.6 * scale, py - 0.2 * scale, 1.2 * scale, 0.9 * scale, PALETTE.ferrisCabin, 2);
  }

  circle(ctx, hub.x, hub.y, 0.6 * scale, PALETTE.ferrisDark);

  for (const offset of [-15, -22]) {
    const tentX = x + offset * scale;
    const width = 5 * scale;
    const height = 3.4 * scale;

    ctx.fillStyle = PALETTE.tent;
    ctx.beginPath();
    ctx.moveTo(tentX - width / 2, groundY);
    ctx.lineTo(tentX, groundY - height);
    ctx.lineTo(tentX + width / 2, groundY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = PALETTE.tentStripe;
    ctx.lineWidth = Math.max(1, 0.25 * scale);
    ctx.beginPath();
    ctx.moveTo(tentX, groundY - height);
    ctx.lineTo(tentX - width * 0.22, groundY);
    ctx.moveTo(tentX, groundY - height);
    ctx.lineTo(tentX + width * 0.22, groundY);
    ctx.stroke();
  }
}

/**
 * Utilería anclada al mundo, detrás de la vía.
 * @param {import("./index.js").Frame} frame
 */
export function drawWorldScenery({ ctx, camera, scene }) {
  const { track } = scene;
  const { scale, world, lift, groundY } = camera;
  const stationLeft = track.brakeX - 5;
  const stationRight = track.endX + 7;

  for (let x = world.minX + 1; x < world.maxX; x += GRASS_SPACING_M) {
    const seed = Math.round(x * 10);
    const px = camera.toX(x + hash(seed, 7) * 1.5);
    const size = Math.max(2, (0.3 + hash(seed, 8) * 0.3) * scale);

    ctx.strokeStyle = PALETTE.grass;
    ctx.lineWidth = Math.max(1, 0.08 * scale);
    ctx.beginPath();
    ctx.moveTo(px, groundY);
    ctx.lineTo(px - size * 0.4, groundY - size);
    ctx.moveTo(px, groundY);
    ctx.lineTo(px + size * 0.3, groundY - size * 1.1);
    ctx.stroke();
  }

  drawFairground(ctx, camera.toX(track.endX + 24), groundY, scale * 0.8);

  for (let x = world.minX + 4; x < world.maxX - 3; x += TREE_SPACING_M) {
    const seed = Math.round(x * 100);
    const jittered = x + (hash(seed, 1) - 0.5) * 4;

    if (jittered > stationLeft - 2 && jittered < stationRight + 2) continue;
    if (clearanceAt(track, lift, jittered) < TREE_CLEARANCE_M) continue;

    const heightPx = (4 + hash(seed, 2) * 3) * scale;
    drawTree(ctx, camera.toX(jittered), groundY, heightPx, Math.floor(hash(seed, 3) * 3));
  }

  const fenceTop = groundY - 1.0 * scale;
  ctx.strokeStyle = PALETTE.fence;
  ctx.lineWidth = Math.max(1, 0.08 * scale);
  ctx.beginPath();
  ctx.moveTo(camera.toX(world.minX), fenceTop);
  ctx.lineTo(camera.toX(world.maxX), fenceTop);
  ctx.moveTo(camera.toX(world.minX), fenceTop + 0.45 * scale);
  ctx.lineTo(camera.toX(world.maxX), fenceTop + 0.45 * scale);
  ctx.stroke();

  for (let x = world.minX; x < world.maxX; x += FENCE_POST_SPACING_M) {
    box(ctx, camera.toX(x) - Math.max(0.6, 0.06 * scale), fenceTop - 0.1 * scale, Math.max(1.2, 0.12 * scale), 1.1 * scale, PALETTE.fenceDark, 1);
  }

  drawLamp(ctx, camera.toX(track.brakeX - 9), groundY, scale);
  drawLamp(ctx, camera.toX(track.endX + 10), groundY, scale);
  drawLamp(ctx, camera.toX(lift[0].x - 5), groundY, scale);
}
