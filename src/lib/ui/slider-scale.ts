/**
 * Escala del slider de un campo: posición entera del <input type=range>
 * ↔ valor físico. Lineal para rangos acotados; logarítmica para los que
 * abarcan varios órdenes de magnitud (k, c, dt, Δt), así el valor por
 * defecto no queda pegado a un extremo.
 */
export interface SliderScale {
  min: number;
  max: number;
  step: number;
  scale: "linear" | "log";
}

/** Resolución del <input type=range>. */
export const SLIDER_STEPS = 1000;

/** Decimales que muestra un campo con ese paso (0,25 → 2; 0,0001 → 4). */
export function decimalsFor(step: number): number {
  const text = String(step);
  const exponent = /e-(\d+)$/.exec(text);
  if (exponent) return Number(exponent[1]);

  const point = text.indexOf(".");
  return point < 0 ? 0 : text.length - point - 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Extremo inferior del tramo logarítmico. Con mínimo 0 (o menor que un paso)
 * el log empezaría en valores que el paso redondea a 0 y el slider no se
 * movería durante buena parte del recorrido: la posición 0 queda para el
 * mínimo y el log arranca en un paso.
 */
function logFloor({ min, step }: SliderScale): number {
  return Math.max(min, step);
}

/** Posición entera para un valor. */
export function valueToSlider(value: number, scale: SliderScale): number {
  const { min, max } = scale;
  const v = clamp(value, min, max);
  if (max === min) return 0;
  if (scale.scale === "linear") return Math.round(((v - min) / (max - min)) * SLIDER_STEPS);

  const floor = logFloor(scale);
  const reserved = floor > min ? 1 : 0;
  if (v <= min) return 0;
  if (v <= floor) return reserved;
  const fraction = Math.log(v / floor) / Math.log(max / floor);
  return reserved + Math.round(fraction * (SLIDER_STEPS - reserved));
}

/**
 * Un paso hacia arriba o abajo desde `value`, en la grilla absoluta del
 * paso (desde 29,6 sube a 30, no a 30,1) y dentro de [mín, máx].
 */
export function stepFrom(value: number, direction: number, { min, max, step }: Pick<SliderScale, "min" | "max" | "step">): number {
  const onGrid = Math.round(value / step) * step;
  const next = Math.abs(onGrid - value) < step * 1e-6 ? onGrid + direction * step : direction > 0 ? Math.ceil(value / step) * step : Math.floor(value / step) * step;
  return clamp(Number(next.toFixed(decimalsFor(step))), min, max);
}

/** Valor para una posición: en la grilla absoluta del paso (30, no 30,1), salvo los extremos. */
export function sliderToValue(position: number, scale: SliderScale): number {
  const { min, max, step } = scale;
  const at = clamp(Math.round(position), 0, SLIDER_STEPS);
  if (at === 0) return min;
  if (at === SLIDER_STEPS) return max;

  let raw: number;
  if (scale.scale === "linear") {
    raw = min + (at / SLIDER_STEPS) * (max - min);
  } else {
    const floor = logFloor(scale);
    const reserved = floor > min ? 1 : 0;
    raw = floor * (max / floor) ** ((at - reserved) / (SLIDER_STEPS - reserved));
  }

  const snapped = Number((Math.round(raw / step) * step).toFixed(decimalsFor(step)));
  return clamp(snapped, min, max);
}

/** Decimales que se muestran como máximo para un valor con más decimales que el paso. */
const MAX_SHOWN_DECIMALS = 6;

/**
 * Decimales con que se muestra un valor: los del paso, o los que el valor
 * tenga si son más (lo escrito no se redondea: 30,25 se ve 30,25), hasta 6.
 */
export function shownDecimals(value: number, step: number): number {
  const base = decimalsFor(step);
  for (let digits = base; digits < MAX_SHOWN_DECIMALS; digits++) {
    if (Math.abs(Number(value.toFixed(digits)) - value) < 1e-12) return digits;
  }
  return MAX_SHOWN_DECIMALS;
}

