/**
 * Perfil de fuerza g a lo largo de la vía, para teñir la pista con la
 * exigencia sobre los pasajeros (como la franja de intensidad de los
 * editores de montañas rusas). Puro: recibe el historial auditado.
 */
import { geometryAt } from "../physics/index.js";
import { NEAR_LIMIT_FRACTION, LOW_G_MARGIN } from "./audit";
import { formatNumber, formatSigned } from "../ui/format";
import type { SimulationConfig, SimulationState, Track } from "./types";

export interface LoadBin {
  /** Inicio y fin del tramo en coordenada s (m). */
  from: number;
  to: number;
  /** Fuerza g mínima y máxima registradas en el tramo. */
  min: number;
  max: number;
  /** El tramo está dentro de un loop, donde perder el contacto se rechaza siempre. */
  loop: boolean;
}

export type LoadTone = "comfort" | "near" | "over" | "float";

export interface RibbonRun {
  tone: LoadTone;
  from: number;
  to: number;
  /** Puntos de la vía (m) con su inclinación, para desplazar la franja hacia adentro. */
  points: { x: number; y: number; angle: number }[];
}

/** Largo de cada tramo del perfil (m). */
export const LOAD_BIN_M = 0.5;

const EPSILON = 1e-6;

/**
 * Fuerza g mínima y máxima por tramo de `binSize` metros. Cada par de
 * estados consecutivos aporta a todos los tramos que recorre, así no hay
 * huecos aunque el tren avance más de un tramo entre muestras.
 */
export function loadProfile(history: readonly SimulationState[], track: Track, binSize = LOAD_BIN_M): LoadBin[] {
  const total = track.totalLength;
  const count = Math.max(1, Math.ceil(total / binSize));
  const mins = new Array<number>(count).fill(Infinity);
  const maxs = new Array<number>(count).fill(-Infinity);
  const clampDistance = (distance: number) => Math.min(total, Math.max(0, distance));

  function touch(a: number, b: number, loads: number[]) {
    const first = Math.min(count - 1, Math.floor(a / binSize));
    const last = Math.min(count - 1, Math.floor(b / binSize));
    const low = Math.min(...loads);
    const high = Math.max(...loads);

    for (let index = first; index <= last; index++) {
      mins[index] = Math.min(mins[index], low);
      maxs[index] = Math.max(maxs[index], high);
    }
  }

  if (history.length === 1) {
    const only = clampDistance(history[0].distance);
    touch(only, only, [history[0].load]);
  }

  for (let index = 1; index < history.length; index++) {
    const before = history[index - 1];
    const after = history[index];
    const a = clampDistance(before.distance);
    const b = clampDistance(after.distance);
    touch(Math.min(a, b), Math.max(a, b), [before.load, after.load]);
  }

  const loops = track.sections.filter(section => section.kind === "loop");
  const inLoop = (from: number, to: number) => loops.some(section => from < section.end && to > section.start);

  return mins.flatMap((min, index) => {
    if (!Number.isFinite(min)) return [];

    const from = index * binSize;
    const to = Math.min(total, (index + 1) * binSize);
    return [{ from, to, min, max: maxs[index], loop: inLoop(from, to) }];
  });
}

/**
 * Tono de un tramo según los límites de la certificación (el peor gana).
 * En un loop, N ≤ 0 se rechaza con cualquier modelo de contacto.
 */
export function loadTone(bin: Pick<LoadBin, "min" | "max"> & { loop?: boolean }, config: SimulationConfig): LoadTone {
  const strict = config.contactModel === "strict" || bin.loop === true;
  const belowLimit = (strict && bin.min <= 0) || (config.contactModel !== "strict" && bin.min < config.minLoad);

  if (bin.max > config.maxLoad || belowLimit) return "over";
  if (bin.max >= NEAR_LIMIT_FRACTION * config.maxLoad) return "near";
  if (bin.min < LOW_G_MARGIN) return "float";
  return "comfort";
}

/** Une tramos contiguos del mismo tono y les asigna la forma de la vía. */
export function ribbonRuns(profile: readonly LoadBin[], track: Track, config: SimulationConfig): RibbonRun[] {
  const spans: { tone: LoadTone; from: number; to: number }[] = [];

  for (const bin of profile) {
    const tone = loadTone(bin, config);
    const last = spans.at(-1);

    if (last && last.tone === tone && Math.abs(last.to - bin.from) < EPSILON) {
      spans[spans.length - 1] = { ...last, to: bin.to };
    } else {
      spans.push({ tone, from: bin.from, to: bin.to });
    }
  }

  return spans.map(span => {
    const pointAt = (distance: number) => {
      const point = geometryAt(track, distance);
      return { x: point.x, y: point.y, angle: point.angle };
    };
    const inside = track.points
      .filter(point => point.distance > span.from + EPSILON && point.distance < span.to - EPSILON)
      .map(point => ({ x: point.x, y: point.y, angle: point.angle }));

    return { ...span, points: [pointAt(span.from), ...inside, pointAt(span.to)] };
  });
}

export interface LegendItem {
  tone: LoadTone;
  /** Qué significa el color. */
  text: string;
  /** Umbral en g (se muestra como ayuda). */
  detail: string;
}

/**
 * Textos de la leyenda con los límites vigentes, con la misma comparación que
 * el motor: «siempre apoyado» rechaza N ≤ 0; las ruedas, n < n_mín.
 */
export function legendItems(config: SimulationConfig): LegendItem[] {
  const lower = config.contactModel === "strict" ? "≤ 0 g" : `< ${formatSigned(config.minLoad, 1)} g`;
  const near = NEAR_LIMIT_FRACTION * config.maxLoad;

  return [
    { tone: "comfort", text: "cómoda", detail: `entre ${formatNumber(LOW_G_MARGIN, 1)} g y ${formatNumber(near, 1)} g` },
    { tone: "near", text: "cerca del límite", detail: `≥ ${formatNumber(near, 1)} g` },
    { tone: "over", text: "fuera del límite", detail: `> ${formatNumber(config.maxLoad, 1)} g o ${lower}` },
    { tone: "float", text: "casi sin peso", detail: `< ${formatNumber(LOW_G_MARGIN, 1)} g` }
  ];
}
