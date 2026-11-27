/**
 * Edición del trazado por elementos sobre el lienzo: mover puntos, colinas y
 * E, agregar y borrar elementos, y poner o ajustar loops. Funciones puras
 * que devuelven un trazado nuevo (nunca modifican el recibido) y que, si el
 * pedido no se puede construir, retroceden hasta el último diseño válido y
 * explican por qué. Sin topes de cantidad: solo separación, construcción y
 * el máximo de elementos de la librería.
 */
import {
  buildTrack,
  resolveConfig,
  geometryAt,
  hillHalfWidth,
  createLoop,
  loopExtent,
  withElement,
  copyElement,
  CONFIG_LIMITS,
  ZONE_LIMITS,
  APPROACH_LENGTH,
  MAX_TRACK_ELEMENTS
} from "../physics/index.js";
import { explainConfigError } from "./handles";
import { MIN_TOP_RADIUS_FRACTION } from "./field-definitions";
import { formatNumber } from "../ui/format";
import type { SimulationConfig, Track, TrackElement, PointElement, HillElement, ZoneElement } from "./types";

/** Separación mínima entre elementos vecinos al editar (m). */
export const EDIT_MIN_GAP_M = 2;

export interface TrackEdit {
  track: TrackElement[];
  /** Verdadero si lo pedido se recortó por un límite o por la geometría. */
  limited: boolean;
  reason: string | null;
}

export type ElementKey = "x" | "y" | "loopHeight" | "loopTopRadius" | "hillHeight" | "hillCrestRadius" | "length" | "power" | "maxAcceleration" | "damping";

/** Qué se agrega desde la mini barra. */
export type InsertKind = "point" | "hill" | "booster" | "trim";

export interface ElementHandle {
  id: string;
  kind: "point" | "loopTop" | "loopRadius" | "hillCrest" | "hillRadius" | "end" | "zoneStart" | "zoneEnd";
  /** Índice del elemento en `config.track`. */
  index: number;
  /** Posición en metros. */
  x: number;
  y: number;
  /** Letra del anexo que marca (B, C, D, E…), si marca alguna. */
  letter?: string;
  /** Nombre accesible, hablado. */
  name: string;
  /** Base del loop (cima), cima del loop (radio) o cresta (radio de la cresta). */
  anchor?: { x: number; y: number };
}

/** Manija y punto del puntero (m) al empezar el gesto. */
export interface ElementDragStart {
  handle: ElementHandle;
  point: { x: number; y: number };
}

const BISECTION_STEPS = 12;
const EPSILON = 1e-9;
const POSITION_DECIMALS = 3;
/** Altura máxima de un punto (m): la de la cima A más alta. */
const MAX_POINT_HEIGHT = CONFIG_LIMITS.initialHeight[1];
/** Altura mínima de una colina al editar (m). */
const MIN_HILL_HEIGHT = 0.5;
/** Loop que se agrega por defecto: a lo sumo 12 m o el 55 % de H, en lágrima con R = h_L/4. */
const DEFAULT_LOOP_MAX_HEIGHT = 12;
const DEFAULT_LOOP_HEIGHT_FRACTION = 0.55;
const DEFAULT_LOOP_RADIUS_FRACTION = 0.25;
/** Colina que se agrega por defecto: a lo sumo 10 m o la mitad de H, con ρ_c de 25 m. */
const DEFAULT_HILL_MAX_HEIGHT = 10;
const DEFAULT_HILL_CREST_RADIUS = 25;
/** Si no entra, la colina nueva se achica: primero el radio (hasta 10 m), después la altura (hasta 2 m). */
const MIN_INSERT_CREST_RADIUS = 10;
const MIN_INSERT_HILL_HEIGHT = 2;
/** Lanzador y frenos de ajuste que se agregan por defecto (se acortan hasta 2 m si el hueco es corto). */
const DEFAULT_BOOSTER = { length: 30, power: 300_000, maxAcceleration: 12 } as const;
const DEFAULT_TRIM = { length: 20, damping: 100 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, decimals = POSITION_DECIMALS) => Number(value.toFixed(decimals));
const copy = (track: readonly TrackElement[]): TrackElement[] => track.map(copyElement);

/**
 * Sin tramos rectos (`line`): el plano inclinado es una recta de A a E, pero con
 * un elemento en el medio el tramo recto empalmaría en ángulo con la curva que
 * llega horizontal al nodo, un quiebre que ningún tren real puede recorrer.
 */
const withoutLines = (track: readonly TrackElement[]): TrackElement[] =>
  track.map(element => {
    if (!("line" in element)) return copyElement(element);
    const { line: _line, ...rest } = copyElement(element) as TrackElement & { line?: boolean };
    return rest as TrackElement;
  });
const meters = (value: number) => formatNumber(value, 1);

/** Error de construcción con ese trazado, o null si es válido. */
function buildError(config: SimulationConfig, track: TrackElement[]): unknown {
  try {
    buildTrack(resolveConfig({ ...config, track }));
    return null;
  } catch (error) {
    return error;
  }
}

/**
 * Prueba `candidate(1)`; si no se construye, busca por bisección el mayor
 * `t` ∈ [0, 1] cuyo resultado sí se construye (`candidate(0)` es el actual).
 */
function lastBuildable(config: SimulationConfig, candidate: (t: number) => TrackElement[], limited: boolean): TrackEdit {
  const wanted = candidate(1);
  const error = buildError(config, wanted);

  if (!error) return { track: wanted, limited, reason: null };

  let valid = 0;
  let invalid = 1;

  for (let step = 0; step < BISECTION_STEPS; step++) {
    const middle = (valid + invalid) / 2;
    if (buildError(config, candidate(middle))) invalid = middle;
    else valid = middle;
  }

  return { track: candidate(valid), limited: true, reason: explainConfigError(error) };
}

const unchanged = (config: SimulationConfig, reason: string | null = null): TrackEdit => ({ track: copy(config.track), limited: reason !== null, reason });

/**
 * Cuánto ocupa un elemento a cada lado de su x (m): la media anchura de una
 * colina, o lo que el loop de un punto se extiende hacia atrás y hasta su salida.
 */
function reach(element: TrackElement, height = element.type === "hill" ? element.height : 0): [number, number] {
  if (element.type === "hill") {
    const half = hillHalfWidth(height, element.crestRadius);
    return [half, half];
  }
  if (element.type === "booster" || element.type === "trim") return [0, element.length];
  if (element.type !== "point" || !element.loop) return [0, 0];

  const loop = createLoop({ x: element.x, y: element.y, height: element.loop.height, topRadius: element.loop.topRadius, section: "" });
  const [minX, maxX] = loopExtent(loop);
  return [Math.max(0, element.x - minX), Math.max(maxX, loop.exitX) - element.x];
}

/** Borde izquierdo y derecho que ocupa un elemento (m), loop o laderas incluidos. */
function extent(element: TrackElement): [number, number] {
  if (element.type === "start") return [0, 0];
  const [left, right] = reach(element);
  return [element.x - left, element.x + right];
}

/** Motivo cuando la x se detiene contra un vecino. */
const NEIGHBOR_REASON = `Necesita más espacio: los elementos van en orden, separados al menos ${formatNumber(EDIT_MIN_GAP_M, 0)} m contando loops y laderas.`;

/** La x pedida se recortó contra un vecino (no contra el ancho máximo). */
const hitNeighbor = (x: number, min: number, max: number) => x < min - 1e-3 || (x > max + 1e-3 && max < CONFIG_LIMITS.trackWidth[1]);

/** Con el motivo del vecino si la x se recortó contra él y la construcción no dio otro. */
const withNeighborReason = (edit: TrackEdit, clipped: boolean): TrackEdit => (clipped && !edit.reason ? { ...edit, reason: NEIGHBOR_REASON } : edit);

/**
 * Rango [mín, máx] para la x del elemento `index` entre sus vecinos, sabiendo
 * cuánto ocupa (`own`) a cada lado. Siempre incluye su x actual: un loop o una
 * colina que crecieron hasta su vecino (o una corrección) pueden dejarlo más
 * cerca que el margen, y cambiar solo la altura no debe correrlo de costado.
 */
function xRange(track: readonly TrackElement[], index: number, own: [number, number] = [0, 0]): [number, number] {
  const element = track[index];
  const previous = track[index - 1];
  const next = track[index + 1];
  const min = startsAtStation(track, index) ? 0 : (previous ? extent(previous)[1] : 0) + EDIT_MIN_GAP_M + own[0];
  const max = next ? extent(next)[0] - EDIT_MIN_GAP_M - own[1] : CONFIG_LIMITS.trackWidth[1];
  const current = element && "x" in element ? element.x : null;
  return current === null ? [min, max] : [Math.min(min, current), Math.max(max, current)];
}

/**
 * Mueve un elemento: un punto en (x, y); una colina con su cresta en x y
 * altura y; E (el final) solo en x, y nada más se corre. A no se mueve.
 */
export function moveElement(config: SimulationConfig, index: number, x: number, y?: number): TrackEdit {
  const track = config.track;
  const element = track[index];

  if (!element || element.type === "start") return unchanged(config);

  if (element.type === "end") {
    const [min] = xRange(track, index);
    const target = round(clamp(x, min, CONFIG_LIMITS.trackWidth[1]));
    const limited = Math.abs(target - x) > 1e-3;
    const from = element.x;
    return withNeighborReason(lastBuildable(config, t => withElement(track, index, { x: round(from + (target - from) * t) }), limited), x < min - 1e-3);
  }

  if (element.type === "hill") {
    const height = y === undefined ? element.height : round(clamp(y, MIN_HILL_HEIGHT, CONFIG_LIMITS.hillHeight[1]), 2);
    const [min, max] = xRange(track, index, reach(element, height));
    const targetX = round(clamp(x, min, Math.max(min, max)));
    const limited = Math.abs(targetX - x) > 1e-3 || (y !== undefined && Math.abs(height - y) > 1e-3);
    const from = element;
    const edit = lastBuildable(
      config,
      t => withElement(track, index, { x: round(from.x + (targetX - from.x) * t), height: round(from.height + (height - from.height) * t, 2) }),
      limited
    );
    return withNeighborReason(edit, hitNeighbor(x, min, max));
  }

  const [min, max] = xRange(track, index, reach(element));
  const targetX = round(clamp(x, min, Math.max(min, max)));
  // Una zona que llega a la estación (x = 0) queda a la altura de A.
  const atStation = targetX === 0 && startsAtStation(track, index);
  const targetY = atStation ? config.initialHeight : round(clamp(y ?? element.y, 0, MAX_POINT_HEIGHT));
  const limited = Math.abs(targetX - x) > 1e-3 || (y !== undefined && Math.abs(targetY - y) > 1e-3);
  const from = element;

  const edit = lastBuildable(
    config,
    t => withElement(track, index, { x: round(from.x + (targetX - from.x) * t), y: round(from.y + (targetY - from.y) * t) }),
    limited
  );
  return withNeighborReason(edit, hitNeighbor(x, min, max));
}

/** Pone, ajusta o quita (altura 0) el loop de un punto. A, E y las colinas no llevan loop. */
export function setPointLoop(config: SimulationConfig, index: number, height: number, radius: number): TrackEdit {
  const track = config.track;
  const element = track[index];

  if (element?.type !== "point") return unchanged(config, "Solo los puntos llevan loop.");
  if (height <= 0) return { track: withElement(track, index, { loop: undefined }), limited: false, reason: null };

  const [minHeight, maxHeight] = CONFIG_LIMITS.loopHeight;
  const [minRadius, maxRadius] = CONFIG_LIMITS.loopTopRadius;
  const targetHeight = round(clamp(height, minHeight, maxHeight), 2);
  const targetRadius = round(clamp(radius, Math.max(minRadius, MIN_TOP_RADIUS_FRACTION * targetHeight), Math.min(maxRadius, targetHeight / 2)), 2);
  const limited = Math.abs(targetHeight - height) > EPSILON || Math.abs(targetRadius - radius) > EPSILON;
  const fromHeight = element.loop?.height ?? minHeight;
  const fromRadius = element.loop?.topRadius ?? Math.max(minRadius, MIN_TOP_RADIUS_FRACTION * minHeight);

  return lastBuildable(
    config,
    t => {
      const loopHeight = round(fromHeight + (targetHeight - fromHeight) * t, 2);
      const topRadius = round(clamp(fromRadius + (targetRadius - fromRadius) * t, MIN_TOP_RADIUS_FRACTION * loopHeight, loopHeight / 2), 2);
      return withElement(track, index, { loop: { height: loopHeight, topRadius } });
    },
    limited
  );
}

/** Agrega un loop por defecto al punto, o lo quita si ya tiene. */
export function toggleLoop(config: SimulationConfig, index: number): TrackEdit {
  const element = config.track[index];
  if (element?.type === "point" && element.loop) return setPointLoop(config, index, 0, 0);

  const height = Math.min(DEFAULT_LOOP_MAX_HEIGHT, Math.round(config.initialHeight * DEFAULT_LOOP_HEIGHT_FRACTION * 2) / 2);
  return setPointLoop(config, index, height, height * DEFAULT_LOOP_RADIUS_FRACTION);
}

/** Cambia la altura o el radio de la cresta de una colina. */
export function setHill(config: SimulationConfig, index: number, patch: { height?: number; crestRadius?: number }): TrackEdit {
  const track = config.track;
  const element = track[index];

  if (element?.type !== "hill") return unchanged(config, "Ese elemento no es una colina.");

  const [, maxHeight] = CONFIG_LIMITS.hillHeight;
  const [minRadius, maxRadius] = CONFIG_LIMITS.hillCrestRadius;
  const height = round(clamp(patch.height ?? element.height, MIN_HILL_HEIGHT, maxHeight), 2);
  const crestRadius = round(clamp(patch.crestRadius ?? element.crestRadius, minRadius, maxRadius), 2);
  const limited =
    (patch.height !== undefined && Math.abs(height - patch.height) > 1e-3) ||
    (patch.crestRadius !== undefined && Math.abs(crestRadius - patch.crestRadius) > 1e-3);
  const from = element;

  const edit = lastBuildable(
    config,
    t =>
      withElement(track, index, {
        height: round(from.height + (height - from.height) * t, 2),
        crestRadius: round(from.crestRadius + (crestRadius - from.crestRadius) * t, 2)
      }),
    limited
  );
  return edit.reason ? { ...edit, reason: hillRoomReason(track, index, height, crestRadius) ?? edit.reason } : edit;
}

/** Motivo concreto cuando una ladera de la colina (la cresta queda en su x) no llega a entrar hasta su vecino, o null. */
function hillRoomReason(track: readonly TrackElement[], index: number, height: number, crestRadius: number): string | null {
  const hill = track[index];
  const previous = track[index - 1];
  const next = track[index + 1];
  if (hill?.type !== "hill" || !previous || !next) return null;

  const half = hillHalfWidth(height, crestRadius);
  const space = Math.min(hill.x - extent(previous)[1], extent(next)[0] - hill.x) - EDIT_MIN_GAP_M;
  return half > space ? `La colina no cabe: con esa forma cada ladera mide ${meters(half)} m y hasta su vecino hay ${meters(Math.max(0, space))} m.` : null;
}

/** Altura de un elemento a nivel de la vía para promediar (A: H; una colina, su base). */
function levelOf(config: SimulationConfig, element: TrackElement): number {
  if (element.type === "start") return config.initialHeight;
  if (element.type === "point" || element.type === "booster" || element.type === "trim") return element.y;
  return 0;
}

/** Verdadero si A no tiene subida por cadena (montaña rusa lanzada). */
const isLaunched = (track: readonly TrackElement[]) => track[0]?.type === "start" && !track[0].lift;

/**
 * Una zona que sigue a A en una montaña rusa sin subida puede empezar en la
 * propia estación (x = 0, a la altura de A): no lleva margen con A.
 */
function startsAtStation(track: readonly TrackElement[], index: number): boolean {
  const element = track[index];
  return index === 1 && isLaunched(track) && (element?.type === "booster" || element?.type === "trim");
}

/** Nombre de una zona en los textos: «el lanzador», «los frenos de ajuste». */
const zoneNoun = (kind: "booster" | "trim") => (kind === "booster" ? "un lanzador" : "unos frenos de ajuste");

/**
 * Agrega un lanzador o unos frenos de ajuste entre `left` y `right` (m): el
 * por defecto, o más corto (hasta 2 m) si el hueco no alcanza; centrado en
 * el hueco y a la altura media de sus vecinos.
 */
function insertZone(config: SimulationConfig, kind: "booster" | "trim", from: number, to: number): { track: TrackElement[]; index: number } | { error: string } {
  const track = config.track;
  if (track.length >= MAX_TRACK_ELEMENTS) return { error: `El trazado ya tiene ${MAX_TRACK_ELEMENTS} elementos: es el máximo.` };

  const left = extent(track[from])[1];
  const right = extent(track[to])[0];
  // Sin subida, la zona que sigue a A arranca en la estación misma (x = 0, a la altura de A).
  const atStation = from === 0 && isLaunched(track);
  const room = right - left - (atStation ? 1 : 2) * EDIT_MIN_GAP_M;
  const [minLength] = ZONE_LIMITS.length;
  const wanted = kind === "booster" ? DEFAULT_BOOSTER.length : DEFAULT_TRIM.length;
  const length = round(Math.min(wanted, room), 2);

  if (length < minLength) return { error: `No hay lugar para ${zoneNoun(kind)} junto a este elemento: hace falta un hueco recto de al menos ${meters(minLength + 2 * EDIT_MIN_GAP_M)} m.` };

  const x = atStation ? 0 : round(left + EDIT_MIN_GAP_M + (room - length) / 2);
  const y = atStation ? config.initialHeight : round((levelOf(config, track[from]) + levelOf(config, track[to])) / 2);
  const zone: ZoneElement =
    kind === "booster" ? { type: "booster", x, y, length, power: DEFAULT_BOOSTER.power, maxAcceleration: DEFAULT_BOOSTER.maxAcceleration } : { type: "trim", x, y, length, damping: DEFAULT_TRIM.damping };
  const next = withoutLines([...track.slice(0, to), zone, ...track.slice(to)]);
  const error = buildError(config, next);

  return error ? { error: `No entra ${zoneNoun(kind)} ahí: ${explainConfigError(error)}` } : { track: next, index: to };
}

/**
 * Cambia el largo, la potencia, la aceleración máxima o el coeficiente c de
 * una zona, sin salirse de sus rangos; un largo que choca con el vecino se
 * detiene en el último construible.
 */
export function setZone(config: SimulationConfig, index: number, patch: { length?: number; power?: number; maxAcceleration?: number; damping?: number }): TrackEdit {
  const track = config.track;
  const element = track[index];
  if (element?.type !== "booster" && element?.type !== "trim") return unchanged(config, "Ese elemento no es un lanzador ni unos frenos de ajuste.");

  const limit = (value: number | undefined, [min, max]: readonly [number, number]) => (value === undefined ? undefined : clamp(value, min, max));
  const [, maxRoom] = xRange(track, index, [0, element.length]);
  const roomLength = maxRoom - element.x + element.length;
  const lengthLimits: [number, number] = [ZONE_LIMITS.length[0], Math.max(element.length, Math.min(ZONE_LIMITS.length[1], roomLength))];
  const length = limit(patch.length, lengthLimits);
  const values = {
    ...(patch.power === undefined ? {} : { power: limit(patch.power, ZONE_LIMITS.power) }),
    ...(patch.maxAcceleration === undefined ? {} : { maxAcceleration: limit(patch.maxAcceleration, ZONE_LIMITS.maxAcceleration) }),
    ...(patch.damping === undefined ? {} : { damping: limit(patch.damping, ZONE_LIMITS.damping) })
  };
  const asked = [patch.length, patch.power, patch.maxAcceleration, patch.damping];
  const got = [length, values.power, values.maxAcceleration, values.damping];
  const limited = asked.some((value, position) => value !== undefined && Math.abs((got[position] ?? value) - value) > 1e-6);
  const from = element.length;
  const target = length === undefined ? from : round(length, 2);

  const edit = lastBuildable(config, t => withElement(track, index, { ...values, length: round(from + (target - from) * t, 2) }), limited);
  return patch.length !== undefined && patch.length > lengthLimits[1] + 1e-6 ? withNeighborReason(edit, true) : edit;
}

/** Agrega un punto en (x, y) metros entre sus vecinos. */
export function insertPoint(config: SimulationConfig, x: number, y: number): { track: TrackElement[]; index: number } | { error: string } {
  const track = config.track;

  if (track.length >= MAX_TRACK_ELEMENTS) return { error: `El trazado ya tiene ${MAX_TRACK_ELEMENTS} elementos: es el máximo.` };

  const at = round(x);
  const index = track.findIndex((element, position) => position > 0 && extent(element)[0] > at);

  if (index <= 0) return { error: "Agregá los puntos entre el inicio y el final del trazado." };
  if (at - extent(track[index - 1])[1] < EDIT_MIN_GAP_M - EPSILON || extent(track[index])[0] - at < EDIT_MIN_GAP_M - EPSILON) {
    return { error: "Está demasiado cerca de otro elemento." };
  }

  const next = withoutLines([...track.slice(0, index), { type: "point", x: at, y: round(clamp(y, 0, MAX_POINT_HEIGHT)) }, ...track.slice(index)]);
  const error = buildError(config, next);

  return error ? { error: explainConfigError(error) } : { track: next, index };
}

/**
 * Forma de una colina nueva cuya media anchura no pase de `room` (m): la
 * por defecto, o achicada (radio y luego altura) sin bajar de los mínimos.
 */
function hillThatFits(height: number, room: number): { height: number; crestRadius: number } | null {
  if (hillHalfWidth(height, DEFAULT_HILL_CREST_RADIUS) <= room) return { height, crestRadius: DEFAULT_HILL_CREST_RADIUS };

  // Media anchura √(6·h·ρ_c) = room, redondeando hacia abajo para no pasarse.
  const floorTo = (value: number) => Math.floor(value * 10) / 10;
  const crestRadius = floorTo((room * room) / (6 * height));
  if (crestRadius >= MIN_INSERT_CREST_RADIUS) return { height, crestRadius };

  const lower = floorTo((room * room) / (6 * MIN_INSERT_CREST_RADIUS));
  return lower >= MIN_INSERT_HILL_HEIGHT ? { height: Math.min(height, lower), crestRadius: MIN_INSERT_CREST_RADIUS } : null;
}

/** Agrega una colina centrada en x: la por defecto o, si no entra, una más chica. */
function insertHill(config: SimulationConfig, x: number): { track: TrackElement[]; index: number } | { error: string } {
  const track = config.track;

  if (track.length >= MAX_TRACK_ELEMENTS) return { error: `El trazado ya tiene ${MAX_TRACK_ELEMENTS} elementos: es el máximo.` };

  const index = track.findIndex((element, position) => position > 0 && extent(element)[0] > x);

  if (index <= 0) return { error: "Agregá la colina entre el inicio y el final del trazado." };

  const room = Math.min(x - extent(track[index - 1])[1], extent(track[index])[0] - x) - EDIT_MIN_GAP_M;
  const shape = hillThatFits(Math.min(DEFAULT_HILL_MAX_HEIGHT, round(config.initialHeight / 2, 1)), room);
  if (!shape) {
    const smallest = 2 * hillHalfWidth(MIN_INSERT_HILL_HEIGHT, MIN_INSERT_CREST_RADIUS);
    return { error: `No hay lugar para una colina junto a este elemento: la más chica mide ${meters(smallest)} m de ancho.` };
  }

  const hill: HillElement = { type: "hill", x: round(x), ...shape };
  const next = withoutLines([...track.slice(0, index), hill, ...track.slice(index)]);
  const error = buildError(config, next);

  return error ? { error: explainConfigError(error) } : { track: next, index };
}

/**
 * Agrega un punto o una colina a mitad de camino hacia el siguiente
 * elemento, o hacia el anterior si después no hay lugar. Es «Agregar punto» y
 * «Agregar colina» de la mini barra (teclado y tacto).
 */
export function insertAfter(config: SimulationConfig, index: number, kind: InsertKind): { track: TrackElement[]; index: number } | { error: string } {
  const track = config.track;
  let lastError =
    kind === "hill" ? "No hay lugar para una colina junto a este elemento." : kind === "point" ? "No hay lugar para otro punto junto a este." : `No hay lugar para ${zoneNoun(kind)} junto a este elemento.`;

  for (const [from, to] of [[index, index + 1], [index - 1, index]]) {
    if (from < 0 || to >= track.length) continue;

    const left = extent(track[from])[1];
    const right = extent(track[to])[0];
    const x = (left + right) / 2;
    const result =
      kind === "hill"
        ? insertHill(config, x)
        : kind === "point"
          ? insertPoint(config, x, (levelOf(config, track[from]) + levelOf(config, track[to])) / 2)
          : insertZone(config, kind, from, to);

    if (!("error" in result)) return result;
    lastError = result.error;
  }

  return { error: lastError };
}

/** Borra un elemento; null para A y E, que no se borran. */
export function removeElement(config: SimulationConfig, index: number): { track: TrackElement[] } | { error: string } | null {
  const track = config.track;
  if (index <= 0 || index >= track.length - 1) return null;

  const next = copy(track.filter((_, position) => position !== index));
  const error = buildError(config, next);
  return error ? { error: `No se puede borrar: ${explainConfigError(error)}` } : { track: next };
}

/** Rango [mín, máx] de un valor del elemento, con los límites del diseño actual. */
export function elementLimits(config: SimulationConfig, index: number, key: ElementKey): [number, number] {
  const track = config.track;
  const element = track[index];

  switch (key) {
    case "x": {
      if (element?.type === "end") return [xRange(track, index)[0], CONFIG_LIMITS.trackWidth[1]];
      return element ? xRange(track, index, reach(element)) : [0, 0];
    }
    case "y":
      return [0, MAX_POINT_HEIGHT];
    case "loopHeight": {
      const [min, max] = CONFIG_LIMITS.loopHeight;
      const radius = element?.type === "point" ? element.loop?.topRadius : undefined;
      return radius === undefined ? [min, max] : [Math.max(min, 2 * radius), Math.min(max, radius / MIN_TOP_RADIUS_FRACTION)];
    }
    case "loopTopRadius": {
      const [min, max] = CONFIG_LIMITS.loopTopRadius;
      const height = element?.type === "point" ? element.loop?.height : undefined;
      return height === undefined ? [min, max] : [Math.max(min, MIN_TOP_RADIUS_FRACTION * height), Math.min(max, height / 2)];
    }
    case "hillHeight":
      return [MIN_HILL_HEIGHT, CONFIG_LIMITS.hillHeight[1]];
    case "hillCrestRadius":
      return [CONFIG_LIMITS.hillCrestRadius[0], CONFIG_LIMITS.hillCrestRadius[1]];
    case "length": {
      if (element?.type !== "booster" && element?.type !== "trim") return [ZONE_LIMITS.length[0], ZONE_LIMITS.length[1]];
      const [, maxStart] = xRange(track, index, [0, element.length]);
      return [ZONE_LIMITS.length[0], Math.max(element.length, Math.min(ZONE_LIMITS.length[1], maxStart - element.x + element.length))];
    }
    case "power":
      return [ZONE_LIMITS.power[0], ZONE_LIMITS.power[1]];
    case "maxAcceleration":
      return [ZONE_LIMITS.maxAcceleration[0], ZONE_LIMITS.maxAcceleration[1]];
    case "damping":
      return [ZONE_LIMITS.damping[0], ZONE_LIMITS.damping[1]];
  }
}

/** Letras de los marcadores por tipo, en orden de avance. */
function markerLetters(track: Track, role: string): string[] {
  return track.markers.filter(marker => marker.role === role).map(marker => marker.label);
}

/**
 * Manijas de todos los elementos (puntos, loops, colinas y E), en metros,
 * con la letra del anexo que marca cada una y un nombre hablado.
 */
export function elementHandles(track: Track, config: SimulationConfig): ElementHandle[] {
  const elements = config.track;
  const loopEntries = markerLetters(track, "loop-entry");
  const loopTops = markerLetters(track, "loop-top");
  const topMarkers = track.markers.filter(marker => marker.role === "loop-top");
  const crestLetters = markerLetters(track, "crest");
  const crestElements = track.nodes.filter(node => node.role === "crest").map(node => node.element);
  const loopCount = elements.filter(element => element.type === "point" && element.loop).length;
  const hillCount = elements.filter(element => element.type === "hill").length;
  const handles: ElementHandle[] = [];
  let loopNumber = 0;
  let hillNumber = 0;

  const crestLetter = (index: number) => {
    const position = crestElements.indexOf(index);
    return position >= 0 ? crestLetters[position] : undefined;
  };

  elements.forEach((element, index) => {
    if (element.type === "point") {
      const loop = element.loop;
      const loopIndex = loop ? loopNumber++ : -1;
      const letter = loop ? loopEntries[loopIndex] : crestLetter(index);
      handles.push({
        id: `point-${index}`,
        kind: "point",
        index,
        x: element.x,
        y: element.y,
        letter,
        name: `Punto ${index + 1}: x ${meters(element.x)} m, altura ${meters(element.y)} m`
      });

      if (!loop) return;

      const marker = topMarkers[loopIndex];
      if (!marker) return;

      const top = geometryAt(track, marker.distance);
      const suffix = loopCount > 1 ? ` ${loopIndex + 1}` : "";
      handles.push(
        { id: `loop-top-${index}`, kind: "loopTop", index, x: top.x, y: top.y, letter: loopTops[loopIndex], name: `Cima del loop ${loopTops[loopIndex] ?? ""}: altura del loop${suffix}`.replace("  ", " "), anchor: { x: top.x, y: element.y } },
        { id: `loop-radius-${index}`, kind: "loopRadius", index, x: top.x + loop.topRadius, y: top.y - loop.topRadius, name: `Radio en la cima del loop${suffix}`, anchor: { x: top.x, y: top.y } }
      );
      return;
    }

    if (element.type === "hill") {
      hillNumber += 1;
      const suffix = hillCount > 1 ? ` ${hillNumber}` : "";
      const letter = crestLetter(index);
      const half = hillHalfWidth(element.height, element.crestRadius);
      handles.push(
        { id: `hill-crest-${index}`, kind: "hillCrest", index, x: element.x, y: element.height, letter, name: `Cresta de la colina ${letter ?? ""}: posición y altura${suffix}`.replace("  ", " ") },
        { id: `hill-radius-${index}`, kind: "hillRadius", index, x: element.x + half, y: 0, name: `Radio de la cresta${suffix}`, anchor: { x: element.x, y: element.height } }
      );
      return;
    }

    if (element.type === "booster" || element.type === "trim") {
      const kind = element.type;
      const name = `${kind === "booster" ? "Lanzador" : "Frenos de ajuste"} ${elements.slice(0, index + 1).filter(candidate => candidate.type === kind).length}`;
      // Una zona que arranca en A no tiene manija de inicio: sería la de A (se mueve desde su panel).
      const atStation = index === 1 && element.x === 0;
      const y = atStation ? config.initialHeight : element.y;
      if (!atStation) {
        handles.push({ id: `zone-start-${index}`, kind: "zoneStart", index, x: element.x, y, name: `${name}: inicio en x ${meters(element.x)} m, altura ${meters(y)} m` });
      }
      handles.push({ id: `zone-end-${index}`, kind: "zoneEnd", index, x: element.x + element.length, y, name: `Fin de ${name}: largo`, anchor: { x: element.x, y } });
      return;
    }

    if (element.type === "end") {
      handles.push({ id: "end", kind: "end", index, x: element.x + APPROACH_LENGTH, y: 0, letter: "E", name: "Inicio de la zona de frenado E: largo de la recta final" });
    }
  });

  return handles;
}

/**
 * Propuesta para arrastrar una manija hasta `point` (m). La cima y los
 * radios se miden desde el inicio del gesto: la cima del loop se corre al
 * cambiar R, y con un loop chico las manijas se dibujan apartadas.
 */
export function proposeElementHandle(config: SimulationConfig, handle: ElementHandle, point: { x: number; y: number }, start?: ElementDragStart): TrackEdit {
  const element = config.track[handle.index];

  switch (handle.kind) {
    case "point":
      return moveElement(config, handle.index, point.x, point.y);
    case "hillCrest":
      return moveElement(config, handle.index, point.x, point.y);
    case "end":
      return moveElement(config, handle.index, point.x - APPROACH_LENGTH);
    case "zoneStart":
      return moveElement(config, handle.index, point.x, point.y);
    case "zoneEnd": {
      const zone = element as ZoneElement;
      const tail = start ? start.handle.x + (point.x - start.point.x) : point.x;
      return setZone(config, handle.index, { length: tail - zone.x });
    }
    case "hillRadius": {
      const hill = element as HillElement;
      const half = start ? start.handle.x - hill.x + (point.x - start.point.x) : point.x - hill.x;
      return setHill(config, handle.index, { crestRadius: half > 0 ? (half * half) / (6 * hill.height) : CONFIG_LIMITS.hillCrestRadius[0] });
    }
    case "loopTop": {
      // La cima cambia h_L con R fijo: se detiene en 2R ≤ h_L ≤ 20R en vez de arrastrar al radio.
      const loop = (element as PointElement).loop;
      const requested = start ? start.handle.y - (start.handle.anchor?.y ?? 0) + (point.y - start.point.y) : point.y - (handle.anchor?.y ?? 0);
      const [min, max] = elementLimits(config, handle.index, "loopHeight");
      const height = clamp(requested, min, max);
      const edit = setPointLoop(config, handle.index, height, loop?.topRadius ?? 0);
      return Math.abs(height - requested) > EPSILON ? { ...edit, limited: true } : edit;
    }
    default: {
      const loop = (element as PointElement).loop;
      const radius = start ? start.handle.x - (start.handle.anchor?.x ?? start.handle.x) + (point.x - start.point.x) : point.x - (handle.anchor?.x ?? 0);
      return setPointLoop(config, handle.index, loop?.height ?? 0, radius);
    }
  }
}
