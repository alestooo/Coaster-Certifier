import type { ConfigInput } from "../lib/types";

export type MapId = "slope" | "valley" | "loop" | "reference" | "custom" | "incline";

export type MapDefinition = {
  id: MapId;
  name: string;
  description: string;
  tag: string;
  available: boolean;
  /** Diseño que carga el trazado; la miniatura a escala muestra exactamente esto. */
  template: ConfigInput;
};

export const MAPS: MapDefinition[] = [
  {
    id: "reference",
    name: "Trazado del anexo",
    description: "Caída, loop en lágrima, colina y frenado: el trazado completo que define el proyecto.",
    tag: "Todos los puntos críticos, de A a F",
    available: true,
    // Valores del anexo (los del escenario de certificación).
    template: {
      mapId: "reference",
      initialHeight: 30,
      initialSpeed: 2,
      trackWidth: 320,
      loopHeight: 21.5,
      loopTopRadius: 5,
      hillHeight: 10,
      hillCrestRadius: 55,
      friction: 0.01,
      brakeMode: "station",
      brakeDeceleration: 6,
      brakingLength: 60
    }
  },
  {
    id: "loop",
    name: "Loop",
    description: "Caída y loop con altura y radio en la cima ajustables.",
    tag: "¿Se despega en la cima? ¿Cuánta fuerza g en la base?",
    available: true,
    template: { mapId: "loop", initialHeight: 30, trackWidth: 240, loopHeight: 21.5, loopTopRadius: 5, brakingLength: 90 }
  },
  {
    id: "valley",
    name: "Valle y colina",
    description: "Bajá, superá una colina con cresta de radio conocido y frená.",
    tag: "¿Flotan los pasajeros sobre la cresta?",
    available: true,
    template: { mapId: "valley", initialHeight: 25, trackWidth: 260, hillHeight: 10, hillCrestRadius: 60, brakingLength: 80 }
  },
  {
    id: "slope",
    name: "Bajada simple",
    description: "Bajada suave hasta la recta final de frenado.",
    tag: "¿Alcanza la zona de frenado?",
    available: true,
    template: { mapId: "slope", initialHeight: 20, trackWidth: 220, brakingLength: 80 }
  },
  {
    id: "incline",
    name: "Plano inclinado",
    description: "Rampa recta: el caso con solución exacta usado para validar el motor.",
    tag: "Caso con solución exacta",
    available: true,
    template: { mapId: "incline", initialHeight: 20, trackWidth: 60, brakingLength: 60 }
  },
  {
    id: "custom",
    name: "Personalizado",
    description: "Mové puntos, creá valles y agregá hasta tres loops.",
    tag: "Hasta 3 loops y 9 puntos",
    available: true,
    // El diseño inicial editable (puntos por defecto de la librería): la miniatura muestra lo que se carga.
    template: { mapId: "custom" }
  }
];

/** Diseño que carga un trazado (sin el mapId de otro). */
export function mapTemplate(id: MapId): ConfigInput {
  return MAPS.find(map => map.id === id)?.template ?? { mapId: id };
}

export function mapName(id: string): string {
  return MAPS.find(map => map.id === id)?.name ?? id;
}
