import { TRAIL_COLORS } from "./palette.js";

/** Máximo de puntos de la estela por cuadro. */
const MAX_TRAIL_POINTS = 400;
const TRAIL_WIDTH = 3;
const TRAIL_ALPHA = 0.85;

/**
 * Mezcla lineal de dos colores [r, g, b].
 * @param {ReadonlyArray<number>} from
 * @param {ReadonlyArray<number>} to
 * @param {number} t
 */
function mix(from, to, t) {
  return from.map((channel, index) => Math.round(channel + (to[index] - channel) * t));
}

/**
 * Color de la estela para una rapidez relativa 0–1: azul → morado → rojo.
 * @param {number} ratio
 * @returns {string}
 */
export function speedColor(ratio) {
  const t = Math.max(0, Math.min(1, ratio));
  const rgb =
    t < 0.5
      ? mix(TRAIL_COLORS.slow, TRAIL_COLORS.medium, t * 2)
      : mix(TRAIL_COLORS.medium, TRAIL_COLORS.fast, (t - 0.5) * 2);

  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${TRAIL_ALPHA})`;
}

/**
 * Submuestra el historial a lo sumo a MAX_TRAIL_POINTS estados.
 * @param {ReadonlyArray<any>} history
 */
function sampleHistory(history) {
  const stride = Math.max(1, Math.ceil(history.length / MAX_TRAIL_POINTS));
  const samples = [];

  for (let index = 0; index < history.length; index += stride) {
    samples.push(history[index]);
  }

  if (samples[samples.length - 1] !== history[history.length - 1]) {
    samples.push(history[history.length - 1]);
  }

  return samples;
}

/**
 * Estela coloreada por rapidez a lo largo del historial.
 * @param {import("./index.js").Frame} frame
 */
export function drawTrail({ ctx, camera, scene }) {
  const history = scene.history ?? [];

  if (history.length < 2) return;

  const samples = sampleHistory(history);
  const maxSpeed = Math.max(1e-6, ...samples.map(state => state.speed));

  ctx.lineWidth = TRAIL_WIDTH * camera.zoom;
  ctx.lineCap = "round";

  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1];
    const current = samples[index];

    ctx.strokeStyle = speedColor(current.speed / maxSpeed);
    ctx.beginPath();
    ctx.moveTo(camera.toX(previous.position.x), camera.toY(previous.position.y));
    ctx.lineTo(camera.toX(current.position.x), camera.toY(current.position.y));
    ctx.stroke();
  }
}
