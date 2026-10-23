/**
 * Proyección del trazado físico (metros) a coordenadas SVG.
 * Lo usan el editor de pista y las miniaturas a escala.
 */
import { buildTrack, ConfigError } from "../physics/index.js";
import type { ConfigInput, Track } from "../lib/types";

export type SvgPoint = { x: number; y: number };

export type TrackSvgOk = {
  ok: true;
  track: Track;
  /** Trayectoria de la vía en coordenadas SVG. */
  path: string;
  viewBox: string;
  width: number;
  height: number;
  /** Unidades SVG por metro en horizontal. */
  scale: number;
  /** Factor de exageración vertical aplicado (1 = escala real). */
  verticalScale: number;
  /** Coordenada SVG de la altura y = 0 m. */
  groundY: number;
  /** Coordenada SVG de la posición x = 0 m. */
  originX: number;
  markers: { label: string; name: string; role: string; x: number; y: number; distance: number }[];
  loops: { x: number; y: number; topX: number; topY: number; height: number; topRadius: number }[];
  station: { x: number; y: number; width: number; height: number };
  brake: { x: number; y: number; width: number; height: number };
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  toSvg: (xMetres: number, yMetres: number) => SvgPoint;
  fromSvg: (x: number, y: number) => SvgPoint;
  error?: undefined;
};

export type TrackSvgError = { ok: false; error: string; field?: string };

export type TrackSvgResult = TrackSvgOk | TrackSvgError;

export type TrackSvgOptions = {
  /** Margen alrededor del trazado (m). */
  padding?: number;
  /** Ancho del viewBox en unidades SVG. */
  width?: number;
  /** Altura mínima mostrada (m), para que la escala no salte al editar. */
  minHeight?: number;
  /** Ancho mínimo mostrado (m). */
  minWidth?: number;
  includeStation?: boolean;
  /**
   * Exageración vertical: 1 = escala real; "auto" estira la altura hasta que
   * ocupe una fracción legible del ancho, sin superar `maxVerticalScale`.
   */
  verticalScale?: number | "auto";
  maxVerticalScale?: number;
};

const STATION_HEIGHT = 7;
/** Franja de suelo bajo y = 0, en unidades SVG. */
const GROUND_BAND = 26;
const DEFAULT_WIDTH = 1000;
/** Relación alto/ancho objetivo del dibujo cuando la exageración es automática. */
const TARGET_ASPECT = 0.36;

/** @param {number} value */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Construye el trazado y lo proyecta a un viewBox con la misma escala en x e y.
 */
export function trackToSvg(config: ConfigInput, options: TrackSvgOptions = {}): TrackSvgResult {
  let track: Track;

  try {
    track = buildTrack(config);
  } catch (problem) {
    if (problem instanceof ConfigError) {
      return { ok: false, error: problem.message, field: problem.field };
    }

    return { ok: false, error: problem instanceof Error ? problem.message : "Trazado inválido." };
  }

  const padding = options.padding ?? 6;
  const includeStation = options.includeStation ?? true;
  const width = options.width ?? DEFAULT_WIDTH;

  const minX = Math.min(track.minX, 0) - padding;
  const maxX = Math.max(includeStation ? track.endX + padding : track.brakeX, options.minWidth ?? 0) + padding;
  const maxY = Math.max(track.maxHeight, includeStation ? STATION_HEIGHT : 0, options.minHeight ?? 0) + padding;
  const minY = 0;

  const scale = width / (maxX - minX);
  const requested = options.verticalScale ?? 1;
  const verticalScale =
    requested === "auto"
      ? Math.min(options.maxVerticalScale ?? 3, Math.max(1, (TARGET_ASPECT * width) / (maxY * scale)))
      : Math.max(1, requested);
  const scaleY = scale * verticalScale;
  const height = maxY * scaleY + GROUND_BAND;

  const toSvg = (xMetres: number, yMetres: number): SvgPoint => ({
    x: (xMetres - minX) * scale,
    y: (maxY - yMetres) * scaleY
  });

  const fromSvg = (x: number, y: number): SvgPoint => ({
    x: x / scale + minX,
    y: maxY - y / scaleY
  });

  const path = track.points
    .map((point, index) => {
      const { x, y } = toSvg(point.x, point.y);
      return `${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`;
    })
    .join(" ");

  const ground = toSvg(0, 0);
  const stationStart = toSvg(track.brakeX - 2, STATION_HEIGHT);
  const stationEnd = toSvg(track.endX + 2, 0);
  const brakeStart = toSvg(track.brakeX, 0.8);
  const brakeEnd = toSvg(track.endX, 0);

  return {
    ok: true,
    track,
    path,
    viewBox: `0 0 ${round(width)} ${round(height)}`,
    width,
    height,
    scale,
    verticalScale,
    groundY: ground.y,
    originX: ground.x,
    markers: track.markers.map(marker => {
      const point = nearestPoint(track, marker.distance);
      const position = toSvg(point.x, point.y);
      return { label: marker.label, name: marker.name, role: marker.role, x: position.x, y: position.y, distance: marker.distance };
    }),
    loops: track.loops.map(loop => {
      const base = toSvg(loop.x, loop.y);
      const top = toSvg(loop.x + Math.PI * loop.shape * loop.reference * 0.5, loop.y + loop.height);
      return { x: base.x, y: base.y, topX: top.x, topY: top.y, height: loop.height, topRadius: loop.topRadius };
    }),
    station: { x: stationStart.x, y: stationStart.y, width: stationEnd.x - stationStart.x, height: stationEnd.y - stationStart.y },
    brake: { x: brakeStart.x, y: brakeStart.y, width: brakeEnd.x - brakeStart.x, height: brakeEnd.y - brakeStart.y },
    bounds: { minX, maxX, minY, maxY },
    toSvg,
    fromSvg
  };
}

type DistancedPoint = Track["points"][number] & { distance: number };

/** Punto del trazado más cercano a la coordenada s. */
function nearestPoint(track: Track, distance: number) {
  const points = track.points as DistancedPoint[];
  let best = points[0];
  let bestDelta = Infinity;

  for (const point of points) {
    const delta = Math.abs(point.distance - distance);
    if (delta < bestDelta) {
      best = point;
      bestDelta = delta;
    }
  }

  return best;
}

export type GridLine = { position: number; label: string; major: boolean };

/** Paso de cuadrícula razonable para un rango en metros. */
export function gridStepFor(rangeMetres: number): number {
  if (rangeMetres <= 60) return 5;
  if (rangeMetres <= 150) return 10;
  if (rangeMetres <= 400) return 25;
  return 50;
}

/**
 * Líneas de cuadrícula en metros, con etiqueta en las líneas principales.
 */
export function metresGrid(
  projection: TrackSvgOk,
  step = gridStepFor(projection.bounds.maxX - projection.bounds.minX),
  stepY = gridStepFor(projection.bounds.maxY * 2)
) {
  const { bounds, toSvg } = projection;
  const vertical: GridLine[] = [];
  const horizontal: GridLine[] = [];
  const majorEvery = 2;

  const firstX = Math.ceil(bounds.minX / step) * step;
  for (let x = firstX; x <= bounds.maxX; x += step) {
    const major = Math.round(x / step) % majorEvery === 0;
    vertical.push({ position: toSvg(x, 0).x, label: major ? `${x} m` : "", major });
  }

  for (let y = 0; y <= bounds.maxY; y += stepY) {
    const major = Math.round(y / stepY) % majorEvery === 0;
    horizontal.push({ position: toSvg(0, y).y, label: major && y > 0 ? `${y} m` : "", major });
  }

  return { vertical, horizontal, step, stepY };
}
