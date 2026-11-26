import { runSimulation } from "../physics/index.js";
import { sampleHistory } from "../lib/sampling.ts";

/**
 * Auditoría en segundo plano: simula el recorrido completo de una
 * configuración y devuelve el dictamen con el historial submuestreado,
 * sin bloquear la interfaz mientras se arrastra un control.
 */
self.onmessage = event => {
  const { id, config } = event.data;

  try {
    const run = runSimulation(config);

    self.postMessage({
      id,
      ok: true,
      verdict: run.verdict,
      final: run.final,
      history: sampleHistory(run.history)
    });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo auditar el diseño."
    });
  }
};
