/** Estados con los que la simulación se corta en un incumplimiento: no hay datos más allá. */
const CUT_STATUSES: ReadonlySet<string> = new Set(["rejected", "lost-contact", "timeout"]);

/** La simulación se cortó en el primer incumplimiento (más adelante no hay datos). */
export function stoppedByViolation(status: string): boolean {
  return CUT_STATUSES.has(status);
}

/**
 * El recorrido terminó sin aprobar: cortado por un incumplimiento o con el
 * tren quieto antes de E («stalled», que sí es un dato: no llega).
 */
export function endedRejected(status: string): boolean {
  return CUT_STATUSES.has(status) || status === "stalled";
}
