import type { ConfigInput } from "../lib/types";

export type MapId = "slope" | "valley" | "loop" | "reference" | "custom" | "incline";

export type MapDefinition = {
  id: MapId;
  name: string;
  description: string;
  tag: string;
  available: boolean;
  /** Configuración usada para la miniatura a escala. */
  preview: ConfigInput;
};

export const MAPS: MapDefinition[] = [
  {
    id: "reference",
    name: "Certificación",
    description: "Caída, loop en lágrima, colina y frenado: el trazado completo del anexo.",
    tag: "Puntos críticos A–F",
    available: true,
    preview: { mapId: "reference", initialHeight: 30, trackWidth: 320, loopHeight: 21.5, loopTopRadius: 5, hillHeight: 10, hillCrestRadius: 55, brakingLength: 60 }
  },
  {
    id: "loop",
    name: "Loop",
    description: "Caída y loop con altura y radio en la cima ajustables.",
    tag: "Contacto en C y carga en B",
    available: true,
    preview: { mapId: "loop", initialHeight: 30, trackWidth: 240, loopHeight: 21.5, loopTopRadius: 5, brakingLength: 90 }
  },
  {
    id: "valley",
    name: "Valle y colina",
    description: "Bajá, superá una colina con cresta de radio conocido y frená.",
    tag: "Carga mínima en D",
    available: true,
    preview: { mapId: "valley", initialHeight: 25, trackWidth: 260, hillHeight: 10, hillCrestRadius: 60, brakingLength: 80 }
  },
  {
    id: "slope",
    name: "Línea",
    description: "Bajada suave con llegada a la estación.",
    tag: "Frenado E → F",
    available: true,
    preview: { mapId: "slope", initialHeight: 20, trackWidth: 220, brakingLength: 80 }
  },
  {
    id: "incline",
    name: "Plano inclinado",
    description: "Rampa recta: el caso con solución exacta usado para validar el motor.",
    tag: "Validación analítica",
    available: true,
    preview: { mapId: "incline", initialHeight: 20, trackWidth: 60, brakingLength: 60 }
  },
  {
    id: "custom",
    name: "Personalizado",
    description: "Mové puntos, creá valles y agregá hasta tres loops.",
    tag: "Hasta 3 loops y 9 puntos",
    available: true,
    preview: {
      mapId: "custom",
      initialHeight: 35,
      trackWidth: 300,
      brakingLength: 90,
      customPoints: [
        { x: 0, y: 1, loopHeight: 0, loopTopRadius: 0 },
        { x: 0.25, y: 0, loopHeight: 24, loopTopRadius: 4 },
        { x: 0.5, y: 0, loopHeight: 24, loopTopRadius: 4 },
        { x: 0.75, y: 0, loopHeight: 24, loopTopRadius: 4 },
        { x: 1, y: 0, loopHeight: 0, loopTopRadius: 0 }
      ]
    }
  }
];

export function mapName(id: string): string {
  return MAPS.find(map => map.id === id)?.name ?? id;
}
