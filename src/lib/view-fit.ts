/**
 * Cuándo la cámara tiene que volver a encuadrar después de editar el
 * trazado: solo si lo nuevo ya no entra en la vista actual.
 */
import type { WorldBounds } from "./track-hit";

/** Lo que hace falta de la cámara: su tamaño y la proyección metros → píxeles. */
interface Projection {
  width: number;
  height: number;
  toX: (x: number) => number;
  toY: (y: number) => number;
}

/** Margen (px) que el trazado debe guardar con los bordes para no pedir un encuadre nuevo. */
export const REFRAME_MARGIN_PX = 8;

/** Verdadero si `bounds` (m) se sale de la vista, o queda a menos de `margin` px de un borde. */
export function needsReframe(bounds: WorldBounds, camera: Projection, margin = REFRAME_MARGIN_PX): boolean {
  const left = camera.toX(bounds.minX);
  const right = camera.toX(bounds.maxX);
  const top = camera.toY(bounds.maxY);
  const bottom = camera.toY(bounds.minY);

  return left < margin || right > camera.width - margin || top < margin || bottom > camera.height - margin;
}
