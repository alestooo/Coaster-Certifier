/**
 * Matemática de los gestos de cámara del taller (rueda y pellizco).
 *
 * Una pose es el zoom relativo al encuadre ajustado y el centro visible en
 * metros. Todas las funciones son puras: no dependen del último cuadro
 * dibujado, así varios eventos entre dos cuadros no pierden pasos.
 */
import { MIN_VIEW_ZOOM, MAX_VIEW_ZOOM } from "../ui/renderer/camera.js";

export interface Pose {
  zoom: number;
  centerX: number;
  centerY: number;
}

export interface Viewport {
  width: number;
  height: number;
  /** Píxeles por metro del encuadre ajustado (zoom 1). */
  fitScale: number;
}

export interface PinchStart {
  pose: Pose;
  /** Distancia entre los dedos al empezar (px). */
  distance: number;
  /** Punto medio entre los dedos al empezar (px). */
  x: number;
  y: number;
}

/** Alto de una línea cuando la rueda informa en líneas (`deltaMode = 1`). */
export const LINE_HEIGHT_PX = 16;

/** Una muesca típica de rueda (100 px) acerca ×1,16; el trackpad, en proporción a lo que desplaza. */
const WHEEL_ZOOM_PER_PX = Math.log(1.16) / 100;

function clampZoom(zoom: number): number {
  return Math.min(MAX_VIEW_ZOOM, Math.max(MIN_VIEW_ZOOM, zoom));
}

function worldAt(pose: Pose, px: number, py: number, viewport: Viewport) {
  const scale = viewport.fitScale * pose.zoom;
  return { x: pose.centerX + (px - viewport.width / 2) / scale, y: pose.centerY - (py - viewport.height / 2) / scale };
}

/** Pose con zoom `zoom` que deja el punto del mundo `world` bajo el píxel (px, py). */
function anchoredPose(world: { x: number; y: number }, zoom: number, px: number, py: number, viewport: Viewport): Pose {
  const scale = viewport.fitScale * zoom;
  return { zoom, centerX: world.x - (px - viewport.width / 2) / scale, centerY: world.y + (py - viewport.height / 2) / scale };
}

/** Factor de zoom de un evento de rueda, proporcional a lo desplazado. */
export function wheelZoomFactor(deltaY: number, deltaMode: number, pageHeight: number): number {
  const pixels = deltaMode === 1 ? deltaY * LINE_HEIGHT_PX : deltaMode === 2 ? deltaY * pageHeight : deltaY;
  return Math.exp(-pixels * WHEEL_ZOOM_PER_PX);
}

/** Multiplica el zoom por `factor` conservando el punto bajo el cursor. */
export function zoomAround(pose: Pose, factor: number, px: number, py: number, viewport: Viewport): Pose {
  return anchoredPose(worldAt(pose, px, py, viewport), clampZoom(pose.zoom * factor), px, py, viewport);
}

/** Pose del pellizco actual calculada desde su inicio: el punto entre los dedos no se desliza. */
export function pinchPose(start: PinchStart, distance: number, x: number, y: number, viewport: Viewport): Pose {
  const anchor = worldAt(start.pose, start.x, start.y, viewport);
  return anchoredPose(anchor, clampZoom((start.pose.zoom * distance) / start.distance), x, y, viewport);
}
