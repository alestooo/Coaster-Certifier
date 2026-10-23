export type MapId = "slope" | "valley" | "loop" | "reference" | "custom" | "incline";

export type MapDefinition = {
  id: MapId;
  name: string;
  description: string;
  tag: string;
  available: boolean;
};

export const MAPS: MapDefinition[] = [
  {
    id: "reference",
    name: "Certificación",
    description: "Caída, loop en lágrima, colina y frenado: el trazado completo del anexo.",
    tag: "Puntos críticos A–F",
    available: true
  },
  {
    id: "loop",
    name: "Loop",
    description: "Caída y loop con altura y radio en la cima ajustables.",
    tag: "Contacto en C y carga en B",
    available: true
  },
  {
    id: "valley",
    name: "Valle y colina",
    description: "Bajá, superá una colina con cresta de radio conocido y frená.",
    tag: "Carga mínima en D",
    available: true
  },
  {
    id: "slope",
    name: "Línea",
    description: "Bajada suave con llegada a la estación.",
    tag: "Frenado E → F",
    available: true
  },
  {
    id: "incline",
    name: "Plano inclinado",
    description: "Rampa recta: el caso con solución exacta usado para validar el motor.",
    tag: "Validación analítica",
    available: true
  },
  {
    id: "custom",
    name: "Personalizado",
    description: "Mové puntos, creá valles y agregá hasta tres loops.",
    tag: "Hasta 3 loops y 9 puntos",
    available: true
  }
];

export function mapName(id: string): string {
  return MAPS.find(map => map.id === id)?.name ?? id;
}
