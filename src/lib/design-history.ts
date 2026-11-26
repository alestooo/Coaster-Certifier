/**
 * Historial inmutable para deshacer y rehacer cambios del diseño.
 * Cada operación devuelve un historial nuevo; nunca modifica el recibido.
 */

/** Pasos anteriores que se conservan como máximo. */
export const MAX_HISTORY = 50;

export interface DesignHistory<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

export function createHistory<T>(present: T): DesignHistory<T> {
  return { past: [], present, future: [] };
}

function sameValue<T>(a: T, b: T): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** Registra un valor nuevo como presente; descarta lo que se podía rehacer. */
export function record<T>(history: DesignHistory<T>, next: T): DesignHistory<T> {
  if (sameValue(history.present, next)) return history;

  const past = [...history.past, history.present].slice(-MAX_HISTORY);

  return { past, present: next, future: [] };
}

export function undo<T>(history: DesignHistory<T>): DesignHistory<T> {
  if (!history.past.length) return history;

  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future]
  };
}

export function redo<T>(history: DesignHistory<T>): DesignHistory<T> {
  if (!history.future.length) return history;

  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1)
  };
}

export function canUndo<T>(history: DesignHistory<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: DesignHistory<T>): boolean {
  return history.future.length > 0;
}
