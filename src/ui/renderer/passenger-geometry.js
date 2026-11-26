/**
 * Geometría del pasajero sentado, en unidades de diseño del carrito
 * (30 por metro, y hacia abajo, origen en el riel). Proporciones reales:
 * cabeza de 0,23 m, hombros de 0,42 m, 0,9 m del asiento a la coronilla y
 * la coronilla a 1,4 m sobre la vía.
 */
export const HEAD = Object.freeze({ x: 0, y: -38.5, radius: 3.45 });
export const SHOULDER = Object.freeze({ y: -33.5, halfWidth: 6.3 });
export const TORSO = Object.freeze({ top: -34.5, bottom: -15, halfWidth: 6.3 });

/**
 * Cabeza con la que está dibujado el arte (cara, pelo, accesorios). Se
 * dibuja escalado hasta HEAD, así el detalle no depende del tamaño real.
 */
export const ART_HEAD = Object.freeze({ x: 0, y: -52, radius: 8.5 });
