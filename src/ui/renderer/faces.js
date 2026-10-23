import { PALETTE } from "./palette.js";
import { box, circle } from "./draw.js";
import { HEAD } from "./passenger-geometry.js";

/**
 * Cara, expresión y accesorios de la cabeza de un pasajero.
 * Mismo sistema de unidades que passengers.js (30 px por metro, y hacia abajo).
 */

const FACE = Object.freeze({ eye: "#2b2140", mouth: "#5a2e2e", tongue: "#e8788f", teeth: "#ffffff", blush: "rgba(232, 120, 143, 0.35)" });

/**
 * Expresión facial según la carga y el carácter.
 * @param {any} passenger
 * @param {import("./passengers.js").Motion} motion
 * @returns {"smile"|"grin"|"wii"|"scared"|"wide"|"meh"}
 */
export function expressionFor(passenger, motion) {
  const load = motion.load ?? 1;
  const mood = passenger.mood ?? "happy";

  if (mood === "nervous" && (load > 3 || load < 0.3)) return "scared";
  if (load > 4) return "wide";
  if (load < 0.5 && mood !== "nervous") return "wii";
  if (mood === "brave") return "grin";
  if (mood === "nervous") return "meh";
  return "smile";
}

/**
 * Cara con la expresión indicada.
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} passenger
 * @param {"smile"|"grin"|"wii"|"scared"|"wide"|"meh"} expression
 */
export function drawFace(ctx, passenger, expression) {
  circle(ctx, HEAD.x, HEAD.y, HEAD.radius, passenger.skin);
  circle(ctx, HEAD.x - HEAD.radius + 0.5, HEAD.y + 1, 2.8, passenger.skin);

  const eyeY = HEAD.y - 1;
  const eyes = [HEAD.x - 3.2, HEAD.x + 3.4];

  ctx.lineCap = "round";

  switch (expression) {
    case "wii":
      ctx.strokeStyle = FACE.eye;
      ctx.lineWidth = 1.4;
      for (const x of eyes) {
        ctx.beginPath();
        ctx.arc(x, eyeY + 0.5, 1.8, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      ctx.fillStyle = FACE.mouth;
      ctx.beginPath();
      ctx.ellipse(HEAD.x + 0.5, HEAD.y + 4, 3.4, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      circle(ctx, HEAD.x + 0.5, HEAD.y + 5.2, 1.5, FACE.tongue);
      circle(ctx, HEAD.x - 5.5, HEAD.y + 3, 1.8, FACE.blush);
      circle(ctx, HEAD.x + 6, HEAD.y + 3, 1.8, FACE.blush);
      break;

    case "scared":
      ctx.strokeStyle = FACE.eye;
      ctx.lineWidth = 1.4;
      for (const x of eyes) {
        ctx.beginPath();
        ctx.moveTo(x - 1.8, eyeY + 0.6);
        ctx.quadraticCurveTo(x, eyeY - 1.4, x + 1.8, eyeY + 0.6);
        ctx.stroke();
      }
      ctx.strokeStyle = FACE.mouth;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(HEAD.x - 3, HEAD.y + 4.5);
      ctx.lineTo(HEAD.x - 1.5, HEAD.y + 3.3);
      ctx.lineTo(HEAD.x, HEAD.y + 4.5);
      ctx.lineTo(HEAD.x + 1.5, HEAD.y + 3.3);
      ctx.lineTo(HEAD.x + 3, HEAD.y + 4.5);
      ctx.stroke();
      break;

    case "wide":
      for (const x of eyes) {
        circle(ctx, x, eyeY, 2.4, "#ffffff");
        circle(ctx, x + 0.6, eyeY, 1.3, FACE.eye);
      }
      circle(ctx, HEAD.x + 0.5, HEAD.y + 4.2, 1.8, FACE.mouth);
      break;

    case "grin":
      for (const x of eyes) circle(ctx, x + 0.4, eyeY, 1.25, FACE.eye);
      ctx.fillStyle = FACE.mouth;
      ctx.beginPath();
      ctx.arc(HEAD.x + 0.5, HEAD.y + 2.6, 3.4, 0.1, Math.PI - 0.1);
      ctx.closePath();
      ctx.fill();
      box(ctx, HEAD.x - 2.3, HEAD.y + 2.8, 5.6, 1.3, FACE.teeth, 0.5);
      break;

    case "meh":
      for (const x of eyes) circle(ctx, x + 0.4, eyeY, 1.2, FACE.eye);
      ctx.strokeStyle = FACE.eye;
      ctx.lineWidth = 1;
      for (const x of eyes) {
        ctx.beginPath();
        ctx.moveTo(x - 2, eyeY - 3.6);
        ctx.lineTo(x + 2, eyeY - 4.2);
        ctx.stroke();
      }
      ctx.strokeStyle = FACE.mouth;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(HEAD.x - 2, HEAD.y + 4.2);
      ctx.lineTo(HEAD.x + 2.5, HEAD.y + 4.2);
      ctx.stroke();
      break;

    default:
      for (const x of eyes) circle(ctx, x + 0.4, eyeY, 1.2, FACE.eye);
      ctx.strokeStyle = FACE.mouth;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(HEAD.x + 0.5, HEAD.y + 2.4, 2.6, 0.2, Math.PI - 0.2);
      ctx.stroke();
      break;
  }
}

/**
 * Accesorio de la cabeza.
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} passenger
 */
export function drawAccessory(ctx, passenger) {
  const color = passenger.accessoryColor ?? "#439c79";

  switch (passenger.accessory) {
    case "cap":
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(HEAD.x, HEAD.y - 2, HEAD.radius + 1.2, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      box(ctx, HEAD.x + 2, HEAD.y - 3.5, 11, 2.6, color, 1.2);
      break;

    case "helmet":
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(HEAD.x, HEAD.y - 1.5, HEAD.radius + 1.8, Math.PI * 0.95, Math.PI * 2.05);
      ctx.closePath();
      ctx.fill();
      box(ctx, HEAD.x - HEAD.radius - 1.8, HEAD.y - 2, (HEAD.radius + 1.8) * 2, 2.4, color, 1);
      ctx.strokeStyle = PALETTE.lapBar;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(HEAD.x - 6, HEAD.y + 1);
      ctx.quadraticCurveTo(HEAD.x, HEAD.y + 9.5, HEAD.x + 6, HEAD.y + 1);
      ctx.stroke();
      break;

    case "glasses":
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      for (const x of [HEAD.x - 3.2, HEAD.x + 3.4]) {
        ctx.beginPath();
        ctx.arc(x + 0.3, HEAD.y - 1, 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(HEAD.x - 0.2, HEAD.y - 1.5);
      ctx.lineTo(HEAD.x + 1.2, HEAD.y - 1.5);
      ctx.stroke();
      break;

    case "party":
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(HEAD.x - 5.5, HEAD.y - 7);
      ctx.lineTo(HEAD.x + 5.5, HEAD.y - 7);
      ctx.lineTo(HEAD.x, HEAD.y - 21);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(HEAD.x - 3.5, HEAD.y - 12);
      ctx.lineTo(HEAD.x + 3.5, HEAD.y - 12);
      ctx.stroke();
      circle(ctx, HEAD.x, HEAD.y - 21, 2, PALETTE.cartLight);
      break;

    case "headphones":
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(HEAD.x, HEAD.y, HEAD.radius + 1.6, Math.PI * 1.02, Math.PI * 1.98);
      ctx.stroke();
      box(ctx, HEAD.x - HEAD.radius - 3.2, HEAD.y - 3, 3.4, 6.5, color, 1.5);
      box(ctx, HEAD.x + HEAD.radius - 0.2, HEAD.y - 3, 3.4, 6.5, color, 1.5);
      break;

    default:
      break;
  }
}
