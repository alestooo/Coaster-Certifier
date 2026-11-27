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

/** Parámetros globales (no de un elemento) que se comparan directamente. */
const GLOBAL_KEYS = Object.freeze(["initialHeight", "initialSpeed", "friction", "brakingLength", "brakeDeceleration", "springConstant", "springDamping", "maxCompression"]);

/**
 * @typedef {Object} Change
 * @property {string} key
 * @property {string} label
 * @property {string} unit
 * @property {number | null} before
 * @property {number | null} after
 * @property {number} [element] Índice del elemento del trazado que cambia.
 */

/**
 * @typedef {import("../track/elements.js").TrackElement} TrackElement
 */

/**
 * «Altura del loop 2» cuando hay varios loops; «Altura del loop» si hay uno solo.
 * @param {string} base
 * @param {number} ordinal
 * @param {number} count
 */
function numbered(base, ordinal, count) {
  return count > 1 ? `${base} ${ordinal}` : base;
}

/**
 * Cambios de loops y colinas, elemento por elemento, más uno solo para las
 * alturas de los puntos y otro para el ancho (si se estiró el trazado).
 * @param {ReadonlyArray<TrackElement>} before
 * @param {ReadonlyArray<TrackElement>} after
 * @returns {Change[]}
 */
function elementChanges(before, after) {
  /** @type {Change[]} */
  const changes = [];
  const loopCount = before.filter(element => element.type === "point" && element.loop).length;
  const hillCount = before.filter(element => element.type === "hill").length;
  let loopOrdinal = 0;
  let hillOrdinal = 0;
  let heightsChanged = before.length !== after.length;

  before.forEach((element, index) => {
    const next = after[index];
    if (!next || next.type !== element.type) {
      heightsChanged = true;
      return;
    }

    if (element.type === "point" && next.type === "point") {
      if (element.loop) loopOrdinal += 1;
      const loopBefore = element.loop;
      const loopAfter = next.loop;

      if (loopBefore && loopAfter && loopBefore.height !== loopAfter.height) {
        changes.push({ key: "loopHeight", element: index, label: numbered("Altura del loop", loopOrdinal, loopCount), unit: "m", before: loopBefore.height, after: loopAfter.height });
      }
      if (loopBefore && loopAfter && loopBefore.topRadius !== loopAfter.topRadius) {
        changes.push({ key: "loopTopRadius", element: index, label: numbered("Radio en la cima del loop", loopOrdinal, loopCount), unit: "m", before: loopBefore.topRadius, after: loopAfter.topRadius });
      }
      if (element.y !== next.y) heightsChanged = true;
    }

    if (element.type === "hill" && next.type === "hill") {
      hillOrdinal += 1;
      if (element.height !== next.height) {
        changes.push({ key: "hillHeight", element: index, label: numbered("Altura de la colina", hillOrdinal, hillCount), unit: "m", before: element.height, after: next.height });
      }
      if (element.crestRadius !== next.crestRadius) {
        changes.push({ key: "hillCrestRadius", element: index, label: numbered("Radio de la cresta de la colina", hillOrdinal, hillCount), unit: "m", before: element.crestRadius, after: next.crestRadius });
      }
    }
  });

  const endBefore = /** @type {import("../track/elements.js").EndElement} */ (before[before.length - 1]);
  const endAfter = /** @type {import("../track/elements.js").EndElement} */ (after[after.length - 1]);

  if (endBefore && endAfter && endBefore.x !== endAfter.x) {
    changes.push({ key: "trackWidth", label: RECOMMENDATION_FIELDS.trackWidth[0], unit: "m", before: endBefore.x, after: endAfter.x });
  }

  if (heightsChanged) {
    changes.push({ key: "customPoints", label: "Alturas interiores", unit: "", before: null, after: null });
  }

  return changes;
}

/**
 * Diferencias relevantes entre dos configuraciones: los parámetros
 * globales y, elemento por elemento, el trazado.
 * @param {any} original
 * @param {any} next
 * @returns {Change[]}
 */
export function changesBetween(original, next) {
  /** @type {Change[]} */
  const changes = GLOBAL_KEYS.filter(key => original[key] !== next[key]).map(key => {
    const [label, unit] = RECOMMENDATION_FIELDS[/** @type {keyof typeof RECOMMENDATION_FIELDS} */ (key)];
    return { key, label, unit, before: original[key], after: next[key] };
  });

  if (original.track && next.track && JSON.stringify(original.track) !== JSON.stringify(next.track)) {
    changes.push(...elementChanges(original.track, next.track));
  }

  return changes;
}
