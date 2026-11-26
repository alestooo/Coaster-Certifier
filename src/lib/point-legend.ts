import type { Track } from "./types";

export interface PointLegendItem {
  letter: string;
  /** Qué marca la letra. */
  name: string;
  /** Si el trazado la tiene. */
  present: boolean;
  /** Por qué falta, cuando falta. */
  note?: string;
}

/** Las seis letras del anexo, siempre en este orden, con lo que significan. */
const LETTERS: ReadonlyArray<{ letter: string; name: string; missing: string }> = [
  { letter: "A", name: "Cima de la subida: inicio del recorrido", missing: "" },
  { letter: "B", name: "Entrada al loop", missing: "este trazado no tiene loop" },
  { letter: "C", name: "Cima del loop", missing: "este trazado no tiene loop" },
  { letter: "D", name: "Cresta de la colina", missing: "este trazado no tiene colina" },
  { letter: "E", name: "Inicio de la zona de frenado", missing: "" },
  { letter: "F", name: "Fin de la zona de frenado", missing: "" }
];

/** Nombre de una letra A–F (para tooltips y nombres accesibles). */
export function letterName(letter: string): string {
  return LETTERS.find(item => item.letter === letter)?.name ?? letter;
}

/**
 * Leyenda de los puntos críticos A–F de un trazado: siempre las seis, en
 * orden; las que el trazado no tiene llevan una nota que dice por qué.
 */
export function pointLegend(track: Pick<Track, "markers">): PointLegendItem[] {
  const present = new Set(track.markers.map(marker => marker.label));

  return LETTERS.map(({ letter, name, missing }) =>
    present.has(letter) ? { letter, name, present: true } : { letter, name, present: false, note: missing }
  );
}
