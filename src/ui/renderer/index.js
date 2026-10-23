/**
 * Renderizador de la simulación sobre Canvas 2D.
 *
 * Solo dibuja: todas las magnitudes provienen del estado y del trazado
 * calculados por la librería de física. No contiene ecuaciones.
 *
 * Capas, de atrás hacia adelante:
 *  1. cielo, sol, nubes y colinas lejanas (dinámicas, con paralaje);
 *  2. suelo;
 *  3. mundo estático (utilería, subida por cadena, estación, soportes,
 *     vía, frenos, puntos críticos), cacheado fuera de pantalla;
 *  4. cadena en movimiento, estela, resorte, incumplimiento, tren,
 *     fuerzas y lecturas.
 */
import { prepareCanvas, createCamera } from "./camera.js";
import { drawSkyAndDistant, drawGroundFill, drawWorldScenery } from "./scenery.js";
import { drawStation, drawChainLift, drawChainLinks } from "./station.js";
import {
  drawSectionBands,
  drawSupports,
  drawTrack,
  drawBrakeHardware,
  drawSpring,
  drawMarkers,
  drawEventMarker
} from "./track.js";
import { drawTrail } from "./trail.js";
import { drawTrain } from "./train.js";
import { drawForces, drawGauge, drawReadings } from "./hud.js";
import { getWorldLayer, blitWorldLayer } from "./layers.js";

/**
 * @typedef {Object} RenderOptions
 * @property {boolean} showMarkers Insignias A–F sobre los puntos críticos.
 * @property {boolean} showTrail Estela coloreada por rapidez.
 * @property {boolean} showForces Flechas de fuerzas sobre el tren.
 * @property {boolean} showSections Resplandor y nombres de los tramos.
 * @property {boolean} showGauge Indicador semicircular de carga dentro del lienzo.
 * @property {boolean} showScenery Utilería del parque (árboles, cerca, feria).
 * @property {boolean} showReadings Panel de lecturas numéricas.
 */

/**
 * @typedef {Object} Scene
 * @property {any} state Estado de la simulación (ver makeState en la librería).
 * @property {any} config Configuración resuelta.
 * @property {any} track Trazado construido con buildTrack.
 * @property {ReadonlyArray<any>} [passengers] Pasajeros del tren.
 * @property {ReadonlyArray<any>} [history] Historial de estados.
 * @property {{mode?: "full" | "follow", zoom?: number}} [camera]
 * @property {Partial<RenderOptions>} [options]
 */

/**
 * @typedef {Object} Frame
 * @property {CanvasRenderingContext2D} ctx
 * @property {import("./camera.js").Camera} camera
 * @property {Scene} scene
 * @property {RenderOptions} options
 */

/** @type {Readonly<RenderOptions>} */
export const RENDER_DEFAULT_OPTIONS = Object.freeze({
  showMarkers: true,
  showTrail: true,
  showForces: false,
  showSections: true,
  showGauge: false,
  showScenery: true,
  showReadings: true
});

/**
 * Capa estática del mundo, en coordenadas de la cámara recibida.
 * @param {Frame} frame
 */
function drawWorld(frame) {
  if (frame.options.showScenery) drawWorldScenery(frame);

  drawChainLift(frame);
  drawStation(frame);
  drawSupports(frame);

  if (frame.options.showSections) drawSectionBands(frame);

  drawTrack(frame);
  drawBrakeHardware(frame);

  if (frame.options.showMarkers) drawMarkers(frame);
}

/**
 * Dibuja un cuadro completo de la simulación.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Scene} scene
 */
export function renderSimulation(canvas, scene) {
  const prepared = prepareCanvas(canvas);

  if (!prepared) return;

  const options = { ...RENDER_DEFAULT_OPTIONS, ...(scene.options ?? {}) };
  const camera = createCamera(prepared.width, prepared.height, scene);

  /** @type {Frame} */
  const frame = { ctx: prepared.ctx, camera, scene, options };

  drawSkyAndDistant(frame);
  drawGroundFill(frame);

  const layer = getWorldLayer(frame, prepared.ratio, drawWorld);

  if (layer) {
    blitWorldLayer(frame, layer);
  } else {
    drawWorld(frame);
  }

  drawChainLinks(frame);

  if (options.showTrail) drawTrail(frame);
  if (scene.config.brakeMode === "spring") drawSpring(frame);

  drawEventMarker(frame);
  drawTrain(frame);

  if (options.showForces) drawForces(frame);
  if (options.showGauge) drawGauge(frame);
  if (options.showReadings) drawReadings(frame);
}

export { MIN_ZOOM, MAX_ZOOM, CART_LENGTH_M, MIN_TRAIN_PX } from "./camera.js";
