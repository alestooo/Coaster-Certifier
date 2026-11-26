/** Intervalo entre muestras guardadas en el historial de la interfaz (s). */
export const SAMPLE_INTERVAL = 0.02;

interface TimedState {
  time: number;
}

/**
 * Submuestrea un historial cada `interval` segundos, conservando siempre
 * el primer y el último estado. Devuelve un arreglo nuevo.
 */
export function sampleHistory<T extends TimedState>(history: readonly T[], interval = SAMPLE_INTERVAL): T[] {
  if (history.length <= 2) return [...history];

  const sampled: T[] = [history[0]];
  let last = history[0].time;

  for (let index = 1; index < history.length - 1; index++) {
    const state = history[index];

    if (state.time - last >= interval - 1e-9) {
      sampled.push(state);
      last = state.time;
    }
  }

  sampled.push(history[history.length - 1]);
  return sampled;
}
