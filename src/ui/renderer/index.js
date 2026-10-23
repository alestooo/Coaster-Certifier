/**
 * Renderizador de la simulación sobre Canvas 2D.
 *
 * Solo dibuja: todas las magnitudes provienen del estado y del trazado
 * calculados por la librería de física. No contiene ecuaciones.
 */
import { prepareCanvas, createCamera } from "./camera.js";
import { drawSky, drawGround, drawStation, drawChainLift, drawSupports } from "./scene.js";
import {
  drawSectionBands,
  drawTrack,
  drawBrakeZone,
  drawSpring,
  drawMarkers,
  drawEventMarker
} from "./trackLayer.js";
import { drawTrail } from "./trail.js";
import { drawTrain } from "./train.js";
import { drawForces, drawGauge, drawHudText } from "./hud.js";

/**
 * @typedef {Object} RenderOptions
 * @property {boolean} showMarkers Insignias A–F sobre los puntos críticos.
 * @property {boolean} showTrail Estela coloreada por rapidez.
 * @property {boolean} showForces Flechas de fuerzas sobre el tren.
 * @property {boolean} showSections Bandas y nombres de los tramos.
 * @property {boolean} showGauge Indicador de carga y lecturas numéricas.
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
  showGauge: true
});

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

  drawSky(frame);
  drawGround(frame);
  drawStation(frame);
  drawChainLift(frame);
  drawSupports(frame);

  if (options.showSections) drawSectionBands(frame);

  drawTrack(frame);

  if (scene.config.brakeMode === "spring") {
    drawSpring(frame);
  } else {
    drawBrakeZone(frame);
  }

  if (options.showMarkers) drawMarkers(frame);
  if (options.showTrail) drawTrail(frame);

  drawEventMarker(frame);
  drawTrain(frame);

  if (options.showForces) drawForces(frame);

  if (options.showGauge) {
    drawGauge(frame);
    drawHudText(frame);
  }
}

export { MIN_ZOOM, MAX_ZOOM } from "./camera.js";
