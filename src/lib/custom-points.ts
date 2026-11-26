/**
 * Edición del trazado personalizado sobre el lienzo: mover, agregar y
 * borrar puntos, y poner o ajustar loops. Funciones puras que devuelven
 * puntos nuevos (nunca modifican los recibidos) y que, si el trazado no se
 * puede construir, retroceden hasta el último estado válido y explican por qué.
 */
import { buildTrack, resolveConfig, geometryAt, CUSTOM_LIMITS, CONFIG_LIMITS } from "../physics/index.js";
import { MIN_TOP_RADIUS_FRACTION, explainConfigError } from "./handles";
import type { SimulationConfig, Track, TrackPoint } from "./types";

export interface PointEdit {
  points: TrackPoint[];
  /** Verdadero si lo pedido se recortó por un límite o por la geometría. */
  limited: boolean;
  reason: string | null;
}

export interface PointHandle {
  id: string;
  kind: "point" | "loopTop" | "loopRadius";
  /** Índice del punto en `customPoints`. */
  index: number;
  /** Posición en metros. */
  x: number;
  y: number;
  fixed: boolean;
  /** Base del loop (cima) o cima del loop (radio). */
  anchor?: { x: number; y: number };
}

const BISECTION_STEPS = 12;
const EPSILON = 1e-9;
/** Los puntos se guardan con milésimas del ancho y de la altura. */
const POSITION_DECIMALS = 3;
/** Loop que se agrega por defecto: a lo sumo 12 m o el 55 % de H, en lágrima con R = h_L/4. */
const DEFAULT_LOOP_MAX_HEIGHT = 12;
const DEFAULT_LOOP_HEIGHT_FRACTION = 0.55;
const DEFAULT_LOOP_RADIUS_FRACTION = 0.25;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, decimals = POSITION_DECIMALS) => Number(value.toFixed(decimals));
const copy = (points: readonly TrackPoint[]): TrackPoint[] => points.map(point => ({ ...point }));

function relative(pairs: [number, number][]): TrackPoint[] {
  return pairs.map(([x, y]) => ({ x, y, loopHeight: 0, loopTopRadius: 0 }));
}

/** Plantillas para empezar un trazado personalizado (relativas a W y H). */
export const CUSTOM_TEMPLATES: { id: string; label: string; build: (H: number) => TrackPoint[] }[] = [
  { id: "valley", label: "Valle", build: () => relative([[0, 1], [0.3, 0], [0.55, 0.45], [0.8, 0], [1, 0]]) },
  {
    id: "double",
    label: "Doble colina",
    build: () => relative([[0, 1], [0.22, 0], [0.4, 0.5], [0.58, 0.05], [0.76, 0.35], [0.9, 0], [1, 0]])
  },
  {
    id: "loop",
    label: "Loop central",
    build: H => {
      const loopHeight = Math.min(CONFIG_LIMITS.loopHeight[1], Math.max(4, Math.round(H * 0.55)));
      return relative([[0, 1], [0.3, 0], [0.7, 0], [1, 0]]).map((point, index) =>
        index === 1 ? { ...point, loopHeight, loopTopRadius: Math.round((loopHeight / 4) * 2) / 2 } : point
      );
    }
  }
];

/** Error de construcción con esos puntos, o null si el trazado es válido. */
function buildError(config: SimulationConfig, points: TrackPoint[]): unknown {
  try {
    buildTrack(resolveConfig({ ...config, customPoints: points }));
    return null;
  } catch (error) {
    return error;
  }
}

/**
 * Prueba `candidate(1)`; si no se construye, busca por bisección el mayor
 * `t` ∈ [0, 1] cuyo resultado sí se construye (`candidate(0)` es el estado actual).
 */
function lastBuildable(config: SimulationConfig, candidate: (t: number) => TrackPoint[], limited: boolean): PointEdit {
  const wanted = candidate(1);
  const error = buildError(config, wanted);

  if (!error) return { points: wanted, limited, reason: null };

  let valid = 0;
  let invalid = 1;

  for (let step = 0; step < BISECTION_STEPS; step++) {
    const middle = (valid + invalid) / 2;
    if (buildError(config, candidate(middle))) {
      invalid = middle;
    } else {
      valid = middle;
    }
  }

  return { points: candidate(valid), limited: true, reason: explainConfigError(error) };
}

function isInterior(points: readonly TrackPoint[], index: number): boolean {
  return index > 0 && index < points.length - 1;
}

/** Mueve un punto interior a (x, y) metros, sin cruzar a sus vecinos ni salir de [0, H]. */
export function movePoint(config: SimulationConfig, index: number, x: number, y: number): PointEdit {
  const points = config.customPoints;

  if (!isInterior(points, index)) return { points: copy(points), limited: false, reason: null };

  const gap = CUSTOM_LIMITS.minSpacing;
  const wantedX = x / config.trackWidth;
  const wantedY = y / config.initialHeight;
  const targetX = round(clamp(wantedX, points[index - 1].x + gap, points[index + 1].x - gap));
  const targetY = round(clamp(wantedY, 0, 1));
  const limited = Math.abs(targetX - wantedX) > 1e-3 || Math.abs(targetY - wantedY) > 1e-3;
  const from = points[index];

  return lastBuildable(
    config,
    t =>
      points.map((point, position) =>
        position === index ? { ...point, x: round(from.x + (targetX - from.x) * t), y: round(from.y + (targetY - from.y) * t) } : { ...point }
      ),
    limited
  );
}

/**
 * Agrega un punto a mitad de camino hacia el siguiente, o hacia el anterior si
 * después no hay lugar. Es «Agregar punto» de la mini barra (teclado y tacto).
 */
export function insertAfter(config: SimulationConfig, index: number): { points: TrackPoint[]; index: number } | { error: string } {
  const points = config.customPoints;
  if (points.length >= CUSTOM_LIMITS.maxPoints) return insertPoint(config, 0, 0);

  for (const [from, to] of [[index, index + 1], [index - 1, index]]) {
    if (from < 0 || to >= points.length) continue;

    const x = ((points[from].x + points[to].x) / 2) * config.trackWidth;
    const y = ((points[from].y + points[to].y) / 2) * config.initialHeight;
    const result = insertPoint(config, x, y);
    if (!("error" in result)) return result;
  }

  return { error: "No hay lugar para otro punto junto a este." };
}

/** Por qué una plantilla no entra con el ancho y la altura actuales, o null si entra. */
export function templateProblem(config: SimulationConfig, template: (typeof CUSTOM_TEMPLATES)[number]): string | null {
  const error = buildError(config, template.build(config.initialHeight));
  return error ? explainConfigError(error) : null;
}

/** Agrega un punto en (x, y) metros entre sus vecinos. */
export function insertPoint(config: SimulationConfig, x: number, y: number): { points: TrackPoint[]; index: number } | { error: string } {
  const points = config.customPoints;
  const { maxPoints, minSpacing } = CUSTOM_LIMITS;

  if (points.length >= maxPoints) return { error: `Ya hay ${maxPoints} puntos: es el máximo.` };

  const relX = round(x / config.trackWidth);
  const relY = round(clamp(y / config.initialHeight, 0, 1));
  const index = points.findIndex(point => point.x > relX);

  if (relX <= points[0].x || index <= 0) return { error: "Agregá los puntos entre el inicio y el final del trazado." };
  if (relX - points[index - 1].x < minSpacing - EPSILON || points[index].x - relX < minSpacing - EPSILON) {
    return { error: "Está demasiado cerca de otro punto." };
  }

  const next = [...copy(points.slice(0, index)), { x: relX, y: relY, loopHeight: 0, loopTopRadius: 0 }, ...copy(points.slice(index))];
  const error = buildError(config, next);

  return error ? { error: explainConfigError(error) } : { points: next, index };
}

/** Borra un punto interior; null si es un extremo o quedarían menos de tres puntos. */
export function removePoint(config: SimulationConfig, index: number): TrackPoint[] | null {
  const points = config.customPoints;

  if (!isInterior(points, index) || points.length <= CUSTOM_LIMITS.minPoints) return null;

  return copy(points.filter((_, position) => position !== index));
}

/** Pone, ajusta o quita (altura 0) el loop de un punto interior. */
export function setPointLoop(config: SimulationConfig, index: number, height: number, radius: number): PointEdit {
  const points = config.customPoints;
  const unchanged = (reason: string): PointEdit => ({ points: copy(points), limited: true, reason });

  if (!isInterior(points, index)) return unchanged("Los extremos del trazado no llevan loop.");

  if (height <= 0) {
    return { points: points.map((point, position) => (position === index ? { ...point, loopHeight: 0, loopTopRadius: 0 } : { ...point })), limited: false, reason: null };
  }

  const loops = points.filter((point, position) => position !== index && point.loopHeight > 0).length;

  if (!points[index].loopHeight && loops >= CUSTOM_LIMITS.maxLoops) return unchanged(`Ya hay ${CUSTOM_LIMITS.maxLoops} loops: es el máximo.`);

  const [minHeight, maxHeight] = CONFIG_LIMITS.loopHeight;
  const [minRadius, maxRadius] = CONFIG_LIMITS.loopTopRadius;
  const targetHeight = round(clamp(height, minHeight, maxHeight), 2);
  const targetRadius = round(clamp(radius, Math.max(minRadius, MIN_TOP_RADIUS_FRACTION * targetHeight), Math.min(maxRadius, targetHeight / 2)), 2);
  const limited = Math.abs(targetHeight - height) > EPSILON || Math.abs(targetRadius - radius) > EPSILON;
  const current = points[index];
  const fromHeight = current.loopHeight || minHeight;
  const fromRadius = current.loopHeight ? current.loopTopRadius : Math.max(minRadius, MIN_TOP_RADIUS_FRACTION * minHeight);

  return lastBuildable(
    config,
    t => {
      const loopHeight = round(fromHeight + (targetHeight - fromHeight) * t, 2);
      const loopTopRadius = round(clamp(fromRadius + (targetRadius - fromRadius) * t, MIN_TOP_RADIUS_FRACTION * loopHeight, loopHeight / 2), 2);
      return points.map((point, position) => (position === index ? { ...point, loopHeight, loopTopRadius } : { ...point }));
    },
    limited
  );
}

/** Agrega un loop por defecto al punto, o lo quita si ya tiene. */
export function toggleLoop(config: SimulationConfig, index: number): PointEdit {
  if (config.customPoints[index]?.loopHeight > 0) return setPointLoop(config, index, 0, 0);

  const height = Math.min(DEFAULT_LOOP_MAX_HEIGHT, Math.round(config.initialHeight * DEFAULT_LOOP_HEIGHT_FRACTION * 2) / 2);
  return setPointLoop(config, index, height, height * DEFAULT_LOOP_RADIUS_FRACTION);
}

/** Manijas de los puntos interiores y de cada loop (cima y radio), en metros. */
export function pointHandles(track: Track, config: SimulationConfig): PointHandle[] {
  const points = config.customPoints;
  const tops = track.markers.filter(marker => marker.role === "loop-top");
  const handles: PointHandle[] = [];
  let loopNumber = 0;

  points.forEach((point, index) => {
    if (!isInterior(points, index)) return;

    const baseX = round(point.x * config.trackWidth, 9);
    const baseY = round(point.y * config.initialHeight, 9);
    handles.push({ id: `point-${index}`, kind: "point", index, x: baseX, y: baseY, fixed: false });

    if (!point.loopHeight) return;

    const marker = tops[loopNumber++];
    if (!marker) return;

    const top = geometryAt(track, marker.distance);
    handles.push(
      { id: `loop-top-${index}`, kind: "loopTop", index, x: top.x, y: top.y, fixed: false, anchor: { x: top.x, y: baseY } },
      {
        id: `loop-radius-${index}`,
        kind: "loopRadius",
        index,
        x: top.x + point.loopTopRadius,
        y: top.y - point.loopTopRadius,
        fixed: false,
        anchor: { x: top.x, y: top.y }
      }
    );
  });

  return handles;
}

/** Manija y punto del puntero (m) al empezar el gesto. */
export interface PointDragStart {
  handle: PointHandle;
  point: { x: number; y: number };
}

/**
 * Propuesta para arrastrar una manija del personalizado hasta `point` (m).
 * La cima y el radio se miden desde el inicio del gesto: la cima del loop se
 * corre al cambiar R, y con un loop chico las manijas se dibujan apartadas.
 */
export function proposePointHandle(
  config: SimulationConfig,
  handle: PointHandle,
  point: { x: number; y: number },
  start?: PointDragStart
): PointEdit {
  const current = config.customPoints[handle.index];

  if (handle.kind === "point") return movePoint(config, handle.index, point.x, point.y);

  if (handle.kind === "loopTop") {
    // Desde el inicio del gesto: en pantalla la manija puede estar corrida (loop chico).
    const height = start
      ? start.handle.y - (start.handle.anchor?.y ?? 0) + (point.y - start.point.y)
      : point.y - (handle.anchor?.y ?? 0);
    return setPointLoop(config, handle.index, height, current.loopTopRadius);
  }

  const radius = start
    ? start.handle.x - (start.handle.anchor?.x ?? start.handle.x) + (point.x - start.point.x)
    : point.x - (handle.anchor?.x ?? 0);
  return setPointLoop(config, handle.index, current.loopHeight, radius);
}
