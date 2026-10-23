import { PALETTE } from "./palette.js";
import { box, clamp } from "./draw.js";

/**
 * Dibujo de los pasajeros dentro del carrito. El sistema local tiene el
 * origen en el suelo del carrito, con y negativa hacia arriba.
 */

const DEFAULTS = Object.freeze({ hair: "#382921", skin: "#dca577", shirt: "#8050cf", hat: "#439c79" });
const FACE = Object.freeze({ eye: "#302438", smile: "#6f403c" });
const ARM = Object.freeze({ upper: 6, lower: 5, width: 2.2, hand: 1.6, smoothing: 0.22 });
const ARM_REST = Object.freeze({ left: 2.2, right: 0.95 });
const ARM_SPREAD = 0.38;
const TANGENTIAL_PUSH_FACTOR = 0.08;
const LOAD_LIFT_FACTOR = 0.5;
const WIGGLE_FREQUENCY = 8;
const WIGGLE_AMPLITUDE = 0.08;

/** Memoria de la posición de los brazos para suavizar la animación. */
const armMemory = new Map();

/**
 * @param {number} current
 * @param {number} target
 * @param {number} factor
 */
function lerpAngle(current, target, factor) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * factor;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} shoulderX
 * @param {number} shoulderY
 * @param {number} angle
 * @param {string} skin
 */
function drawMiniArm(ctx, shoulderX, shoulderY, angle, skin) {
  const elbowX = shoulderX + Math.cos(angle) * ARM.upper;
  const elbowY = shoulderY + Math.sin(angle) * ARM.upper;
  const handAngle = angle + Math.sin(angle * 2) * 0.08;
  const handX = elbowX + Math.cos(handAngle) * ARM.lower;
  const handY = elbowY + Math.sin(handAngle) * ARM.lower;

  ctx.strokeStyle = skin;
  ctx.lineWidth = ARM.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(elbowX, elbowY);
  ctx.lineTo(handX, handY);
  ctx.stroke();

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(handX, handY, ARM.hand, 0, Math.PI * 2);
  ctx.fill();
}

/** @param {CanvasRenderingContext2D} ctx @param {string} hair */
function drawLongHairBack(ctx, hair) {
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(-6, -40);
  ctx.quadraticCurveTo(-10, -38, -10, -31);
  ctx.quadraticCurveTo(-10, -24, -9, -17);
  ctx.quadraticCurveTo(-8, -14, -5, -14);
  ctx.lineTo(-4, -27);
  ctx.lineTo(4, -27);
  ctx.lineTo(5, -14);
  ctx.quadraticCurveTo(8, -14, 9, -17);
  ctx.quadraticCurveTo(10, -24, 10, -31);
  ctx.quadraticCurveTo(10, -38, 6, -40);
  ctx.closePath();
  ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} passenger
 * @param {string} hair
 */
function drawHairTop(ctx, passenger, hair) {
  ctx.fillStyle = hair;

  if (passenger.hairStyle === "shaved") {
    ctx.beginPath();
    ctx.arc(0, -37, 6, Math.PI, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (passenger.hairStyle === "long") {
    ctx.beginPath();
    ctx.moveTo(-6.5, -37);
    ctx.quadraticCurveTo(-5, -42, 0, -42);
    ctx.quadraticCurveTo(5, -42, 6.5, -37);
    ctx.quadraticCurveTo(4, -34, 0, -32);
    ctx.quadraticCurveTo(-4, -31, -6.5, -33);
    ctx.closePath();
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.arc(0, -37, 7, Math.PI, Math.PI * 2);
  ctx.fill();
}

/** @param {CanvasRenderingContext2D} ctx @param {string} skin */
function drawFace(ctx, skin) {
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -35, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = FACE.eye;
  ctx.beginPath();
  ctx.arc(-2.2, -35, 0.8, 0, Math.PI * 2);
  ctx.arc(2.2, -35, 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = FACE.smile;
  ctx.lineWidth = 0.9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, -33.2, 2, 0.15, Math.PI - 0.15);
  ctx.stroke();
}

/** @param {CanvasRenderingContext2D} ctx @param {any} passenger */
function drawHat(ctx, passenger) {
  if (!passenger.hat) return;

  ctx.fillStyle = passenger.hatColor ?? DEFAULTS.hat;
  ctx.beginPath();
  ctx.arc(0, -40, 7.5, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-7, -41, 18, 3);
}

/**
 * Ángulos objetivo de los brazos según el movimiento del carrito.
 * @param {number} seatX
 * @param {{cartRotation?: number, tangentialAcceleration?: number, load?: number, time?: number}} motion
 */
function armTargets(seatX, motion) {
  const downAngle = Math.PI / 2 - (motion.cartRotation ?? 0);
  const tangentialPush = clamp(-(motion.tangentialAcceleration ?? 0) * TANGENTIAL_PUSH_FACTOR, -0.55, 0.55);
  const loadLift = clamp((0.9 - (motion.load ?? 1)) * LOAD_LIFT_FACTOR, -0.25, 0.55);
  const wiggle = Math.sin((motion.time ?? 0) * WIGGLE_FREQUENCY + seatX * 0.15) * WIGGLE_AMPLITUDE;

  return {
    left: downAngle - ARM_SPREAD + tangentialPush - loadLift + wiggle,
    right: downAngle + ARM_SPREAD + tangentialPush - loadLift - wiggle
  };
}

/**
 * Dibuja un pasajero sentado en la posición local `seatX`.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} passenger
 * @param {number} seatX
 * @param {{cartRotation?: number, tangentialAcceleration?: number, load?: number, time?: number}} [motion]
 */
export function drawPassenger(ctx, passenger, seatX, motion = {}) {
  ctx.save();
  ctx.translate(seatX, 0);

  const hair = passenger.hair ?? DEFAULTS.hair;
  const skin = passenger.skin ?? DEFAULTS.skin;
  const shirt = passenger.shirt ?? DEFAULTS.shirt;

  const memoryKey = `${passenger.id}-${seatX}`;
  const previous = armMemory.get(memoryKey) ?? ARM_REST;
  const targets = armTargets(seatX, motion);
  const arms = {
    left: lerpAngle(previous.left, targets.left, ARM.smoothing),
    right: lerpAngle(previous.right, targets.right, ARM.smoothing)
  };

  armMemory.set(memoryKey, arms);

  if (passenger.hairStyle === "long") drawLongHairBack(ctx, hair);

  box(ctx, -7, -28, 14, 14, shirt, 4);
  drawMiniArm(ctx, -6, -24, arms.left, skin);
  drawMiniArm(ctx, 6, -24, arms.right, skin);
  drawFace(ctx, skin);
  drawHairTop(ctx, passenger, hair);
  drawHat(ctx, passenger);

  ctx.restore();
}

export { PALETTE as PASSENGER_PALETTE };
