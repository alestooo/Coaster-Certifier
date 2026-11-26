import { formatNumber } from "../ui/format";
import { stoppedByViolation } from "./run-status";
import type { BrakingInsight, Tone } from "./audit";

export interface BrakingCard {
  value: string;
  note: string;
  /** Fracción de la zona usada (0..1+), para el medidor. */
  fill: number;
  tone: Tone;
}

/**
 * Tarjeta «Distancia de frenado» del dictamen: qué pasó en la zona de
 * frenado. `status` es el estado final de la simulación: distingue un tren
 * que no llega (quieto antes de E) de una simulación cortada antes por otro
 * incumplimiento.
 */
export function brakingCard(braking: BrakingInsight, status: string): BrakingCard {
  switch (braking.outcome) {
    case "stopped":
      return {
        value: `${formatNumber(braking.stoppingDistance ?? 0, 1)} m`,
        note: `de ${formatNumber(braking.available, 0)} m disponibles`,
        fill: (braking.stoppingDistance ?? 0) / braking.available,
        tone: braking.tone
      };
    case "overrun":
      return {
        value: "Se pasa",
        note:
          braking.requiredDistance === null
            ? "el resorte no alcanza a detenerlo"
            : `necesita ${formatNumber(braking.requiredDistance, 0)} m de ${formatNumber(braking.available, 0)} m`,
        fill: 1,
        tone: "bad"
      };
    case "returned":
      return { value: "Rebota", note: "el resorte lo devuelve y queda antes de E", fill: 0, tone: "bad" };
    case "no-stop":
      return { value: "No se detiene", note: "rebota sin quedar quieto", fill: 1, tone: "bad" };
    default:
      return stoppedByViolation(status)
        ? { value: "Sin dato", note: "la simulación se detuvo antes, en el primer incumplimiento", fill: 0, tone: "info" }
        : { value: "No llega", note: "el tren no alcanza la zona de frenado", fill: 0, tone: "info" };
  }
}
