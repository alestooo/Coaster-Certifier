import { geometryAt } from "../../physics/track/geometry.js";
import { PALETTE } from "./palette.js";
import { box, circle, ellipse } from "./draw.js";
import { CART_LENGTH_M, CART_GAP_M } from "./camera.js";
import { pointOnLift } from "./lift.js";
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

/** Radio real de las ruedas (m): 5 unidades de diseño a 30 por metro. */
const WHEEL_RADIUS_M = 5 / 30;

/** Altura (m) por debajo de la cual se proyecta sombra en el suelo. */
const SHADOW_HEIGHT_M = 4;

/** Por debajo de este largo en pantalla (px), el tren lleva un marcador para encontrarlo. */
const MIN_VISIBLE_TRAIN_PX = 12;
/** Radio del halo del marcador y largo de su flecha (px, espacio de pantalla). */
const MARKER_HALO_PX = 11;
const MARKER_ARROW_PX = 9;

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
function drawCartBody(ctx, index, isLead, isLast, wheelAngle = 0) {
  for (const bogieX of [-CART.bogieOffset, CART.bogieOffset]) {
    box(ctx, bogieX - 9, CART.wheelY - 5, 18, 7, PALETTE.bogie, 2);

    for (const wheelX of [bogieX - 5.5, bogieX + 5.5]) {
      circle(ctx, wheelX, CART.wheelY, CART.wheelRadius, PALETTE.wheel);
      circle(ctx, wheelX, CART.wheelY, CART.wheelRadius * 0.45, PALETTE.wheelRim);
      // Un rayo que gira con la rueda: ángulo = s/r (rueda sin deslizar).
      const spokeX = Math.cos(wheelAngle) * CART.wheelRadius * 0.85;
      const spokeY = Math.sin(wheelAngle) * CART.wheelRadius * 0.85;
      ctx.strokeStyle = PALETTE.wheelRim;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(wheelX - spokeX, CART.wheelY - spokeY);
      ctx.lineTo(wheelX + spokeX, CART.wheelY + spokeY);
      ctx.stroke();
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

  drawCartBody(ctx, index, index === 0, index === count - 1, motion.wheelAngle);
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
  const spacing = CART_LENGTH_M + CART_GAP_M;

  return Array.from({ length: count }, (_, index) => {
    const distance = state.distance - index * spacing;
    // Detrás de A el carro va sobre la subida, no sobre una prolongación de la caída.
    const geometry = distance < 0 ? { ...pointOnLift(camera.lift, -distance), kind: "lift" } : geometryAt(track, distance);

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
 * Halo y flecha en espacio de pantalla cuando el tren mide pocos píxeles:
 * se lo encuentra sin agrandar su geometría.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number}} lead
 */
function drawTrainMarker(ctx, lead) {
  ctx.save();
  ctx.strokeStyle = PALETTE.marker;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(lead.x, lead.y, MARKER_HALO_PX, 0, Math.PI * 2);
  ctx.stroke();

  const tipY = lead.y - MARKER_HALO_PX - 2;
  ctx.fillStyle = PALETTE.marker;
  ctx.beginPath();
  ctx.moveTo(lead.x, tipY);
  ctx.lineTo(lead.x - MARKER_ARROW_PX / 2, tipY - MARKER_ARROW_PX);
  ctx.lineTo(lead.x + MARKER_ARROW_PX / 2, tipY - MARKER_ARROW_PX);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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
  // Los carros del tren simulado (pueden ir vacíos); sin tren articulado, los que piden los pasajeros.
  const count = Math.max(scene.state.cars?.length ?? 0, cartCountFor(passengers));
  const carts = cartPlacements(camera, scene.track, scene.state, count);
  const unit = camera.scale / DESIGN_PX_PER_METRE;

  for (const cart of carts) {
    if (cart.height > SHADOW_HEIGHT_M) continue;
    const alpha = 1 - cart.height / SHADOW_HEIGHT_M;
    ctx.globalAlpha = alpha;
    ellipse(ctx, cart.x, camera.groundY, CART.halfLength * unit * 0.9, 4 * unit, PALETTE.shadow);
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = PALETTE.coupling;
  ctx.lineWidth = 4 * unit;
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
        // Con el tren articulado, cada carro siente su propia fuerza g.
        load: scene.state.cars?.[index]?.load ?? scene.state.load,
        wheelAngle: (scene.state.distance - index * (CART_LENGTH_M + CART_GAP_M)) / WHEEL_RADIUS_M,
        speed: scene.state.speed,
        time: scene.state.time,
        inLoop: cart.kind === "loop"
      },
      index,
      count
    );

    ctx.restore();
  }

  if (CART_LENGTH_M * count * camera.scale < MIN_VISIBLE_TRAIN_PX && carts[0]) drawTrainMarker(ctx, carts[0]);
}
