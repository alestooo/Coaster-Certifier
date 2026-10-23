/**
 * Constantes físicas y numéricas de la librería.
 *
 * Todas las magnitudes se expresan en unidades del Sistema Internacional.
 * Los límites del dictamen siguen el anexo del proyecto
 * «Certificador de montaña rusa».
 */

/** Aceleración de la gravedad de referencia (m/s²). */
export const GRAVITY = 9.81;

/** Desaceleración máxima tolerable de los frenos: 1 g (m/s²). */
export const MAX_BRAKE_DECELERATION = 9.81;

/** Límite superior de carga admisible para los pasajeros (g). */
export const DEFAULT_MAX_LOAD = 5;

/** Límite inferior de carga admisible (sensación de ingravidez) (g). */
export const DEFAULT_MIN_LOAD = -1;

/** Umbral de rapidez por debajo del cual el tren se considera detenido (m/s). */
export const DEFAULT_MIN_SPEED = 0.5;

/** Paso máximo del integrador RK4 (s). Coincide con el Δt propuesto en el anexo. */
export const DEFAULT_MAX_SUBSTEP = 0.001;

/** Rapidez por debajo de la cual se evalúa el equilibrio estático (m/s). */
export const REST_SPEED_EPSILON = 1e-10;

/** Aceleración por debajo de la cual el tren se considera en reposo (m/s²). */
export const REST_ACCELERATION_EPSILON = 1e-9;

/** Iteraciones de bisección para localizar un punto de retorno (v = 0). */
export const TURNING_POINT_ITERATIONS = 35;

/** Longitud del tramo horizontal de aproximación a la estación (m). */
export const APPROACH_LENGTH = 8;

/** Muestras de la tabla de longitud de arco por tramo curvo. */
export const ARC_LENGTH_SAMPLES = 400;

/** Resolución de la polilínea exportada para dibujar cada tramo. */
export const DRAW_DIVISIONS = Object.freeze({ curve: 100, loop: 240, line: 20, flat: 20 });
