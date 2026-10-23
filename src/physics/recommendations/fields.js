/** Etiquetas y unidades de los parámetros que el buscador puede modificar. */
export const RECOMMENDATION_FIELDS = Object.freeze({
  initialHeight: ["Altura inicial", "m"],
  initialSpeed: ["Rapidez inicial", "m/s"],
  trackWidth: ["Ancho del trazado", "m"],
  friction: ["Coeficiente de fricción", ""],
  loopHeight: ["Altura del loop", "m"],
  loopTopRadius: ["Radio en la cima del loop", "m"],
  hillHeight: ["Altura de la colina", "m"],
  hillCrestRadius: ["Radio de la cresta", "m"],
  brakingLength: ["Zona de frenado", "m"],
  brakeDeceleration: ["Desaceleración del freno", "m/s²"],
  springConstant: ["Rigidez del resorte", "N/m"],
  springDamping: ["Amortiguamiento del resorte", "N·s/m"],
  maxCompression: ["Compresión máxima", "m"]
});

/**
 * @typedef {Object} Change
 * @property {string} key
 * @property {string} label
 * @property {string} unit
 * @property {number | null} before
 * @property {number | null} after
 */

/**
 * Diferencias relevantes entre dos configuraciones.
 * @param {any} original
 * @param {any} next
 * @returns {Change[]}
 */
export function changesBetween(original, next) {
  /** @type {Change[]} */
  const changes = Object.entries(RECOMMENDATION_FIELDS)
    .filter(([key]) => original[key] !== next[key])
    .map(([key, [label, unit]]) => ({
      key,
      label,
      unit,
      before: original[key],
      after: next[key]
    }));

  if (JSON.stringify(original.customPoints) === JSON.stringify(next.customPoints)) {
    return changes;
  }

  let heightsChanged = false;

  next.customPoints.forEach((/** @type {any} */ point, /** @type {number} */ index) => {
    const before = original.customPoints[index];

    if (!before) {
      heightsChanged = true;
      return;
    }

    if (before.loopHeight !== point.loopHeight) {
      changes.push({
        key: "loopHeight",
        label: `Altura del loop del punto ${index + 1}`,
        unit: "m",
        before: before.loopHeight,
        after: point.loopHeight
      });
    }

    if (before.x !== point.x || before.y !== point.y) {
      heightsChanged = true;
    }
  });

  if (heightsChanged) {
    changes.push({
      key: "customPoints",
      label: "Alturas interiores",
      unit: "",
      before: null,
      after: null
    });
  }

  return changes;
}
