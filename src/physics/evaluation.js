export function evaluateState(
  state,
  config,
  track
) {
  function createEvent(
    condition,
    value,
    limit,
    unit
  ) {
    return {
      condition,
      time: state.time,
      section: state.section,
      position: state.distance,
      value,
      limit,
      unit
    };
  }

  if (state.forces.normal <= 0) {
    return {
      status: "lost-contact",

      event: createEvent(
        "Se requiere N > 0",
        state.forces.normal,
        0,
        "N"
      )
    };
  }

  if (state.load > config.maxLoad) {
    return {
      status: "rejected",

      event: createEvent(
        "Carga normal excesiva",
        state.load,
        config.maxLoad,
        "g"
      )
    };
  }

  if (
    state.springCompression >
    config.maxCompression
  ) {
    return {
      status: "rejected",

      event: createEvent(
        "Compresión excesiva",
        state.springCompression,
        config.maxCompression,
        "m"
      )
    };
  }

  if (state.distance >= track.totalLength) {
    return {
      status: "rejected",

      event: createEvent(
        "Fin del espacio disponible",
        state.distance,
        track.totalLength,
        "m"
      )
    };
  }

  if (state.distance < -1e-7) {
    return {
      status: "rejected",

      event: createEvent(
        "Retroceso fuera del recorrido",
        state.distance,
        0,
        "m"
      )
    };
  }

  if (state.time >= config.maxTime) {
    return {
      status: "timeout",

      event: createEvent(
        "Tiempo máximo de observación",
        state.time,
        config.maxTime,
        "s"
      )
    };
  }

  return null;
}