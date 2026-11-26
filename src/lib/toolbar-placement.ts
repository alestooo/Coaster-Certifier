/**
 * Dónde va la mini barra del punto elegido del personalizado (px del lienzo).
 *
 * Centrada en el punto y sin salir por los costados. En orden de preferencia:
 * arriba de lo más alto (el punto o la cima de su loop); debajo del punto; y,
 * si tampoco entra ahí (loop alto con zoom), arriba del punto aunque tape el loop.
 * `y` es el ancla: la barra queda encima de ella o, con `below`, debajo.
 */
export interface ToolbarAnchor {
  x: number;
  pointY: number;
  /** Lo más alto del punto: su cima de loop, o el propio punto. */
  topY: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Margen con los bordes del lienzo y separación con el punto (px). */
export const EDGE_MARGIN_PX = 8;
export const TOOLBAR_GAP_PX = 18;

export function toolbarPlacement(anchor: ToolbarAnchor, toolbar: Size, canvas: Size): { x: number; y: number; below: boolean } {
  const half = toolbar.width / 2;
  const x = Math.min(canvas.width - half - EDGE_MARGIN_PX, Math.max(half + EDGE_MARGIN_PX, anchor.x));
  const fitsAbove = (y: number) => y - TOOLBAR_GAP_PX - toolbar.height >= EDGE_MARGIN_PX;
  const fitsBelow = (y: number) => y + TOOLBAR_GAP_PX + toolbar.height <= canvas.height - EDGE_MARGIN_PX;

  if (fitsAbove(anchor.topY)) return { x, y: anchor.topY, below: false };
  if (fitsBelow(anchor.pointY)) return { x, y: anchor.pointY, below: true };

  // Último recurso: arriba del punto, sin pasar del borde de arriba.
  const lowest = EDGE_MARGIN_PX + TOOLBAR_GAP_PX + toolbar.height;
  return { x, y: Math.max(anchor.pointY, lowest), below: false };
}
