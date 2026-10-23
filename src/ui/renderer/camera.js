import { geometryAt } from "../../physics/track/geometry.js";

/** Márgenes del encuadre completo (px CSS). */
const MARGIN_X = 36;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 60;

/** Punto de la pantalla donde se ancla el tren en modo seguimiento. */
const FOLLOW_ANCHOR_X = 0.56;
const FOLLOW_ANCHOR_Y = 0.62;

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 2.5;
const DEFAULT_FOLLOW_ZOOM = 1.8;

/** Longitud de vía prolongada hacia atrás desde A, sobre la tangente inicial (m). */
export const LIFT_TANGENT_LENGTH = 24;

/** Avance horizontal de la rampa de la cadena por cada metro de altura. */
const LIFT_RUN_PER_HEIGHT = 1.2;

/** Espacio reservado a la derecha del final de la vía para la estación (m). */
const STATION_OVERHANG_METRES = 6;

/**
 * @typedef {Object} Camera
 * @property {number} width Ancho del lienzo (px CSS).
 * @property {number} height Alto del lienzo (px CSS).
 * @property {number} scale Píxeles por metro, con zoom aplicado.
 * @property {number} baseScale Píxeles por metro del encuadre completo.
 * @property {number} zoom Factor de zoom (1 en encuadre completo).
 * @property {boolean} follow Verdadero en modo seguimiento.
 * @property {(x: number) => number} toX Metros → píxeles (horizontal).
 * @property {(y: number) => number} toY Metros → píxeles (vertical, y hacia arriba).
 * @property {number} groundY Altura en píxeles del suelo (y = 0).
 * @property {{x: number, y: number}[]} lift Perfil de la rampa de la cadena (m).
 */

/**
 * Perfil de la subida por cadena: del suelo hasta la cresta previa a A,
 * siguiendo la tangente inicial de la vía para que los vagones traseros
 * descansen sobre la línea dibujada.
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
 * Prepara el lienzo para la densidad de píxeles del dispositivo y
 * devuelve el contexto con el tamaño lógico (px CSS).
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{ctx: CanvasRenderingContext2D, width: number, height: number} | null}
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

  return { ctx, width, height };
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
  const follow = scene.camera?.mode === "follow";

  const zoom = follow
    ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(scene.camera?.zoom) || DEFAULT_FOLLOW_ZOOM))
    : 1;

  const minX = Math.min(lift[0].x, track.minX);
  const maxX = track.endX + STATION_OVERHANG_METRES;
  const maxY = Math.max(track.maxHeight, ...lift.map(point => point.y), 1);

  const baseScale = Math.min(
    (width - 2 * MARGIN_X) / Math.max(1, maxX - minX),
    (height - MARGIN_TOP - MARGIN_BOTTOM) / maxY
  );

  const scale = baseScale * zoom;
  const offsetX = (width - (maxX - minX) * baseScale) / 2 - minX * baseScale;

  const toX = follow
    ? (/** @type {number} */ x) => width * FOLLOW_ANCHOR_X + (x - state.position.x) * scale
    : (/** @type {number} */ x) => offsetX + x * baseScale;

  const toY = follow
    ? (/** @type {number} */ y) => height * FOLLOW_ANCHOR_Y - (y - state.position.y) * scale
    : (/** @type {number} */ y) => height - MARGIN_BOTTOM - y * baseScale;

  return {
    width,
    height,
    scale,
    baseScale,
    zoom,
    follow,
    toX,
    toY,
    groundY: toY(0),
    lift
  };
}
