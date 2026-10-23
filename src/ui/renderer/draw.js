/** Utilidades de dibujo compartidas por las capas del renderizador. */

/**
 * Rectángulo redondeado relleno.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {string | CanvasGradient} color
 * @param {number} [radius]
 */
export function box(ctx, x, y, width, height, color, radius = 4) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2));
  ctx.fill();
}

/**
 * Círculo relleno.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {string | CanvasGradient} color
 */
export function circle(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Elipse rellena.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radiusX
 * @param {number} radiusY
 * @param {string} color
 */
export function ellipse(ctx, x, y, radiusX, radiusY, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, radiusX), Math.max(0, radiusY), 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Polilínea trazada (sin cerrar) a partir de puntos de pantalla.
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReadonlyArray<{x: number, y: number}>} points
 */
export function tracePolyline(ctx, points) {
  ctx.beginPath();
  points.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
}

/**
 * Panel translúcido con borde, para texto superpuesto.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {string} fill
 * @param {string} stroke
 */
export function panel(ctx, x, y, width, height, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 10);
  ctx.fill();
  ctx.stroke();
}

/**
 * Flecha recta con punta.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} toX
 * @param {number} toY
 * @param {string} color
 * @param {number} [lineWidth]
 */
export function arrow(ctx, fromX, fromY, toX, toY, color, lineWidth = 2.5) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const head = 7;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - head * Math.cos(angle - Math.PI / 6), toY - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - head * Math.cos(angle + Math.PI / 6), toY - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

/** Fuente de la interfaz, también dentro del lienzo. */
export const FONT_FAMILY = "Nunito, 'Segoe UI', system-ui, sans-serif";

/**
 * Texto con fondo tipo etiqueta.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x Centro horizontal.
 * @param {number} y Centro vertical.
 * @param {{size?: number, weight?: number, color?: string, background?: string, padding?: number}} [style]
 */
export function label(ctx, text, x, y, style = {}) {
  const size = style.size ?? 10;
  const padding = style.padding ?? 5;

  ctx.font = `${style.weight ?? 600} ${size}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const width = ctx.measureText(text).width + padding * 2;
  const height = size + padding * 1.4;

  if (style.background) {
    box(ctx, x - width / 2, y - height / 2, width, height, style.background, 6);
  }

  ctx.fillStyle = style.color ?? "#2d2140";
  ctx.fillText(text, x, y);
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Valor pseudoaleatorio determinista en [0, 1) a partir de enteros.
 * @param {number} a
 * @param {number} [b]
 */
export function hash(a, b = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + 0x9e3779b9) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const FORMATTERS = new Map();

/**
 * Formatea un número con separadores locales (es-CR).
 * @param {number} value
 * @param {number} [digits]
 */
export function fmt(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";

  let formatter = FORMATTERS.get(digits);

  if (!formatter) {
    formatter = new Intl.NumberFormat("es-CR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
    FORMATTERS.set(digits, formatter);
  }

  return formatter.format(value);
}
