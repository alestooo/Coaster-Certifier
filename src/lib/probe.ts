/**
 * Lectura de la física en un punto de la vía, para la sonda que sigue al
 * cursor: rapidez, fuerza g y fuerza normal del primer paso por ese punto.
 */
import { interpolateAtDistance, geometryAt } from "../physics/index.js";
import { formatNumber } from "../ui/format";
import type { SimulationState, Track } from "./types";

export interface ProbeReadout {
  distance: number;
  time: number;
  speed: number;
  load: number;
  normalKn: number;
  section: string;
}

const N_PER_KN = 1000;

/** Valores del primer paso del tren por la coordenada s; null si nunca llega. */
export function probeAt(history: readonly SimulationState[], track: Track, distance: number): ProbeReadout | null {
  const sample = interpolateAtDistance(history, distance);

  if (!sample) return null;

  return {
    distance,
    time: sample.time,
    speed: sample.speed,
    load: sample.load,
    normalKn: sample.normal / N_PER_KN,
    section: geometryAt(track, distance).section
  };
}

/**
 * Renglones para la etiqueta de la sonda. Sin lectura, distingue un tren
 * que no llega de una simulación que se detuvo en un incumplimiento.
 */
export function probeLines(readout: ProbeReadout | null, options: { stoppedByViolation?: boolean } = {}): string[] {
  if (!readout) {
    return [options.stoppedByViolation ? "La simulación se detuvo en el primer incumplimiento, antes de este punto" : "El tren no llega hasta aquí"];
  }

  return [
    `s = ${formatNumber(readout.distance, 1)} m · t = ${formatNumber(readout.time, 1)} s`,
    `v = ${formatNumber(readout.speed, 1)} m/s · ${formatNumber(readout.load, 2)} g · N = ${formatNumber(readout.normalKn, 1)} kN`
  ];
}
