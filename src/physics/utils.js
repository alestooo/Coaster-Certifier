/**
 * Utilidades numéricas sin dependencias. Evitan `Math.max(...array)`,
 * que desborda la pila con historiales de más de ~100 000 estados.
 */

/**
 * Máximo de `read(item)` sobre la colección; −∞ si está vacía.
 * @template T
 * @param {ReadonlyArray<T>} items
 * @param {(item: T) => number} read
 * @returns {number}
 */
export function maxOf(items, read) {
  let best = -Infinity;

  for (const item of items) {
    const value = read(item);
    if (value > best) best = value;
  }

  return best;
}

/**
 * Mínimo de `read(item)` sobre la colección; +∞ si está vacía.
 * @template T
 * @param {ReadonlyArray<T>} items
 * @param {(item: T) => number} read
 * @returns {number}
 */
export function minOf(items, read) {
  let best = Infinity;

  for (const item of items) {
    const value = read(item);
    if (value < best) best = value;
  }

  return best;
}
