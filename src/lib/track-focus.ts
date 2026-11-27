import { areaForSection, type AreaId } from "./audit";
import type { Track } from "./types";

export interface DistanceRange {
  from: number;
  to: number;
}

/** Une tramos contiguos en rangos de coordenada s. */
function mergeRanges(ranges: DistanceRange[]): DistanceRange[] {
  const merged: DistanceRange[] = [];

  for (const range of [...ranges].sort((a, b) => a.from - b.from)) {
    const last = merged[merged.length - 1];

    if (last && range.from <= last.to + 1e-6) {
      merged[merged.length - 1] = { from: last.from, to: Math.max(last.to, range.to) };
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

/**
 * Tramos de la vía que controla un grupo del panel de diseño, para
 * resaltarlos en el lienzo mientras se edita ese grupo.
 */
export function focusRanges(track: Track, area: AreaId | null): DistanceRange[] {
  if (!area || area === "criteria" || area === "numeric") return [];
  if (area === "braking") return [{ from: track.brakeStart, to: track.totalLength }];
  if (area === "layout") return [{ from: 0, to: track.brakeStart }];

  const sections = track.sections.filter(
    section => section.end <= track.brakeStart + 1e-6 && areaForSection(section.name) === area
  );

  return mergeRanges(sections.map(section => ({ from: section.start, to: section.end })));
}

/** Tramos de la vía de un elemento del trazado (su loop incluido), para resaltarlo mientras está elegido. */
export function elementRanges(track: Track, index: number | null): DistanceRange[] {
  if (index === null) return [];

  return mergeRanges(
    track.sections
      .filter(section => section.element === index && section.end <= track.stationStart + 1e-6)
      .map(section => ({ from: section.start, to: section.end }))
  );
}
