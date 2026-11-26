/**
 * Dónde se dibujan las manijas de un loop del personalizado.
 *
 * A escala cuando hay lugar. Cuando el loop se ve chico (lejos, o en el
 * teléfono), la cima se aparta de su base y el radio de la cima, para que
 * ninguna manija tape a otra. Los arrastres se miden desde el inicio del
 * gesto, así que el corrimiento no hace saltar el valor.
 */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** Separación mínima en pantalla entre la base y la cima del loop (px). */
export const MIN_TOP_GAP_PX = 36;
/** Corrimiento mínimo de la manija del radio respecto de la cima, en cada eje (px). */
export const MIN_RADIUS_OFFSET_PX = 16;

/** `radiusPx` es R en píxeles; la manija del radio va abajo a la derecha de la cima, como el círculo osculador. */
export function loopHandleLayout(base: ScreenPoint, top: ScreenPoint, radiusPx: number): { top: ScreenPoint; radius: ScreenPoint } {
  const topY = Math.min(top.y, base.y - MIN_TOP_GAP_PX);
  const offset = Math.max(radiusPx, MIN_RADIUS_OFFSET_PX);

  return { top: { x: top.x, y: topY }, radius: { x: top.x + offset, y: topY + offset } };
}
