import { ConfigError } from "../config.js";

/**
 * Disposición de nodos de cada trazado predefinido.
 *
 * Cada nodo es un punto (x, y) en metros. Un nodo con `loopHeight > 0`
 * ancla un loop en su posición; un nodo con `role: "crest"` es la cresta
 * de una colina construida con el radio de curvatura pedido.
 */

/**
 * @typedef {Object} TrackNode
 * @property {number} x Posición horizontal (m).
 * @property {number} y Altura (m).
 * @property {number} [loopHeight] Altura del loop anclado (m).
 * @property {number} [loopTopRadius] Radio en la cima del loop (m).
 * @property {"start"|"valley"|"crest"|"end"|"plain"} [role]
 */

/** Separación mínima entre elementos como fracción del ancho. */
const MIN_GAP_FRACTION = 0.03;

/**
 * @param {number} x
 * @param {number} y
 * @param {TrackNode["role"]} role
 * @param {{loopHeight: number, loopTopRadius: number}} [loop]
 * @returns {TrackNode}
 */
function node(x, y, role, loop) {
  return loop ? { x, y, role, ...loop } : { x, y, role };
}

/**
 * Semiancho horizontal de una colina simétrica construida con curvas de
 * Hermite de pendiente nula en los extremos: ρ_c = w² / (6·h_c).
 *
 * @param {number} height Altura h_c (m).
 * @param {number} crestRadius Radio en la cresta ρ_c (m).
 * @returns {number} Semiancho w (m).
 */
export function hillHalfWidth(height, crestRadius) {
  return Math.sqrt(6 * height * crestRadius);
}

/**
 * Nodos de una colina centrada en `center`.
 * @param {number} center
 * @param {number} height
 * @param {number} crestRadius
 * @returns {TrackNode[]}
 */
function hillNodes(center, height, crestRadius) {
  const half = hillHalfWidth(height, crestRadius);

  return [
    node(center - half, 0, "plain"),
    node(center, height, "crest"),
    node(center + half, 0, "plain")
  ];
}

/**
 * Comprueba que la colina quepa entre `left` y `right`.
 * @param {number} left
 * @param {number} right
 * @param {number} height
 * @param {number} crestRadius
 * @param {number} width
 */
function assertHillFits(left, right, height, crestRadius, width) {
  const gap = MIN_GAP_FRACTION * width;
  const needed = 2 * hillHalfWidth(height, crestRadius) + 2 * gap;

  if (right - left < needed) {
    throw new ConfigError(
      `La colina necesita ${needed.toFixed(1)} m de ancho y solo hay ${(right - left).toFixed(1)} m: ` +
        "reducí su altura o el radio de la cresta, o aumentá el ancho del trazado.",
      "hillCrestRadius"
    );
  }
}

/**
 * @param {import("../config.js").SimulationConfig} config
 * @returns {TrackNode[]}
 */
export function layoutNodes(config) {
  const H = config.initialHeight;
  const W = config.trackWidth;
  const loop = { loopHeight: config.loopHeight, loopTopRadius: config.loopTopRadius };

  switch (config.mapId) {
    case "incline":
      return [node(0, H, "start"), node(W, 0, "end")];

    case "slope":
      return [node(0, H, "start"), node(0.65 * W, 0, "valley"), node(W, 0, "end")];

    case "valley": {
      const valleyX = 0.3 * W;

      if (config.hillHeight <= 0) {
        return [node(0, H, "start"), node(valleyX, 0, "valley"), node(W, 0, "end")];
      }

      assertHillFits(valleyX, W, config.hillHeight, config.hillCrestRadius, W);

      return [
        node(0, H, "start"),
        node(valleyX, 0, "valley"),
        ...hillNodes((valleyX + W) / 2, config.hillHeight, config.hillCrestRadius),
        node(W, 0, "end")
      ];
    }

    case "loop":
      return [
        node(0, H, "start"),
        node(0.28 * W, 0, "valley", loop),
        node(0.72 * W, 0, "plain"),
        node(W, 0, "end")
      ];

    case "reference": {
      const loopX = 0.25 * W;
      const reference = config.loopHeight / 2;
      const shape = 1 - config.loopTopRadius / reference;
      const exitX = loopX + Math.PI * shape * reference;
      const nodes = [node(0, H, "start"), node(loopX, 0, "valley", loop)];

      if (config.hillHeight > 0) {
        const left = exitX + MIN_GAP_FRACTION * W;
        assertHillFits(left, W, config.hillHeight, config.hillCrestRadius, W);
        nodes.push(...hillNodes((left + W) / 2, config.hillHeight, config.hillCrestRadius));
      }

      nodes.push(node(W, 0, "end"));
      return nodes;
    }

    default:
      return config.customPoints.map((point, index, points) => {
        const last = points.length - 1;
        const isCrest =
          index > 0 &&
          index < last &&
          !point.loopHeight &&
          point.y > points[index - 1].y &&
          point.y > points[index + 1].y;

        return node(
          point.x * W,
          point.y * H,
          index === 0 ? "start" : index === last ? "end" : isCrest ? "crest" : "plain",
          { loopHeight: point.loopHeight, loopTopRadius: point.loopTopRadius }
        );
      });
  }
}
