/**
 * Corre `work` cuando el navegador está ocioso (o tras `fallbackMs` si no
 * existe `requestIdleCallback`, como en Safari). Devuelve cómo cancelarlo.
 */
export function whenIdle(work: () => void, fallbackMs: number): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(() => work());
    return () => cancelIdleCallback(id);
  }

  const timer = setTimeout(work, fallbackMs);
  return () => clearTimeout(timer);
}
