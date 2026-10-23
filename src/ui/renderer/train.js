import { geometryAt } from "../../physics/track/geometry.js";
import { PALETTE } from "./palette.js";
import { box } from "./draw.js";
import { drawPassenger } from "./passengers.js";

/** Asientos por carrito (coincide con SEATS_PER_CART del juego). */
export const SEATS_PER_CART = 2;

/** Separación entre carritos en píxeles del encuadre completo. */
export const CART_SPACING_PX = 74;

/** Geometría del carrito en su sistema local (px antes del zoom). */
export const CART = Object.freeze({
  halfWidth: 31,
  bodyTop: -19,
  bodyHeight: 17,
  stripeInset: 5,
  stripeTop: -15,
  stripeHeight: 4,
  barY: -23,
  wheelOffset: 19,
  wheelY: -2,
  wheelRadius: 5,
  couplingY: -10,
  seatOffset: 14
});

/**
 * Cantidad de carritos necesarios para los pasajeros.
 * @param {ReadonlyArray<any>} passengers
 */
export function cartCountFor(passengers) {
  return Math.max(1, Math.ceil(passengers.length / SEATS_PER_CART));
}

/**
 * Un carrito con sus pasajeros, en coordenadas locales.
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReadonlyArray<any>} passengers
 * @param {{cartRotation?: number, tangentialAcceleration?: number, load?: number, time?: number}} motion
 */
function drawCart(ctx, passengers, motion) {
  passengers.forEach((passenger, index) => {
    drawPassenger(ctx, passenger, index === 0 ? -CART.seatOffset : CART.seatOffset, motion);
  });

  box(ctx, -CART.halfWidth, CART.bodyTop, 2 * CART.halfWidth, CART.bodyHeight, PALETTE.cart);
  box(
    ctx,
    -CART.halfWidth + CART.stripeInset,
    CART.stripeTop,
    2 * (CART.halfWidth - CART.stripeInset),
    CART.stripeHeight,
    PALETTE.cartStripe,
    1
  );

  ctx.strokeStyle = PALETTE.cartBar;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-CART.halfWidth + CART.stripeInset, CART.barY);
  ctx.lineTo(CART.halfWidth - CART.stripeInset, CART.barY);
  ctx.stroke();

  for (const wheelX of [-CART.wheelOffset, CART.wheelOffset]) {
    ctx.fillStyle = PALETTE.wheel;
    ctx.beginPath();
    ctx.arc(wheelX, CART.wheelY, CART.wheelRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Posición y rotación en pantalla de cada carrito del tren.
 * @param {import("./camera.js").Camera} camera
 * @param {any} track
 * @param {any} state
 * @param {number} count
 */
export function cartPlacements(camera, track, state, count) {
  const spacing = CART_SPACING_PX / camera.baseScale;

  return Array.from({ length: count }, (_, index) => {
    const geometry = geometryAt(track, state.distance - index * spacing);

    return {
      x: camera.toX(geometry.x),
      y: camera.toY(geometry.y),
      rotation: -geometry.angle
    };
  });
}

/**
 * Convierte una posición local del carrito a coordenadas de pantalla.
 * @param {{x: number, y: number, rotation: number}} cart
 * @param {number} localX
 * @param {number} localY
 * @param {number} zoom
 */
function attachment(cart, localX, localY, zoom) {
  const cos = Math.cos(cart.rotation);
  const sin = Math.sin(cart.rotation);

  return {
    x: cart.x + (localX * cos - localY * sin) * zoom,
    y: cart.y + (localX * sin + localY * cos) * zoom
  };
}

/**
 * Tren completo: uniones y carritos, de atrás hacia adelante.
 * @param {import("./index.js").Frame} frame
 */
export function drawTrain({ ctx, camera, scene }) {
  const passengers = scene.passengers ?? [];
  const count = cartCountFor(passengers);
  const carts = cartPlacements(camera, scene.track, scene.state, count);
  const zoom = camera.zoom;

  ctx.strokeStyle = PALETTE.coupling;
  ctx.lineWidth = 4 * zoom;
  ctx.lineCap = "round";

  for (let index = 1; index < carts.length; index++) {
    const front = attachment(carts[index - 1], -CART.halfWidth, CART.couplingY, zoom);
    const back = attachment(carts[index], CART.halfWidth, CART.couplingY, zoom);

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
    ctx.scale(zoom, zoom);

    drawCart(ctx, passengers.slice(index * SEATS_PER_CART, (index + 1) * SEATS_PER_CART), {
      cartRotation: cart.rotation,
      tangentialAcceleration: scene.state.tangentialAcceleration,
      load: scene.state.load,
      time: scene.state.time
    });

    ctx.restore();
  }
}
