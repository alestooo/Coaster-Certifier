/** Utilidades de dibujo compartidas por las capas del renderizador. */

/**
 * Rectángulo redondeado relleno.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {string} color
 * @param {number} [radius]
 */
export function box(ctx, x, y, width, height, color, radius = 4) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
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

/**
 * Texto con fondo tipo etiqueta.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x Centro horizontal.
 * @param {number} y Centro vertical.
 * @param {{font?: string, color?: string, background?: string, padding?: number}} [style]
 */
export function label(ctx, text, x, y, style = {}) {
  const font = style.font ?? "600 10px sans-serif";
  const padding = style.padding ?? 5;

  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const width = ctx.measureText(text).width + padding * 2;
  const fontSize = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 10);
  const height = fontSize + padding * 1.4;

  if (style.background) {
    box(ctx, x - width / 2, y - height / 2, width, height, style.background, 6);
  }

  ctx.fillStyle = style.color ?? "#30233f";
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
