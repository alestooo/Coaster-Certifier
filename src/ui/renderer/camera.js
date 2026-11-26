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

/** Zoom del encuadre ajustado, en veces la escala que muestra de A a F. */
export const MIN_VIEW_ZOOM = 1;
export const MAX_VIEW_ZOOM = 8;

/** Márgenes del encuadre ajustado alrededor del trazado (m). */
const FIT_PAD_M = 4;
const FIT_PAD_TOP_M = 6;
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
 * Vista pedida por la interfaz.
 * @typedef {Object} CameraView
 * @property {"fit" | "follow"} mode
 * @property {number} zoom Veces la escala del encuadre (fit) o zoom de seguimiento.
 * @property {number} [centerX] Centro visible (m), solo en `fit`.
 * @property {number} [centerY] Centro visible (m), solo en `fit`.
 * @property {number} [scale] Escala absoluta (px/m) en `fit`; reemplaza al zoom. Congela la
 *   proyección mientras se arrastra una manija aunque el trazado cambie de tamaño.
 */

/**
 * @typedef {Object} Camera
 * @property {number} width Ancho del lienzo (px CSS).
 * @property {number} height Alto del lienzo (px CSS).
 * @property {number} scale Píxeles por metro.
 * @property {number} fitScale Píxeles por metro del encuadre ajustado (zoom 1).
 * @property {number} trainScale Píxeles por metro usados para el tren (con escala visual mínima).
 * @property {number} zoom Zoom pedido (1 en encuadre completo).
 * @property {boolean} follow Verdadero en modo seguimiento.
 * @property {(x: number) => number} toX Metros → píxeles (horizontal).
 * @property {(y: number) => number} toY Metros → píxeles (vertical, y hacia arriba).
 * @property {(px: number) => number} fromX Píxeles → metros (horizontal).
 * @property {(py: number) => number} fromY Píxeles → metros (vertical).
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
 * Encuadre ajustado del taller: de la cresta de la cadena a F, sin el
 * relleno de escenario que rodea al mundo (m).
 *
 * @param {any} track
 * @param {{x: number, y: number}[]} lift
 * @returns {{minX: number, maxX: number, minY: number, maxY: number}}
 */
export function fitBounds(track, lift) {
  const crest = lift[1];

  return {
    minX: Math.min(crest.x, track.minX) - FIT_PAD_M,
    maxX: track.endX + FIT_PAD_M,
    minY: 0,
    maxY: Math.max(track.maxHeight, crest.y, 1) + FIT_PAD_TOP_M
  };
}

/**
 * Píxeles por metro que encuadran `bounds` dentro del lienzo.
 * @param {number} width
 * @param {number} height
 * @param {{minX: number, maxX: number, minY: number, maxY: number}} bounds
 */
function scaleToFit(width, height, bounds) {
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);

  return Math.max(1e-6, Math.min((width - 2 * MARGIN_X) / spanX, (height - MARGIN_TOP - MARGIN_BOTTOM) / spanY));
}

/**
 * Vista que encuadra un rectángulo del mundo (zoom a la selección).
 *
 * @param {number} width
 * @param {number} height
 * @param {any} track
 * @param {{minX: number, maxX: number, minY: number, maxY: number}} bounds
 * @returns {CameraView}
 */
export function frameView(width, height, track, bounds) {
  const fitScale = scaleToFit(width, height, fitBounds(track, liftProfile(track)));
  const wanted = scaleToFit(width, height, bounds);

  return {
    mode: "fit",
    zoom: clamp(wanted / fitScale, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM),
    centerX: (bounds.minX + bounds.maxX) / 2,
    centerY: (bounds.minY + bounds.maxY) / 2
  };
}

/**
 * Como `frameView`, pero con los `inset` px de abajo tapados (la hoja del
 * panel en el teléfono): encuadra `bounds` en lo que queda visible arriba.
 * @param {number} width
 * @param {number} height
 * @param {number} inset
 * @param {any} track
 * @param {{minX: number, maxX: number, minY: number, maxY: number}} bounds
 * @returns {CameraView}
 */
export function frameViewAbove(width, height, inset, track, bounds) {
  if (inset <= 0) return frameView(width, height, track, bounds);

  const visible = Math.max(1, height - inset);
  const fitScale = scaleToFit(width, height, fitBounds(track, liftProfile(track)));
  const scale = clamp(scaleToFit(width, visible, bounds), fitScale * MIN_VIEW_ZOOM, fitScale * MAX_VIEW_ZOOM);

  return {
    mode: "fit",
    zoom: scale / fitScale,
    centerX: (bounds.minX + bounds.maxX) / 2,
    // El centro del lienzo queda `inset / 2` px por debajo del centro de lo visible.
    centerY: (bounds.minY + bounds.maxY) / 2 - inset / (2 * scale)
  };
}

/**
 * Proyección lineal centrada en (centerX, centerY) con la escala dada.
 * @param {number} width
 * @param {number} height
 * @param {number} scale
 * @param {number} centerX
 * @param {number} centerY
 * @param {number} anchorX Fracción horizontal del lienzo donde cae el centro.
 * @param {number} anchorY Posición vertical (px) donde cae el centro.
 */
function projection(width, height, scale, centerX, centerY, anchorX, anchorY) {
  const originX = width * anchorX;

  return {
    toX: (/** @type {number} */ x) => originX + (x - centerX) * scale,
    toY: (/** @type {number} */ y) => anchorY - (y - centerY) * scale,
    fromX: (/** @type {number} */ px) => centerX + (px - originX) / scale,
    fromY: (/** @type {number} */ py) => centerY + (anchorY - py) / scale
  };
}

/**
 * Construye la proyección mundo → pantalla para la escena.
 *
 * Modos:
 *  - `fit`: encuadre ajustado de A a F; con `zoom > 1` amplía alrededor de
 *    (`centerX`, `centerY`) o, si no se indican, del centro del encuadre.
 *  - `follow`: escala real centrada en el tren.
 *
 * @param {number} width
 * @param {number} height
 * @param {{state: any, track: any, camera?: Partial<CameraView> | {mode?: string, zoom?: number}}} scene
 * @returns {Camera}
 */
export function createCamera(width, height, scene) {
  const { track, state } = scene;
  const lift = liftProfile(track);
  const world = worldBounds(track, lift);
  const bounds = fitBounds(track, lift);
  const fitScale = scaleToFit(width, height, bounds);
  const view = /** @type {Partial<CameraView>} */ (scene.camera ?? {});
  const follow = view.mode === "follow";

  if (follow) {
    const zoom = clamp(Number(view.zoom) || DEFAULT_FOLLOW_ZOOM, MIN_ZOOM, MAX_ZOOM);
    const scale = FOLLOW_PX_PER_METRE * zoom;
    const anchorY = height * FOLLOW_ANCHOR_Y;
    const centerY = Math.max(state.position.y, (height - FOLLOW_GROUND_MARGIN - anchorY) / scale);
    const centerX = state.position.x;
    const map = projection(width, height, scale, centerX, centerY, FOLLOW_ANCHOR_X, anchorY);

    return { width, height, scale, fitScale, trainScale: scale, zoom, follow, ...map, groundY: map.toY(0), lift, world, viewCenterX: centerX };
  }

  const fixedScale = Number(view.scale);
  const zoom = Number.isFinite(fixedScale) && fixedScale > 0 ? fixedScale / fitScale : clamp(Number(view.zoom) || 1, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM);
  const scale = Number.isFinite(fixedScale) && fixedScale > 0 ? fixedScale : fitScale * zoom;
  const centerX = Number.isFinite(view.centerX) ? Number(view.centerX) : (bounds.minX + bounds.maxX) / 2;
  // Sin centro pedido, el encuadre queda centrado verticalmente en el área libre entre márgenes.
  const usableMiddle = (MARGIN_TOP + height - MARGIN_BOTTOM) / 2;
  const fitMiddle = (bounds.minY + bounds.maxY) / 2 - (height / 2 - usableMiddle) / fitScale;
  const centerY = Number.isFinite(view.centerY) ? Number(view.centerY) : fitMiddle;
  const map = projection(width, height, scale, centerX, centerY, 0.5, height / 2);

  return {
    width,
    height,
    scale,
    fitScale,
    trainScale: Math.max(scale, MIN_TRAIN_PX / CART_LENGTH_M),
    zoom,
    follow,
    ...map,
    groundY: map.toY(0),
    lift,
    world,
    viewCenterX: centerX
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
  const fromX = (/** @type {number} */ px) => world.minX + px / scale;
  const fromY = (/** @type {number} */ py) => world.maxY - py / scale;

  return {
    ...camera,
    width: (world.maxX - world.minX) * scale,
    height: (world.maxY - world.minY) * scale,
    toX,
    toY,
    fromX,
    fromY,
    groundY: toY(0)
  };
}
