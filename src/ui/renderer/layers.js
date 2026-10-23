import { layerCamera } from "./camera.js";

/**
 * Caché de la capa estática del mundo (escenario, vía, soportes y
 * estación) en un lienzo fuera de pantalla. Se reconstruye solo cuando
 * cambian el trazado, la escala, la densidad de píxeles o las opciones.
 */

/** Píxeles máximos de la capa; por encima se dibuja directamente. */
const MAX_LAYER_PIXELS = 16e6;
const MAX_ENTRIES = 3;

/** @type {WeakMap<object, number>} */
const trackIds = new WeakMap();
let nextTrackId = 1;

/** @type {Map<string, {canvas: any, width: number, height: number}>} */
const cache = new Map();

/**
 * @param {number} width
 * @param {number} height
 * @returns {any | null}
 */
function createCanvas(width, height) {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  return null;
}

/**
 * Clave de caché de la capa estática.
 * @param {import("./index.js").Frame} frame
 * @param {number} ratio
 */
function layerKey(frame, ratio) {
  const { scene, camera, options } = frame;
  let id = trackIds.get(scene.track);

  if (!id) {
    id = nextTrackId++;
    trackIds.set(scene.track, id);
  }

  return [
    id,
    camera.scale.toFixed(4),
    ratio,
    scene.config.brakeMode,
    scene.config.brakingLength,
    scene.config.springConstant,
    scene.config.maxCompression,
    scene.config.brakeDeceleration,
    options.showSections,
    options.showMarkers,
    options.showScenery
  ].join("|");
}

/**
 * Devuelve la capa estática (creándola si hace falta) o `null` cuando
 * no se puede cachear; en ese caso el llamador dibuja directamente.
 *
 * @param {import("./index.js").Frame} frame
 * @param {number} ratio Densidad de píxeles.
 * @param {(frame: import("./index.js").Frame) => void} drawWorld
 */
export function getWorldLayer(frame, ratio, drawWorld) {
  const key = layerKey(frame, ratio);
  const cached = cache.get(key);

  if (cached) return cached;

  const { camera } = frame;
  const width = (camera.world.maxX - camera.world.minX) * camera.scale;
  const height = (camera.world.maxY - camera.world.minY) * camera.scale;

  if (width * height * ratio * ratio > MAX_LAYER_PIXELS) return null;

  const canvas = createCanvas(Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio)));

  if (!canvas) return null;

  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawWorld({ ...frame, ctx, camera: layerCamera(camera) });

  const entry = { canvas, width, height };

  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }

  cache.set(key, entry);
  return entry;
}

/**
 * Copia la capa estática al lienzo principal en la posición de la cámara.
 * @param {import("./index.js").Frame} frame
 * @param {{canvas: any, width: number, height: number}} layer
 */
export function blitWorldLayer({ ctx, camera }, layer) {
  ctx.drawImage(
    layer.canvas,
    0,
    0,
    layer.canvas.width,
    layer.canvas.height,
    camera.toX(camera.world.minX),
    camera.toY(camera.world.maxY),
    layer.width,
    layer.height
  );
}
