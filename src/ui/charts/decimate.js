/**
 * Reducción uniforme de historiales largos para graficarlos sin
 * perder el primer estado, el último ni los estados terminales.
 */

/** Cantidad máxima de puntos por defecto. */
export const DEFAULT_MAX_POINTS = 1500;

/**
 * @template {{status: string}} T
 * @param {ReadonlyArray<T>} history Estados consecutivos.
 * @param {number} [maxPoints]
 * @returns {T[]} Nuevo arreglo con a lo sumo `maxPoints` elementos (más los terminales).
 */
export function decimateHistory(history, maxPoints = DEFAULT_MAX_POINTS) {
  const limit = Math.max(2, Math.floor(maxPoints));

  if (history.length <= limit) {
    return [...history];
  }

  const stride = (history.length - 1) / (limit - 1);
  const kept = new Set();

  for (let index = 0; index < limit; index++) {
    kept.add(Math.round(index * stride));
  }

  kept.add(history.length - 1);

  history.forEach((state, index) => {
    if (state.status !== "running") {
      kept.add(index);
    }
  });

  return [...kept].sort((first, second) => first - second).map(index => history[index]);
}
