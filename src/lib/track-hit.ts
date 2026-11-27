/**
 * Prueba de impacto sobre la vía: qué punto del trazado está bajo el
 * puntero y a qué parte del diseño pertenece.
 */
import { areaForSection, type AreaId } from "./audit";
import { focusRanges } from "./track-focus";
import type { Track } from "./types";

export interface TrackHit {
  /** Coordenada s del punto más cercano (m). */
  distance: number;
  /** Distancia euclídea del punto pedido a la vía (m). */
  gap: number;
  x: number;
  y: number;
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Margen alrededor de un área al encuadrarla (m). */
const AREA_MARGIN_M = 3;

/** Punto de la vía más cercano a (x, y), proyectando sobre la polilínea de dibujo. */
export function nearestTrackPoint(track: Track, x: number, y: number): TrackHit {
  const points = track.points;
  let best: TrackHit = { distance: 0, gap: Infinity, x: points[0].x, y: points[0].y };

  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared)) : 0;
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const gap = Math.hypot(x - px, y - py);

    if (gap < best.gap) {
      best = { distance: a.distance + t * (b.distance - a.distance), gap, x: px, y: py };
    }
  }

  return best;
}

/** Parte del diseño que controla el tramo en la coordenada s. */
export function areaAtDistance(track: Track, distance: number): AreaId {
  if (distance >= track.stationStart - 1e-6) return "braking";

  const section = track.sections.find(candidate => distance >= candidate.start && distance <= candidate.end);
  return section ? areaForSection(section.name) : "layout";
}

/**
 * Elemento del trazado dueño del tramo en la coordenada s: el loop es de su
 * punto, los tramos de la colina de la colina y el resto del elemento al que
 * llegan. La caída inicial y la llegada con el frenado no son de un elemento
 * (null): siguen abriendo las áreas «Salida» y «Frenado».
 */
export function elementAtDistance(track: Track, distance: number): number | null {
  if (distance >= track.stationStart - 1e-6) return null;

  const section = track.sections.find(candidate => distance >= candidate.start && distance <= candidate.end);
  if (!section || areaForSection(section.name) === "start") return null;
  // El primer tramo es la caída (área «Salida»), salvo que sea un lanzador o unos frenos que arrancan en A.
  if (section.index === 0 && areaForSection(section.name) !== "zone") return null;
  return section.element ?? null;
}

/** Caja (m) que encierra los tramos de un área, con margen; null si el área no está en la vía. */
export function areaBounds(track: Track, area: AreaId): WorldBounds | null {
  const ranges = focusRanges(track, area);

  if (!ranges.length) return null;

  const inside = track.points.filter(point => ranges.some(range => point.distance >= range.from - 1e-6 && point.distance <= range.to + 1e-6));

  if (!inside.length) return null;

  const xs = inside.map(point => point.x);
  const ys = inside.map(point => point.y);

  return {
    minX: Math.min(...xs) - AREA_MARGIN_M,
    maxX: Math.max(...xs) + AREA_MARGIN_M,
    minY: Math.min(0, ...ys),
    maxY: Math.max(...ys) + AREA_MARGIN_M
  };
}
