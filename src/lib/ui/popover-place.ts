/** Alto máximo de una lista desplegable (px). */
export const LIST_MAX_HEIGHT_PX = 280;
/** Separación entre el disparador y la lista (px). */
const GAP_PX = 4;

export interface PopoverPlace {
  top: number;
  left: number;
  minWidth: number;
  /** La lista abre hacia arriba (su borde inferior queda en `top`). */
  flip: boolean;
}

/** Dónde abrir una lista bajo su disparador; hacia arriba si abajo no entra y arriba sí. */
export function placeBelow(rect: Pick<DOMRect, "top" | "bottom" | "left" | "width">, viewportHeight: number): PopoverPlace {
  const flip = rect.bottom + LIST_MAX_HEIGHT_PX > viewportHeight && rect.top > LIST_MAX_HEIGHT_PX;
  return { top: flip ? rect.top - GAP_PX : rect.bottom + GAP_PX, left: rect.left, minWidth: rect.width, flip };
}
