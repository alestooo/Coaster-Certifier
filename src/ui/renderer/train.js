import { geometryAt } from "../../physics/track/geometry.js";
import { PALETTE } from "./palette.js";
import { box, circle, ellipse } from "./draw.js";
import { CART_LENGTH_M, CART_GAP_M } from "./camera.js";
import { drawPassenger } from "./passengers.js";

/** Asientos por carrito (coincide con SEATS_PER_CART del juego). */
export const SEATS_PER_CART = 2;

/** Píxeles de diseño por metro: el carrito mide 2,8 m = 84 unidades. */
export const DESIGN_PX_PER_METRE = 30;

/** Geometría del carrito en unidades de diseño (y hacia abajo, origen en el riel). */
export const CART = Object.freeze({
  halfLength: 42,
  bodyTop: -33,
  bodyBottom: -11,
  panelTop: -29,
  panelBottom: -15,
  wheelRadius: 5,
  wheelY: -5,
  bogieOffset: 26,
  seatOffset: 19,
  lapBarY: -37,
  couplingY: -20
});

/** Altura (m) por debajo de la cual se proyecta sombra en el suelo. */
const SHADOW_HEIGHT_M = 4;

/**
 * Cantidad de carritos necesarios para los pasajeros.
 * @param {ReadonlyArray<any>} passengers
 */
export function cartCountFor(passengers) {
  return Math.max(1, Math.ceil(passengers.length / SEATS_PER_CART));
}

/**
 * Carrocería y ruedas de un carrito en coordenadas locales.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} index Índice del carrito (0 = delantero).
 * @param {boolean} isLead
 * @param {boolean} isLast
 */
function drawCartBody(ctx, index, isLead, isLast) {
  for (const bogieX of [-CART.bogieOffset, CART.bogieOffset]) {
    box(ctx, bogieX - 9, CART.wheelY - 5, 18, 7, PALETTE.bogie, 2);

    for (const wheelX of [bogieX - 5.5, bogieX + 5.5]) {
      circle(ctx, wheelX, CART.wheelY, CART.wheelRadius, PALETTE.wheel);
      circle(ctx, wheelX, CART.wheelY, CART.wheelRadius * 0.45, PALETTE.wheelRim);
    }
  }

  const body = ctx.createLinearGradient(0, CART.bodyTop, 0, CART.bodyBottom);
  body.addColorStop(0, PALETTE.cartLight);
  body.addColorStop(0.35, PALETTE.cart);
  body.addColorStop(1, PALETTE.cartDark);

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-CART.halfLength + 4, CART.bodyTop);
  ctx.lineTo(CART.halfLength - 10, CART.bodyTop);
  ctx.quadraticCurveTo(CART.halfLength + 2, CART.bodyTop + 2, CART.halfLength, CART.bodyTop + 12);
  ctx.lineTo(CART.halfLength - 2, CART.bodyBottom);
  ctx.lineTo(-CART.halfLength + 2, CART.bodyBottom);
  ctx.lineTo(-CART.halfLength, CART.bodyTop + 6);
  ctx.quadraticCurveTo(-CART.halfLength, CART.bodyTop, -CART.halfLength + 4, CART.bodyTop);
  ctx.closePath();
  ctx.fill();

  box(ctx, -CART.halfLength + 8, CART.panelTop, CART.halfLength * 2 - 20, CART.panelBottom - CART.panelTop, PALETTE.cartPanel, 3);
  box(ctx, -CART.halfLength + 4, CART.bodyTop - 1.5, CART.halfLength * 2 - 14, 3, PALETTE.cartTrim, 1.5);

  circle(ctx, -CART.halfLength + 17, (CART.panelTop + CART.panelBottom) / 2, 5.5, PALETTE.cartTrim);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 7px Nunito, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(index + 1), -CART.halfLength + 17, (CART.panelTop + CART.panelBottom) / 2 + 0.5);

  if (isLead) {
    circle(ctx, CART.halfLength - 3, CART.bodyTop + 14, 5, PALETTE.headlightGlow);
    circle(ctx, CART.halfLength - 3, CART.bodyTop + 14, 2.6, PALETTE.headlight);
    circle(ctx, CART.halfLength - 3, CART.bodyTop + 14, 1, "#ffffff");
  }

  if (isLast) {
    box(ctx, -CART.halfLength - 1, CART.bodyBottom - 8, 2.5, 5, PALETTE.danger, 1);
  }
}

/**
 * Barra de seguridad sobre los pasajeros.
 * @param {CanvasRenderingContext2D} ctx
 */
function drawLapBar(ctx) {
  ctx.strokeStyle = PALETTE.lapBar;
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-CART.halfLength + 10, CART.lapBarY);
  ctx.lineTo(CART.halfLength - 12, CART.lapBarY);
  ctx.stroke();

  for (const x of [-CART.halfLength + 10, 0, CART.halfLength - 12]) {
    box(ctx, x - 1.6, CART.lapBarY, 3.2, CART.bodyTop - CART.lapBarY + 2, PALETTE.lapBar, 1);
  }
}

/**
 * Asientos (respaldos) detrás de los pasajeros.
 * @param {CanvasRenderingContext2D} ctx
 */
function drawSeats(ctx) {
  for (const seatX of [-CART.seatOffset, CART.seatOffset]) {
    box(ctx, seatX - 14, -46, 9, 30, PALETTE.seatDark, 3);
    box(ctx, seatX - 12, -44, 7, 26, PALETTE.seat, 2);
  }
}

/**
 * Un carrito completo con sus pasajeros, en coordenadas locales.
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReadonlyArray<any>} passengers
 * @param {import("./passengers.js").Motion} motion
 * @param {number} index
 * @param {number} count
 */
function drawCart(ctx, passengers, motion, index, count) {
  drawSeats(ctx);

  passengers.forEach((passenger, seat) => {
    drawPassenger(ctx, passenger, seat === 0 ? -CART.seatOffset : CART.seatOffset, motion);
  });

  drawCartBody(ctx, index, index === 0, index === count - 1);
  drawLapBar(ctx);
}

/**
 * Posición y rotación en pantalla de cada carrito del tren.
 * @param {import("./camera.js").Camera} camera
 * @param {any} track
 * @param {any} state
 * @param {number} count
 */
export function cartPlacements(camera, track, state, count) {
  const spacing = (CART_LENGTH_M + CART_GAP_M) * (camera.trainScale / camera.scale);

  return Array.from({ length: count }, (_, index) => {
    const geometry = geometryAt(track, state.distance - index * spacing);

    return {
      x: camera.toX(geometry.x),
      y: camera.toY(geometry.y),
      height: geometry.y,
      rotation: -geometry.angle,
      kind: geometry.kind
    };
  });
}

/**
 * Convierte una posición local del carrito a coordenadas de pantalla.
 * @param {{x: number, y: number, rotation: number}} cart
 * @param {number} localX
 * @param {number} localY
 * @param {number} unit Píxeles por unidad de diseño.
 */
function attachment(cart, localX, localY, unit) {
  const cos = Math.cos(cart.rotation);
  const sin = Math.sin(cart.rotation);

  return {
    x: cart.x + (localX * cos - localY * sin) * unit,
    y: cart.y + (localX * sin + localY * cos) * unit
  };
}

/**
 * Tren completo: sombras, uniones y carritos de atrás hacia adelante.
 * @param {import("./index.js").Frame} frame
 */
export function drawTrain({ ctx, camera, scene }) {
  const passengers = scene.passengers ?? [];
  const count = cartCountFor(passengers);
  const carts = cartPlacements(camera, scene.track, scene.state, count);
  const unit = camera.trainScale / DESIGN_PX_PER_METRE;

  for (const cart of carts) {
    if (cart.height > SHADOW_HEIGHT_M) continue;
    const alpha = 1 - cart.height / SHADOW_HEIGHT_M;
    ctx.globalAlpha = alpha;
    ellipse(ctx, cart.x, camera.groundY + 2, CART.halfLength * unit * 0.9, Math.max(2, 4 * unit), PALETTE.shadow);
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = PALETTE.coupling;
  ctx.lineWidth = Math.max(2, 4 * unit);
  ctx.lineCap = "round";

  for (let index = 1; index < carts.length; index++) {
    const front = attachment(carts[index - 1], -CART.halfLength + 2, CART.couplingY, unit);
    const back = attachment(carts[index], CART.halfLength - 2, CART.couplingY, unit);

    ctx.beginPath();
    ctx.moveTo(front.x, front.y);
    ctx.lineTo(back.x, back.y);
    ctx.stroke();
  }

  for (let index = carts.length - 1; index >= 0; index--) {
    const cart = carts[index];

    ctx.save();
    ctx.translate(cart.x, cart.y);
    ctx.rotate(cart.rotation);
    ctx.scale(unit, unit);

    drawCart(
      ctx,
      passengers.slice(index * SEATS_PER_CART, (index + 1) * SEATS_PER_CART),
      {
        cartRotation: cart.rotation,
        tangentialAcceleration: scene.state.tangentialAcceleration,
        load: scene.state.load,
        speed: scene.state.speed,
        time: scene.state.time,
        inLoop: cart.kind === "loop"
      },
      index,
      count
    );

    ctx.restore();
  }
}
