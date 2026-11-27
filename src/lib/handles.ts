/**
 * Manijas para editar el trazado arrastrando la propia pista.
 *
 * Cada manija está anclada a un punto del trazado y modifica un único
 * parámetro moviéndose en una sola dirección (como los puntos de control
 * de PhET o Desmos). Todo se calcula en metros; la interfaz solo proyecta
 * a píxeles con la cámara.
 */
import { buildTrack, resolveConfig, geometryAt, hillHalfWidth, APPROACH_LENGTH, ConfigError, mergeConfigPatch } from "../physics/index.js";
import { fieldByKey, fieldLimits, friendlyConfigMessage, MIN_TOP_RADIUS_FRACTION, type NumericKey } from "./field-definitions";
import { formatNumber } from "../ui/format";
import type { AreaId } from "./audit";
import type { SimulationConfig, Track } from "./types";

/** Manijas de los parámetros globales; las del trazado (puntos, loops, colinas, E) están en track-edit.ts. */
export type HandleId = "start" | "speed" | "brakeEnd";
export type HandleAxis = "x" | "y" | "tangent";

interface Point {
  x: number;
  y: number;
}

export interface Handle {
  id: HandleId;
  area: AreaId;
  axis: HandleAxis;
  /** Parámetro de la configuración que modifica. */
  key: NumericKey;
  /** Posición en metros. */
  x: number;
  y: number;
  /** Valor actual del parámetro. */
  value: number;
  /** Nombre accesible. */
  name: string;
  /** Visible sin selección. */
  primary: boolean;
  /** Letra del punto crítico que representa (A, C, D, E, F), solo en las principales. */
  letter?: string;
  /** Referencia del arrastre: base de la flecha v₀, base o cima del loop, centro de la colina, inicio del frenado. */
  anchor?: Point;
  /** Tangente unitaria en A (eje "tangent"). */
  direction?: Point;
}

/** Manija y punto del puntero (m) al empezar el gesto. */
export interface DragStart {
  handle: Handle;
  point: Point;
}

export interface DragProposal {
  value: number;
  patch: Partial<SimulationConfig>;
  /** Verdadero si el valor pedido se recortó por un límite o por la geometría. */
  limited: boolean;
  /** Explicación cuando la geometría impidió llegar al valor pedido. */
  reason: string | null;
}

/** Largo de la flecha de rapidez inicial por cada m/s (m). */
export const SPEED_ARROW_M_PER_MPS = 3;
/** La flecha de v₀ nace un poco delante de A para no taparse con su manija (m). */
const SPEED_ARROW_OFFSET_M = 3;
/** Relación mínima R/h_L que admite la familia de loops en lágrima. */
export { MIN_TOP_RADIUS_FRACTION };
const BISECTION_STEPS = 12;
const EPSILON = 1e-9;


/** Manijas disponibles para el trazado y la configuración actuales. */
export function handlesFor(track: Track, config: SimulationConfig): Handle[] {
  const start = geometryAt(track, 0);
  const direction = { x: Math.cos(start.angle), y: Math.sin(start.angle) };
  const arrowBase = { x: start.x + direction.x * SPEED_ARROW_OFFSET_M, y: start.y + direction.y * SPEED_ARROW_OFFSET_M };
  const arrowLength = config.initialSpeed * SPEED_ARROW_M_PER_MPS;

  const handles: Handle[] = [
    {
      id: "start",
      area: "start",
      axis: "y",
      key: "initialHeight",
      x: start.x,
      y: start.y,
      value: config.initialHeight,
      name: "Cima de la subida A: altura inicial",
      primary: true,
      letter: "A"
    },
    {
      id: "speed",
      area: "start",
      axis: "tangent",
      key: "initialSpeed",
      x: arrowBase.x + direction.x * arrowLength,
      y: arrowBase.y + direction.y * arrowLength,
      value: config.initialSpeed,
      name: "Rapidez inicial en A",
      primary: false,
      anchor: arrowBase,
      direction
    },
    {
      id: "brakeEnd",
      area: "braking",
      axis: "x",
      key: "brakingLength",
      x: track.endX,
      y: 0,
      value: config.brakingLength,
      name: "Fin de la zona de frenado F: largo de frenado",
      primary: true,
      letter: "F",
      anchor: { x: track.brakeX, y: 0 }
    }
  ];

  return handles;
}

/** Valor que pide el puntero (m), sin límites ni redondeo. */
function requestedValue(handle: Handle, point: Point, config: SimulationConfig, start?: DragStart): number {
  const anchor = handle.anchor ?? { x: 0, y: 0 };

  switch (handle.id) {
    case "start":
      return point.y;
    case "speed": {
      const direction = handle.direction ?? { x: 1, y: 0 };
      return ((point.x - anchor.x) * direction.x + (point.y - anchor.y) * direction.y) / SPEED_ARROW_M_PER_MPS;
    }
    case "brakeEnd":
      return point.x - anchor.x;
  }
}

/** Rango admisible del parámetro de la manija, incluida la forma del loop. */
function rangeOf(handle: Handle, config: SimulationConfig): [number, number] {
  return fieldLimits(handle.key, config);
}

function decimalsOf(step: number): number {
  return Math.max(0, Math.ceil(-Math.log10(step) - EPSILON));
}

/** Redondea al paso del campo sin salir del rango. */
function snap(value: number, step: number, [min, max]: [number, number]): number {
  let snapped = Math.round(value / step) * step;

  if (snapped > max + EPSILON) snapped = Math.floor(max / step + EPSILON) * step;
  if (snapped < min - EPSILON) snapped = Math.ceil(min / step - EPSILON) * step;

  return Number(snapped.toFixed(decimalsOf(step) + 2));
}

/** Error de construcción del trazado con ese valor, o null si es construible. */
function buildError(config: SimulationConfig, key: NumericKey, value: number): unknown {
  try {
    buildTrack(resolveConfig(mergeConfigPatch(config, { [key]: value })));
    return null;
  } catch (error) {
    return error;
  }
}

/** Motivo legible, con coma decimal como el resto de la interfaz. */
export function explainConfigError(error: unknown): string {
  const text =
    error instanceof ConfigError
      ? friendlyConfigMessage(error.field, error.message)
      : error instanceof Error
        ? error.message
        : "Ese valor no forma un trazado válido.";

  return text.replace(/(\d)\.(\d)/g, "$1,$2");
}

/**
 * Propone un valor para la manija: lo limita al rango del parámetro y a la
 * forma del loop, lo redondea al paso del campo y, si el trazado no se
 * puede construir, retrocede hasta el último valor construible.
 */
export function proposeValue(
  handle: Handle,
  value: number,
  config: SimulationConfig,
  options: { dragging?: boolean } = {}
): DragProposal {
  const step = fieldByKey(handle.key)?.step ?? 0.1;
  const range = rangeOf(handle, config);
  const clamped = Math.min(range[1], Math.max(range[0], value));
  const wanted = snap(clamped, step, range);
  const limited = Math.abs(clamped - value) > EPSILON;
  const error = buildError(config, handle.key, wanted);

  if (!error) return { value: wanted, patch: { [handle.key]: wanted }, limited, reason: null };

  let valid = handle.value;
  let invalid = wanted;

  for (let index = 0; index < BISECTION_STEPS; index++) {
    const middle = snap((valid + invalid) / 2, step, range);
    if (middle === valid || middle === invalid) break;

    if (buildError(config, handle.key, middle)) {
      invalid = middle;
    } else {
      valid = middle;
    }
  }

  return { value: valid, patch: { [handle.key]: valid }, limited: true, reason: explainConfigError(error) };
}

/** Propone el valor correspondiente a arrastrar la manija hasta `point` (m). */
export function proposeDrag(handle: Handle, point: Point, config: SimulationConfig, start?: DragStart): DragProposal {
  return proposeValue(handle, requestedValue(handle, point, config, start), config, { dragging: true });
}

/** Texto de la manija: «h_L = 21,5 m» y la consecuencia física del valor. */
export interface HandleText {
  /** Texto hablado («Altura del loop: 21,5 m»): nombre accesible del valor, sin símbolos con guion bajo. */
  label: string;
  /** Símbolo («h_L») y valor con unidad («21,5 m») para la etiqueta visible (el símbolo con subíndice). */
  symbol: string;
  value: string;
  /** Consecuencia física del valor (p. ej. «necesita ≥ 5,9 m/s en la cima»). */
  detail: string;
}

export function handleText(handle: Handle, value: number, config: SimulationConfig): HandleText {
  const field = fieldByKey(handle.key);

  if (!field) return { label: formatNumber(value), symbol: "", value: formatNumber(value), detail: "" };

  const shown = `${formatNumber(value, decimalsOf(field.step))}${field.unit ? ` ${field.unit}` : ""}`;
  const detail = field.hint ? field.hint({ ...config, [handle.key]: value }) : "";

  return { label: `${field.label}: ${shown}`, symbol: field.symbol, value: shown, detail };
}
