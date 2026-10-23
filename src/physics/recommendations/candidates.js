import { resolveConfig, CONFIG_LIMITS } from "../config.js";
import { buildTrack } from "../track/builder.js";
import { changesBetween } from "./fields.js";

const SCALE_FACTORS = [0.95, 1.05, 0.9, 1.1, 0.85, 1.15, 0.75, 1.25, 0.6, 1.4];
const FRICTION_DELTAS = [-0.02, -0.01, -0.005, 0.005, 0.01, 0.02];
const WIDE_FACTORS = [1.1, 1.2, 1.4];

/**
 * @param {number} value
 * @param {number} factor
 */
function scaled(value, factor) {
  return Number((value * factor).toFixed(3));
}

/**
 * @typedef {Object} Candidate
 * @property {import("../config.js").SimulationConfig} config
 * @property {import("./fields.js").Change[]} changes
 * @property {number} score Magnitud relativa del cambio (0 = calculada a partir del fallo).
 * @property {boolean} targeted
 */

/**
 * Genera configuraciones candidatas cercanas a la original, ordenadas
 * por magnitud relativa del cambio. Solo devuelve candidatas válidas.
 *
 * @param {import("../config.js").SimulationConfig} original
 * @param {Record<string, unknown>[]} [targeted] Parches calculados a partir del fallo.
 * @returns {Candidate[]}
 */
export function candidateList(original, targeted = []) {
  /** @type {Map<string, Candidate>} */
  const candidates = new Map();

  /**
   * @param {Record<string, unknown>} patch
   * @param {boolean} [isTargeted]
   */
  function add(patch, isTargeted = false) {
    const candidate = /** @type {import("../config.js").SimulationConfig} */ ({ ...original, ...patch });

    for (const [key, [min, max]] of Object.entries(CONFIG_LIMITS)) {
      const value = /** @type {number} */ (candidate[/** @type {keyof typeof candidate} */ (key)]);

      if (typeof value === "number" && (value < min || value > max)) return;
    }

    try {
      resolveConfig(candidate);
      buildTrack(candidate);
    } catch {
      return;
    }

    const changes = changesBetween(original, candidate);

    if (!changes.length) return;

    let score = 0;

    for (const change of changes) {
      if (change.key === "customPoints") {
        score += 0.2;
      } else {
        score +=
          Math.abs(Number(change.after) - Number(change.before)) /
          Math.max(Math.abs(Number(change.before)), change.key === "friction" ? 0.05 : 1);
      }
    }

    candidates.set(JSON.stringify(candidate), {
      config: candidate,
      changes,
      score: isTargeted ? 0 : score,
      targeted: isTargeted
    });
  }

  for (const patch of targeted) {
    add(patch, true);
  }

  const hasLoop = ["loop", "reference"].includes(original.mapId);
  const hasHill = ["valley", "reference"].includes(original.mapId) && original.hillHeight > 0;

  for (const factor of SCALE_FACTORS) {
    add({ initialHeight: scaled(original.initialHeight, factor) });
    add({ trackWidth: scaled(original.trackWidth, factor) });

    if (hasLoop) {
      add({
        loopHeight: scaled(original.loopHeight, factor),
        loopTopRadius: scaled(original.loopTopRadius, factor)
      });
      add({ loopTopRadius: scaled(original.loopTopRadius, factor) });
    }

    if (hasHill) {
      add({ hillHeight: scaled(original.hillHeight, factor) });
      add({ hillCrestRadius: scaled(original.hillCrestRadius, factor) });
    }

    if (original.brakeMode === "station") {
      add({ brakingLength: scaled(original.brakingLength, factor) });
      add({ brakeDeceleration: scaled(original.brakeDeceleration, factor) });
    } else {
      add({ springConstant: scaled(original.springConstant, factor) });
      add({ maxCompression: scaled(original.maxCompression, factor) });
      add({ springDamping: Math.max(100, scaled(original.springDamping || 500, factor)) });
    }
  }

  for (const delta of FRICTION_DELTAS) {
    add({ friction: Number((original.friction + delta).toFixed(4)) });
  }

  for (const factor of WIDE_FACTORS) {
    add({ trackWidth: original.trackWidth * factor, initialHeight: original.initialHeight * 0.9 });
    add({ trackWidth: original.trackWidth * factor, friction: original.friction * 0.5 });

    if (original.mapId === "custom") {
      add({
        trackWidth: original.trackWidth * factor,
        customPoints: original.customPoints.map((point, index) =>
          index === 0 || index === original.customPoints.length - 1
            ? { ...point }
            : { ...point, y: point.y * 0.85 }
        )
      });
    }
  }

  if (hasLoop) {
    for (const heightFactor of [0.9, 0.95, 1.05, 1.1]) {
      for (const radiusFactor of [0.9, 1.05, 1.1, 1.2]) {
        add({
          initialHeight: original.initialHeight * heightFactor,
          loopTopRadius: scaled(original.loopTopRadius, radiusFactor)
        });
      }
    }
  }

  if (original.mapId === "custom") {
    for (const factor of [0.85, 0.95, 1.05, 1.15, 1.3]) {
      add({
        customPoints: original.customPoints.map(point => ({
          ...point,
          loopHeight: point.loopHeight ? scaled(point.loopHeight, factor) : 0,
          loopTopRadius: point.loopHeight ? scaled(point.loopTopRadius, factor) : 0
        }))
      });
    }
  }

  for (const factor of [1.6, 2, 2.5]) {
    add({ trackWidth: original.trackWidth * factor });
  }

  for (const factor of [0.5, 0.35]) {
    add({ initialHeight: original.initialHeight * factor });
  }

  for (const [heightScale, widthScale] of [[0.75, 1.5], [0.6, 2], [0.5, 2.5]]) {
    add({
      initialHeight: original.initialHeight * heightScale,
      trackWidth: original.trackWidth * widthScale
    });
  }

  return [...candidates.values()].sort((first, second) => first.score - second.score);
}
