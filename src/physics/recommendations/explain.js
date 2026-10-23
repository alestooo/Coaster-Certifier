import { buildTrack } from "../track/builder.js";
import { CRITERIA } from "../evaluation/criteria.js";

/**
 * Explicación en lenguaje natural de por qué un recorrido no aprobó.
 *
 * @param {any} state Estado final de la simulación.
 * @param {Partial<import("../config.js").SimulationConfig>} config
 */
export function explainFailure(state, config) {
  const event = state.events?.at(-1);
  const title = event?.condition ?? "El recorrido no terminó";
  const inLoop = typeof state.section === "string" && state.section.startsWith("Loop");

  let explanation;

  switch (event?.code) {
    case CRITERIA.CONTACT:
    case CRITERIA.LOOP_CONTACT:
      explanation =
        "La fuerza normal requerida llegó a cero o se volvió negativa: la vía tendría que " +
        "tirar del tren para conservar el movimiento, algo que el contacto del modelo no permite." +
        (inLoop
          ? " En el loop falta rapidez para sostener el contacto en la parte alta (se exige v² > gR)."
          : " En una cresta ocurre por demasiada rapidez o una curva demasiado cerrada.");
      break;

    case CRITERIA.MAX_LOAD:
      explanation =
        "La carga n = N/(mg) superó el límite configurado. La combinación de rapidez y " +
        "curvatura exige una fuerza de contacto excesiva; ocurre en valles, en la base del loop " +
        "o al entrar a curvas cerradas con mucha rapidez.";
      break;

    case CRITERIA.MIN_LOAD:
      explanation =
        "La carga bajó del mínimo permitido: en la cresta el tren se vuelve demasiado liviano " +
        "(airtime excesivo). Aumentá el radio de la cresta o reducí la rapidez con que llega.";
      break;

    case CRITERIA.COMPRESSION:
      explanation =
        "La energía con la que el tren llega al resorte exige más compresión que la permitida. " +
        "Influyen la altura, las pérdidas, la masa y la rigidez del resorte.";
      break;

    case CRITERIA.OVERRUN:
      explanation =
        "El tren alcanzó el final de la zona de frenado antes de detenerse. Necesita más " +
        "distancia o un frenado mayor; no se elimina su velocidad artificialmente.";
      break;

    case CRITERIA.MIN_SPEED:
      explanation =
        "La rapidez en subida cayó por debajo del umbral de detención: la energía disponible " +
        "no basta para superar la pendiente con las pérdidas acumuladas.";
      break;

    case CRITERIA.TIMEOUT:
      explanation =
        "Terminó el tiempo de observación sin una llegada detenida. Con resorte ideal el tren " +
        "sigue rebotando: almacenar energía no equivale a disiparla.";
      break;

    default:
      explanation =
        state.status === "stalled"
          ? "El tren quedó detenido antes de entrar en la estación: la energía disponible no " +
            "bastó para completar el recorrido con las pérdidas por fricción."
          : "El estado calculado no cumple las condiciones de finalización.";
  }

  return {
    title,
    explanation,
    event,
    totalLength: buildTrack(config).totalLength
  };
}
