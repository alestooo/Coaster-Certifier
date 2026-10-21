export type PresetId =
  | "line"
  | "valley"
  | "loop"
  | "custom"
  | "spring";

export const SCENARIOS: {
  id: PresetId;
  title: string;
  description: string;
  values: string;
}[] = [
  {
    id: "line",
    title: "Línea: llegar a la estación",

    description:
      "Baja y se detiene con los frenos de estación.",

    values:
      "H 20 m · ancho 220 m · μ 0 · frenos 5 m/s² · zona 80 m"
  },
  {
    id: "valley",
    title: "Valle: superar la colina",

    description:
      "Completa el valle y frena dentro de la estación.",

    values:
      "H 20 m · ancho 220 m · μ 0 · frenos 5 m/s² · zona 80 m"
  },
  {
    id: "loop",
    title: "Loop: completar la vuelta",

    description:
      "Modo exploración de 8 g. No cumple el límite de 5 g del proyecto.",

    values:
      "H 35 m · ancho 220 m · radio 12 m · μ 0 · zona 90 m"
  },
  {
    id: "custom",
    title: "Personalizado: tres loops",

    description:
      "Tres loops a nivel del suelo. Exploración de 8 g.",

    values:
      "H 35 m · ancho 300 m · radios 12 m · μ 0 · zona 90 m"
  },
  {
    id: "spring",
    title: "Resorte: observar el rebote",

    description:
      "Comprime el resorte y regresa; no se fuerza una parada permanente.",

    values:
      "H 20 m · ancho 220 m · μ 0,01 · k 6000 N/m · compresión máx. 8 m"
  }
];

export function presetValues(id: PresetId) {
  const base = {
    initialHeight: 20,
    trackLength: 220,
    friction: 0,
    loopRadius: 12,

    brakingLength: 80,
    springConstant: 6000,
    maxCompression: 8,

    maxLoad: 5,

    brakeDeceleration: 5,
    brakeMode: "station",

    mapId: "slope"
  };

  if (id === "valley") {
    return {
      ...base,
      mapId: "valley"
    };
  }

  if (id === "loop") {
    return {
      ...base,
      mapId: "loop",
      initialHeight: 35,
      brakingLength: 90,
      maxLoad: 8
    };
  }

  if (id === "custom") {
    return {
      ...base,
      mapId: "custom",
      initialHeight: 35,
      trackLength: 300,
      brakingLength: 90,
      maxLoad: 8,

      customPoints: [
        { x: 0, y: 1, loopRadius: 0 },
        { x: 0.25, y: 0, loopRadius: 12 },
        { x: 0.5, y: 0, loopRadius: 12 },
        { x: 0.75, y: 0, loopRadius: 12 },
        { x: 1, y: 0, loopRadius: 0 }
      ]
    };
  }

  if (id === "spring") {
    return {
      ...base,
      brakeMode: "spring",
      friction: 0.01
    };
  }

  return base;
}