import { resolveConfig } from "./config.js";
import { getTrackInfo } from "./geometry.js";

import {
  createInitialState,
  step
} from "./simulation.js";

const fields = {
  initialHeight: ["Altura inicial", "m"],
  trackLength: ["Ancho del trazado", "m"],
  friction: ["Coeficiente de fricción", ""],
  loopRadius: ["Radio de referencia del loop", "m"],
  brakingLength: ["Zona de frenado", "m"],
  brakeDeceleration: ["Desaceleración del freno", "m/s²"],
  springConstant: ["Rigidez del resorte", "N/m"],
  maxCompression: ["Compresión máxima", "m"]
};

export function explainFailure(state, config) {
  const event = state.events?.at(-1);

  const title =
    event?.condition ?? "El recorrido no terminó";

  let explanation = "";

  if (state.status === "lost-contact") {
    explanation =
      "La fuerza normal requerida llegó a cero o se volvió negativa. " +
      "La vía tendría que tirar del tren para conservar este movimiento, " +
      "algo que el contacto unilateral del modelo no permite.";

    explanation += state.section.startsWith("Loop")
      ? " En el loop puede faltar rapidez para sostener el contacto en la parte alta."
      : " En una cresta puede ocurrir por demasiada rapidez o una curva demasiado cerrada.";
  } else if (event?.condition === "Carga normal excesiva") {
    explanation =
      "La carga normal N/(mg) superó el límite configurado. " +
      "La combinación de rapidez y curvatura exige una fuerza de contacto excesiva. " +
      "Una mayor rapidez o una curva demasiado cerrada puede aumentar esta carga.";
  } else if (event?.condition === "Compresión excesiva") {
    explanation =
      "La energía con la que el tren llega al resorte exige más compresión que la permitida. " +
      "Influyen la altura, las pérdidas, la masa y la rigidez del resorte.";
  } else if (event?.condition === "Fin del espacio disponible") {
    explanation =
      "El tren alcanzó el final de la zona de frenado antes de quedar detenido. " +
      "Necesita más distancia o un frenado suficiente; no se elimina su velocidad artificialmente.";
  } else if (state.status === "stalled") {
    explanation =
      "El tren quedó detenido antes de entrar en la zona final. " +
      "La energía disponible no bastó para superar el recorrido y las pérdidas por fricción.";
  } else if (state.status === "timeout") {
    explanation =
      "Terminó el tiempo de observación sin una llegada detenida. " +
      "Con resorte puede seguir rebotando: almacenar energía no equivale a disiparla.";
  } else {
    explanation =
      "El estado calculado no cumple las condiciones de finalización. " +
      "Se revisará la configuración completa antes de sugerir cambios.";
  }

  // Ya no se aplica la incompatibilidad del círculo:
  // geometry.js ahora utiliza curvatura variable.
  return {
    title,
    explanation,
    event,
    impossible: false,
    note: "",
    totalLength: getTrackInfo(config).totalLength
  };
}

function changesBetween(original, next) {
  const changes = Object.entries(fields)
    .filter(([key]) => original[key] !== next[key])
    .map(([key, [label, unit]]) => ({
      key,
      label,
      unit,
      before: original[key],
      after: next[key]
    }));

  if (
    JSON.stringify(original.customPoints) !==
    JSON.stringify(next.customPoints)
  ) {
    let heightsChanged = false;

    next.customPoints.forEach((point, index) => {
      const before = original.customPoints[index];

      if (!before) {
        heightsChanged = true;
        return;
      }

      if (before.loopRadius !== point.loopRadius) {
        changes.push({
          key: "loopRadius",

          label:
            `Radio de referencia del loop del punto ${index + 1}`,

          unit: "m",
          before: before.loopRadius,
          after: point.loopRadius
        });
      }

      if (
        before.x !== point.x ||
        before.y !== point.y
      ) {
        heightsChanged = true;
      }
    });

    if (heightsChanged) {
      changes.push({
        key: "customPoints",
        label: "Alturas interiores",
        unit: "",
        before: null,
        after: null
      });
    }
  }

  return changes;
}

function candidateList(original) {
  const candidates = new Map();

  function add(patch) {
    const candidate = {
      ...original,
      ...patch
    };

    if (
      candidate.initialHeight < 0.1 ||
      candidate.initialHeight > 80 ||
      candidate.trackLength < 1 ||
      candidate.trackLength > 500 ||
      candidate.friction < 0 ||
      candidate.friction > 0.2 ||
      candidate.loopRadius < 1 ||
      candidate.loopRadius > 30 ||
      candidate.brakingLength < 1 ||
      candidate.brakingLength > 100 ||
      candidate.brakeDeceleration < 0.1 ||
      candidate.brakeDeceleration > 9.81 ||
      candidate.springConstant < 100 ||
      candidate.springConstant > 100000 ||
      candidate.maxCompression < 0.1 ||
      candidate.maxCompression > 50
    ) {
      return;
    }

    try {
      resolveConfig(candidate);
      getTrackInfo(candidate);
    } catch {
      return;
    }

    const changes = changesBetween(
      original,
      candidate
    );

    if (!changes.length) return;

    let score = 0;

    for (const change of changes) {
      if (change.key === "customPoints") {
        score += 0.2;
      } else {
        score +=
          Math.abs(change.after - change.before) /
          Math.max(
            Math.abs(change.before),
            change.key === "friction" ? 0.05 : 1
          );
      }
    }

    candidates.set(
      JSON.stringify(candidate),
      {
        config: candidate,
        changes,
        score
      }
    );
  }

  const factors = [
    0.95, 1.05,
    0.9, 1.1,
    0.85, 1.15,
    0.75, 1.25,
    0.6, 1.4
  ];

  for (const factor of factors) {
    add({
      initialHeight: Number(
        (original.initialHeight * factor).toFixed(3)
      )
    });

    add({
      trackLength: Number(
        (original.trackLength * factor).toFixed(3)
      )
    });

    if (original.mapId === "loop") {
      add({
        loopRadius: Number(
          (original.loopRadius * factor).toFixed(3)
        )
      });
    }

    if (original.brakeMode === "station") {
      add({
        brakingLength: Number(
          (original.brakingLength * factor).toFixed(3)
        )
      });

      add({
        brakeDeceleration: Number(
          (original.brakeDeceleration * factor).toFixed(3)
        )
      });
    } else {
      add({
        springConstant: Number(
          (original.springConstant * factor).toFixed(3)
        )
      });

      add({
        maxCompression: Number(
          (original.maxCompression * factor).toFixed(3)
        )
      });
    }
  }

  for (const delta of [
    -0.02,
    -0.01,
    -0.005,
    0.005,
    0.01,
    0.02
  ]) {
    add({
      friction: Number(
        (original.friction + delta).toFixed(4)
      )
    });
  }

  for (const factor of [1.1, 1.2, 1.4]) {
    add({
      trackLength:
        original.trackLength * factor,

      initialHeight:
        original.initialHeight * 0.9
    });

    add({
      trackLength:
        original.trackLength * factor,

      friction:
        original.friction * 0.5
    });

    if (original.mapId === "custom") {
      add({
        trackLength:
          original.trackLength * factor,

        customPoints: original.customPoints.map(
          (point, index) =>
            index === 0 ||
            index === original.customPoints.length - 1
              ? { ...point }
              : {
                  ...point,
                  y: point.y * 0.85
                }
        )
      });
    }
  }

  // Combinar altura y tamaño del loop.
  if (original.mapId === "loop") {
    for (const heightFactor of [0.9, 0.95, 1.05, 1.1]) {
      for (const radiusFactor of [0.9, 1.05, 1.1, 1.2]) {
        add({
          initialHeight:
            original.initialHeight * heightFactor,

          loopRadius:
            original.loopRadius * radiusFactor
        });
      }
    }
  }

  // Ajustar los loops de la pista personalizada.
  if (original.mapId === "custom") {
    for (const factor of [0.85, 0.95, 1.05, 1.15, 1.3]) {
      add({
        customPoints: original.customPoints.map(point => ({
          ...point,

          loopRadius: point.loopRadius
            ? Number(
                (point.loopRadius * factor).toFixed(3)
              )
            : 0
        }))
      });
    }
  }

  // Ampliar la búsqueda si los cambios pequeños no bastan.
  for (const factor of [1.6, 2, 2.5]) {
    add({
      trackLength:
        original.trackLength * factor
    });
  }

  for (const factor of [0.5, 0.35]) {
    add({
      initialHeight:
        original.initialHeight * factor
    });
  }

  for (const [heightScale, widthScale] of [
    [0.75, 1.5],
    [0.6, 2],
    [0.5, 2.5]
  ]) {
    add({
      initialHeight:
        original.initialHeight * heightScale,

      trackLength:
        original.trackLength * widthScale
    });
  }

  return [...candidates.values()].sort(
    (first, second) =>
      first.score - second.score
  );
}

export function* recommendationSearch(input, failedState) {
  const config = resolveConfig(input);

  const found = [];
  const strategies = new Set();
  const candidates = candidateList(config);

  let tested = 0;

  // Búsqueda finita: puede encontrar menos de tres opciones.
  for (const candidate of candidates.slice(0, 72)) {
    const strategy = candidate.changes
      .map(change => change.key)
      .sort()
      .join("|");

    if (strategies.has(strategy)) {
      continue;
    }

    let state = createInitialState(
      candidate.config
    );

    let maxLoad = state.load;
    let minLoad = state.load;

    let maxCompression = 0;
    let maxError = 0;

    const iterations =
      Math.ceil(candidate.config.maxTime / 0.02) + 2;

    for (
      let index = 0;
      index < iterations && state.status === "running";
      index++
    ) {
      state = step(
        state,
        candidate.config,
        0.02
      );

      maxLoad = Math.max(
        maxLoad,
        state.load
      );

      minLoad = Math.min(
        minLoad,
        state.load
      );

      maxCompression = Math.max(
        maxCompression,
        state.springCompression
      );

      maxError = Math.max(
        maxError,
        Math.abs(state.energies.balanceError)
      );
    }

    tested++;

    const stoppedAtEnd =
      state.status === "finished" ||
      (
        state.status === "stopped" &&
        state.distance >=
          getTrackInfo(candidate.config).springStart
      );

    const initialEnergy =
      candidate.config.mass *
      candidate.config.gravity *
      candidate.config.initialHeight;

    // Margen de 0,02 g para evitar recomendar
    // una configuración pegada al límite numérico.
    const valid =
      stoppedAtEnd &&
      state.events.length === 0 &&
      maxError / initialEnergy < 0.01 &&
      maxLoad <= candidate.config.maxLoad - 0.02 &&
      minLoad > 0.02;

    if (valid) {
      strategies.add(strategy);

      found.push({
        ...candidate,
        time: state.time,
        maxLoad,
        maxCompression
      });
    }

    yield {
      tested,
      total: Math.min(candidates.length, 72),
      found: found.length
    };

    if (found.length === 3) {
      break;
    }
  }

  return {
    recommendations: found,
    tested,

    reason:
      found.length === 3
        ? ""
        : `La búsqueda comprobó ${tested} configuraciones y encontró ` +
          `${found.length} estrategias que terminan sin los incumplimientos evaluados. ` +
          "No se ofrecen alternativas sin verificar."
  };
}