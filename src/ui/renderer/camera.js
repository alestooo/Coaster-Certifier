import { geometryAt } from "../../physics/track/geometry.js";
import { clamp } from "./draw.js";

/** Márgenes del encuadre completo (px CSS). */
const MARGIN_X = 28;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 58;

/** Anclaje del tren en pantalla en modo seguimiento (fracción del lienzo). */
const FOLLOW_ANCHOR_X = 0.5;
const FOLLOW_ANCHOR_Y = 0.6;

/** Franja mínima de suelo visible bajo la vía en modo seguimiento (px). */
const FOLLOW_GROUND_MARGIN = 110;

/** Píxeles por metro en modo seguimiento con zoom 1 (escala real). */
const FOLLOW_PX_PER_METRE = 12;

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 2.5;
const DEFAULT_FOLLOW_ZOOM = 1.6;

/** Dimensiones del tren en metros. */
export const CART_LENGTH_M = 2.8;
export const CART_GAP_M = 0.45;

/**
 * Escala visual mínima: en el encuadre completo el tren se dibuja al menos
 * con este largo en píxeles aunque la escala real lo haría más pequeño.
 * En modo seguimiento todo se dibuja a escala real.
 */
export const MIN_TRAIN_PX = 34;

/** Longitud de vía prolongada hacia atrás desde A, sobre la tangente inicial (m). */
export const LIFT_TANGENT_LENGTH = 20;

/** Avance horizontal de la rampa de la cadena por cada metro de altura. */
const LIFT_RUN_PER_HEIGHT = 1.35;

/** Espacio de mundo reservado alrededor del trazado (m). */
const WORLD_PAD_LEFT = 10;
const WORLD_PAD_RIGHT = 34;
const WORLD_PAD_TOP = 9;
export const WORLD_DEPTH = 4;

/**
 * @typedef {Object} Camera
 * @property {number} width Ancho del lienzo (px CSS).
 * @property {number} height Alto del lienzo (px CSS).
 * @property {number} scale Píxeles por metro.
 * @property {number} trainScale Píxeles por metro usados para el tren (con escala visual mínima).
 * @property {number} zoom Zoom pedido (1 en encuadre completo).
 * @property {boolean} follow Verdadero en modo seguimiento.
 * @property {(x: number) => number} toX Metros → píxeles (horizontal).
 * @property {(y: number) => number} toY Metros → píxeles (vertical, y hacia arriba).
 * @property {number} groundY Altura en píxeles del suelo (y = 0).
 * @property {{x: number, y: number}[]} lift Perfil de la rampa de la cadena (m).
 * @property {{minX: number, maxX: number, minY: number, maxY: number}} world Extensión del mundo (m).
 * @property {number} viewCenterX Centro horizontal visible (m), para el paralaje.
 */

/**
 * Perfil de la subida por cadena: del suelo hasta la cresta previa a A,
 * siguiendo la tangente inicial de la vía.
 *
 * @param {any} track
 * @returns {{x: number, y: number}[]}
 */
export function liftProfile(track) {
  const top = geometryAt(track, 0);
  const back = geometryAt(track, -LIFT_TANGENT_LENGTH);
  const crest = back.y >= top.y ? back : top;

  return [
    { x: crest.x - crest.y * LIFT_RUN_PER_HEIGHT, y: 0 },
    { x: back.x, y: back.y },
    { x: top.x, y: top.y }
  ];
}

/**
 * Extensión del mundo dibujado (m).
 * @param {any} track
 * @param {{x: number, y: number}[]} lift
 */
export function worldBounds(track, lift) {
  return {
    minX: Math.min(lift[0].x, track.minX) - WORLD_PAD_LEFT,
    maxX: track.endX + WORLD_PAD_RIGHT,
    minY: -WORLD_DEPTH,
    maxY: Math.max(track.maxHeight, ...lift.map(point => point.y), 1) + WORLD_PAD_TOP
  };
}

/**
 * Prepara el lienzo para la densidad de píxeles del dispositivo y
 * devuelve el contexto con el tamaño lógico (px CSS).
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{ctx: CanvasRenderingContext2D, width: number, height: number, ratio: number} | null}
 */
export function prepareCanvas(canvas) {
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  const ratio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const hasLayout = canvas.clientWidth > 0 && canvas.clientHeight > 0;
  const width = hasLayout ? canvas.clientWidth : canvas.width;
  const height = hasLayout ? canvas.clientHeight : canvas.height;
  const targetWidth = Math.round(width * ratio);
  const targetHeight = Math.round(height * ratio);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  return { ctx, width, height, ratio };
}

/**
 * Construye la proyección mundo → pantalla para la escena.
 *
 * @param {number} width
 * @param {number} height
 * @param {{state: any, track: any, camera?: {mode?: string, zoom?: number}}} scene
 * @returns {Camera}
 */
export function createCamera(width, height, scene) {
  const { track, state } = scene;
  const lift = liftProfile(track);
  const world = worldBounds(track, lift);
  const follow = scene.camera?.mode === "follow";

  if (follow) {
    const zoom = clamp(Number(scene.camera?.zoom) || DEFAULT_FOLLOW_ZOOM, MIN_ZOOM, MAX_ZOOM);
    const scale = FOLLOW_PX_PER_METRE * zoom;
    const anchorY = height * FOLLOW_ANCHOR_Y;
    const centerY = Math.max(state.position.y, (height - FOLLOW_GROUND_MARGIN - anchorY) / scale);
    const centerX = state.position.x;

    const toX = (/** @type {number} */ x) => width * FOLLOW_ANCHOR_X + (x - centerX) * scale;
    const toY = (/** @type {number} */ y) => anchorY - (y - centerY) * scale;

    return {
      width,
      height,
      scale,
      trainScale: scale,
      zoom,
      follow,
      toX,
      toY,
      groundY: toY(0),
      lift,
      world,
      viewCenterX: centerX
    };
  }

  const spanX = Math.max(1, world.maxX - world.minX);
  const spanY = Math.max(1, world.maxY);
  const scale = Math.min((width - 2 * MARGIN_X) / spanX, (height - MARGIN_TOP - MARGIN_BOTTOM) / spanY);
  const offsetX = (width - spanX * scale) / 2 - world.minX * scale;
  const groundY = height - MARGIN_BOTTOM;

  const toX = (/** @type {number} */ x) => offsetX + x * scale;
  const toY = (/** @type {number} */ y) => groundY - y * scale;

  return {
    width,
    height,
    scale,
    trainScale: Math.max(scale, MIN_TRAIN_PX / CART_LENGTH_M),
    zoom: 1,
    follow,
    toX,
    toY,
    groundY,
    lift,
    world,
    viewCenterX: (world.minX + world.maxX) / 2
  };
}

/**
 * Cámara auxiliar que proyecta el mundo sobre un lienzo fuera de pantalla
 * (coordenadas de mundo → píxeles de la capa estática).
 *
 * @param {Camera} camera
 * @returns {Camera}
 */
export function layerCamera(camera) {
  const { world, scale } = camera;
  const toX = (/** @type {number} */ x) => (x - world.minX) * scale;
  const toY = (/** @type {number} */ y) => (world.maxY - y) * scale;

  return {
    ...camera,
    width: (world.maxX - world.minX) * scale,
    height: (world.maxY - world.minY) * scale,
    toX,
    toY,
    groundY: toY(0)
  };
}
