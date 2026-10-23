import { box, circle, clamp } from "./draw.js";
import { HEAD, SHOULDER, TORSO } from "./passenger-geometry.js";
import { expressionFor, drawFace, drawAccessory } from "./faces.js";

export { expressionFor } from "./faces.js";

/**
 * Pasajeros sentados, dibujados en unidades de diseño del carrito
 * (30 px por metro; ver train.js). El origen está en el contacto con el
 * riel y la y crece hacia abajo, así que las alturas son negativas.
 */

const ARM = Object.freeze({ upper: 8, lower: 7, width: 3, hand: 2.1, smoothing: 0.2 });
const ARM_REST = Object.freeze({ left: 2.2, right: 0.95 });

/** Memoria de la posición de los brazos para suavizar la animación. */
const armMemory = new Map();

/**
 * @typedef {Object} Motion
 * @property {number} [cartRotation] Rotación del carrito (rad).
 * @property {number} [tangentialAcceleration] a_t (m/s²).
 * @property {number} [load] Carga n (g).
 * @property {number} [speed] Rapidez (m/s).
 * @property {number} [time] Tiempo (s).
 * @property {boolean} [inLoop] Verdadero dentro de un loop.
 */

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
 * Desplazamiento hacia atrás del cabello por viento y aceleración (px).
 * @param {Motion} motion
 */
function hairShift(motion) {
  const wind = clamp((motion.speed ?? 0) * 0.22, 0, 7);
  const push = clamp((motion.tangentialAcceleration ?? 0) * 0.45, -5, 5);
  return wind + push;
}

/**
 * Capa posterior del cabello (detrás de la cabeza y el torso).
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} passenger
 * @param {number} shift
 */
function drawHairBack(ctx, passenger, shift) {
  const hair = passenger.hair;
  ctx.fillStyle = hair;

  switch (passenger.hairStyle) {
    case "long":
      ctx.beginPath();
      ctx.moveTo(-7, HEAD.y - 7);
      ctx.quadraticCurveTo(-13, HEAD.y + 2, -12 - shift, HEAD.y + 16);
      ctx.quadraticCurveTo(-10 - shift, HEAD.y + 22, -3 - shift * 0.6, HEAD.y + 22);
      ctx.lineTo(5 - shift * 0.4, HEAD.y + 22);
      ctx.quadraticCurveTo(10 - shift * 0.3, HEAD.y + 18, 10, HEAD.y + 4);
      ctx.quadraticCurveTo(10, HEAD.y - 6, 6, HEAD.y - 8);
      ctx.closePath();
      ctx.fill();
      break;

    case "ponytail":
      ctx.strokeStyle = hair;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-6, HEAD.y - 3);
      ctx.quadraticCurveTo(-14 - shift, HEAD.y - 2, -13 - shift * 1.4, HEAD.y + 12);
      ctx.stroke();
      circle(ctx, -7, HEAD.y - 3, 3, hair);
      break;

    case "curly":
      for (const [dx, dy, r] of [[-9, -2, 4.5], [9, -2, 4.5], [-10, 5, 4], [10, 5, 4], [-7, -9, 4.5], [7, -9, 4.5]]) {
        circle(ctx, HEAD.x + dx - (dy > 0 ? shift * 0.3 : 0), HEAD.y + dy, r, hair);
      }
      break;

    default:
      break;
  }
}

/**
 * Capa superior del cabello (sobre la cara).
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} passenger
 * @param {number} shift
 */
function drawHairTop(ctx, passenger, shift) {
  const hair = passenger.hair;
  ctx.fillStyle = hair;

  switch (passenger.hairStyle) {
    case "shaved":
      ctx.beginPath();
      ctx.arc(HEAD.x, HEAD.y - 0.5, HEAD.radius + 0.4, Math.PI * 1.05, Math.PI * 1.95);
      ctx.lineTo(HEAD.x + 6, HEAD.y - 5);
      ctx.closePath();
      ctx.fill();
      break;

    case "curly":
      for (const [dx, dy, r] of [[-5, -8, 5], [1, -10, 5.2], [6, -7, 4.6], [-9, -4, 4]]) {
        circle(ctx, HEAD.x + dx, HEAD.y + dy, r, hair);
      }
      break;

    case "bun":
      ctx.beginPath();
      ctx.arc(HEAD.x, HEAD.y - 1, HEAD.radius + 0.6, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      circle(ctx, HEAD.x - 5, HEAD.y - 10, 4.6, hair);
      break;

    default: {
      ctx.beginPath();
      ctx.arc(HEAD.x, HEAD.y - 1, HEAD.radius + 0.8, Math.PI, Math.PI * 2);
      ctx.quadraticCurveTo(HEAD.x + 6, HEAD.y - 3, HEAD.x + 2, HEAD.y - 4 + (passenger.hairStyle === "short" ? 0 : 2));
      ctx.quadraticCurveTo(HEAD.x - 4, HEAD.y - 2, HEAD.x - HEAD.radius - 0.8, HEAD.y - 1);
      ctx.closePath();
      ctx.fill();

      if (passenger.hairStyle === "short" && shift > 2) {
        ctx.beginPath();
        ctx.moveTo(HEAD.x - 6, HEAD.y - 7);
        ctx.quadraticCurveTo(HEAD.x - 10 - shift * 0.5, HEAD.y - 8, HEAD.x - 9 - shift * 0.4, HEAD.y - 4);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
  }
}

/**
 * Camisa con su estilo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} passenger
 */
function drawShirt(ctx, passenger) {
  box(ctx, -TORSO.halfWidth, TORSO.top, TORSO.halfWidth * 2, TORSO.bottom - TORSO.top, passenger.shirt, 5);

  if (passenger.shirtStyle === "stripes") {
    for (const y of [TORSO.top + 6, TORSO.top + 12, TORSO.top + 18]) {
      box(ctx, -TORSO.halfWidth, y, TORSO.halfWidth * 2, 2.4, passenger.shirtAccent ?? "#ffffff", 0);
    }
  }

  if (passenger.shirtStyle === "hoodie") {
    ctx.fillStyle = passenger.shirtAccent ?? "#2b2f45";
    ctx.beginPath();
    ctx.moveTo(-TORSO.halfWidth, TORSO.top + 3);
    ctx.quadraticCurveTo(0, TORSO.top - 6, TORSO.halfWidth, TORSO.top + 3);
    ctx.lineTo(TORSO.halfWidth - 2, TORSO.top + 7);
    ctx.quadraticCurveTo(0, TORSO.top + 1, -TORSO.halfWidth + 2, TORSO.top + 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = passenger.shirtAccent ?? "#2b2f45";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, TORSO.top + 5);
    ctx.lineTo(-2.5, TORSO.top + 13);
    ctx.moveTo(2, TORSO.top + 5);
    ctx.lineTo(2.5, TORSO.top + 13);
    ctx.stroke();
  }

  circle(ctx, 0, TORSO.top + 1, 3.6, passenger.skin);
}

/**
 * Brazo de dos segmentos desde el hombro.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} shoulderX
 * @param {number} angle
 * @param {string} skin
 * @param {string} sleeve
 */
function drawArm(ctx, shoulderX, angle, skin, sleeve) {
  const elbowX = shoulderX + Math.cos(angle) * ARM.upper;
  const elbowY = SHOULDER.y + Math.sin(angle) * ARM.upper;
  const handAngle = angle + Math.sin(angle * 2) * 0.1;
  const handX = elbowX + Math.cos(handAngle) * ARM.lower;
  const handY = elbowY + Math.sin(handAngle) * ARM.lower;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = sleeve;
  ctx.lineWidth = ARM.width + 1.2;
  ctx.beginPath();
  ctx.moveTo(shoulderX, SHOULDER.y);
  ctx.lineTo(elbowX, elbowY);
  ctx.stroke();

  ctx.strokeStyle = skin;
  ctx.lineWidth = ARM.width;
  ctx.beginPath();
  ctx.moveTo(elbowX, elbowY);
  ctx.lineTo(handX, handY);
  ctx.stroke();
  circle(ctx, handX, handY, ARM.hand, skin);
}

/**
 * Ángulos objetivo de los brazos según el carácter y el movimiento.
 * @param {any} passenger
 * @param {number} seatX
 * @param {Motion} motion
 */
function armTargets(passenger, seatX, motion) {
  const downAngle = Math.PI / 2 - (motion.cartRotation ?? 0);
  const load = motion.load ?? 1;
  const wiggle = Math.sin((motion.time ?? 0) * 8 + seatX * 0.15) * 0.08;

  if (passenger.mood === "nervous") {
    return { left: downAngle + 0.55, right: downAngle + 0.1 };
  }

  if (passenger.mood === "brave" && (motion.inLoop || load < 0.6 || (motion.speed ?? 0) > 16)) {
    return { left: downAngle + Math.PI - 0.35 + wiggle, right: downAngle + Math.PI + 0.35 - wiggle };
  }

  const push = clamp(-(motion.tangentialAcceleration ?? 0) * 0.08, -0.55, 0.55);
  const lift = clamp((0.9 - load) * 0.5, -0.25, 0.55);

  return {
    left: downAngle - 0.38 + push - lift + wiggle,
    right: downAngle + 0.38 + push - lift - wiggle
  };
}

/**
 * Dibuja un pasajero sentado en la posición local `seatX`.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} passenger
 * @param {number} seatX
 * @param {Motion} [motion]
 */
export function drawPassenger(ctx, passenger, seatX, motion = {}) {
  ctx.save();
  ctx.translate(seatX, 0);

  const memoryKey = `${passenger.id}-${seatX}`;
  const previous = armMemory.get(memoryKey) ?? ARM_REST;
  const targets = armTargets(passenger, seatX, motion);
  const arms = {
    left: lerpAngle(previous.left, targets.left, ARM.smoothing),
    right: lerpAngle(previous.right, targets.right, ARM.smoothing)
  };
  armMemory.set(memoryKey, arms);

  const shift = hairShift(motion);
  const expression = expressionFor(passenger, motion);

  drawHairBack(ctx, passenger, shift);
  drawShirt(ctx, passenger);
  drawArm(ctx, -SHOULDER.halfWidth, arms.left, passenger.skin, passenger.shirt);
  drawArm(ctx, SHOULDER.halfWidth, arms.right, passenger.skin, passenger.shirt);
  drawFace(ctx, passenger, expression);
  drawHairTop(ctx, passenger, shift);
  drawAccessory(ctx, passenger);

  ctx.restore();
}
