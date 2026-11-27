/**
 * Subida por cadena hasta A. No forma parte del recorrido evaluado (t = 0
 * sigue en A): aporta su largo, su tiempo y la energía y la potencia del motor.
 */

/**
 * @typedef {Object} LiftMetrics
 * @property {number} length Largo de la rampa del suelo a A: H / sin α (m).
 * @property {number} time Tiempo de subida a la rapidez de la cadena (s).
 * @property {number} power Potencia del motor (W).
 * @property {number} energy Energía del motor en toda la subida (J).
 */

/**
 * Métricas de la subida, o null si el trazado no tiene. La cadena arrastra
 * al tren a rapidez constante v_c contra el peso, la rodadura y el aire:
 * P = (m·g·sin α + μ·m·g·cos α + ½·ρ·C_dA·v_c²)·v_c / η.
 * @param {import("../config.js").SimulationConfig} config
 * @returns {LiftMetrics | null}
 */
export function liftMetrics(config) {
  const start = config.track?.[0];
  const lift = start?.type === "start" ? start.lift : undefined;
  if (!lift) return null;

  const { angle, efficiency, chainSpeed } = lift;
  const weight = config.mass * config.gravity;
  const air = 0.5 * config.airDensity * config.airDragArea * chainSpeed * chainSpeed;
  const length = config.initialHeight / Math.sin(angle);
  const time = length / chainSpeed;
  const power = ((weight * Math.sin(angle) + config.friction * weight * Math.cos(angle) + air) * chainSpeed) / efficiency;

  return { length, time, power, energy: power * time };
}
