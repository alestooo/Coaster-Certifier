export const DEFAULT_CONFIG = Object.freeze({
  mass: 500,
  gravity: 9.81,
  initialHeight: 20,
  trackLength: 160,

  timeStep: 0.01,
  transitionRadius: 20,
  friction: 0.01,

  mapId: "slope",
  loopRadius: 6,

  brakingLength: 80,

  // station: frenos que disipan energía.
  // spring: resorte que puede producir rebote.
  brakeMode: "station",
  brakeDeceleration: 5,

  springConstant: 6000,
  maxCompression: 8,

  maxLoad: 5,
  maxTime: 120,

  customPoints: [
    { x: 0, y: 1, loopRadius: 0 },
    { x: 0.25, y: 0, loopRadius: 0 },
    { x: 0.5, y: 0.35, loopRadius: 0 },
    { x: 0.75, y: 0, loopRadius: 0 },
    { x: 1, y: 0, loopRadius: 0 }
  ]
});

export function resolveConfig(input = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    ...input
  };

  const positiveFields = [
    "mass",
    "gravity",
    "initialHeight",
    "trackLength",
    "timeStep",
    "transitionRadius",
    "loopRadius",
    "brakingLength",
    "springConstant",
    "maxCompression",
    "maxLoad",
    "maxTime",
    "brakeDeceleration"
  ];

  for (const key of positiveFields) {
    if (
      !Number.isFinite(config[key]) ||
      config[key] <= 0
    ) {
      throw new Error(
        `${key}: debe ser positivo y finito.`
      );
    }
  }

  if (
    !Number.isFinite(config.friction) ||
    config.friction < 0 ||
    config.friction > 1
  ) {
    throw new Error(
      "La fricción debe estar entre 0 y 1."
    );
  }

  if (!["spring", "station"].includes(config.brakeMode)) {
    throw new Error(
      "Modo de frenado inválido."
    );
  }

  if (
    !["slope", "valley", "loop", "custom"].includes(
      config.mapId
    )
  ) {
    throw new Error(
      "Recorrido no disponible."
    );
  }

  if (
    config.maxCompression >
    config.brakingLength
  ) {
    throw new Error(
      "La compresión máxima no puede superar la zona de frenado."
    );
  }

  if (config.mapId === "custom") {
    const points = config.customPoints;

    if (
      !Array.isArray(points) ||
      points.length < 3 ||
      points.length > 9
    ) {
      throw new Error(
        "Usá entre 3 y 9 puntos."
      );
    }

    if (
      points[0].x !== 0 ||
      points[0].y !== 1 ||
      points.at(-1).x !== 1 ||
      points.at(-1).y !== 0
    ) {
      throw new Error(
        "El inicio y el final tienen posiciones fijas."
      );
    }

    if (
      points.filter(point => point.loopRadius > 0).length > 3
    ) {
      throw new Error(
        "Se permiten hasta tres loops."
      );
    }

    points.forEach((point, index) => {
      if (
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.y < 0 ||
        point.y > 1 ||
        !Number.isFinite(point.loopRadius) ||
        point.loopRadius < 0 ||
        point.loopRadius > 15
      ) {
        throw new Error(
          "Punto o radio inválido."
        );
      }

      if (
        index > 0 &&
        point.x - points[index - 1].x < 0.05 - 1e-9
      ) {
        throw new Error(
          "Separá los puntos al menos un 5 % del ancho."
        );
      }

      if (
        (index === 0 || index === points.length - 1) &&
        point.loopRadius !== 0
      ) {
        throw new Error(
          "Los loops deben estar en puntos interiores."
        );
      }
    });
  }

  return config;
}