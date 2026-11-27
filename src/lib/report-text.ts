/**
 * «1. Resultado» del informe, en el español de la interfaz (coma decimal).
 *
 * La librería arma frases propias con punto decimal para el script headless;
 * acá se escriben a partir de los mismos datos con `formatNumber`.
 */
import { formatNumber } from "../ui/format";
import { liftMetrics, resolveConfig, SCENARIOS } from "../physics/index.js";
import { mapName, mapTemplate } from "../game/maps";
import type { SimulationConfig, Verdict } from "./types";

/** Un límite de la regla: sin decimales si es entero (-1, 5), con ellos si no (4,5). */
function limit(value: number): string {
  return formatNumber(value, Number.isInteger(value) ? 0 : 2);
}

/**
 * La regla de fuerza g con la que se juzgó, igual que el motor: «siempre apoyado»
 * exige N > 0 (no usa n_mín); con ruedas anti-levantamiento vale el intervalo.
 */
function loadRule(config: SimulationConfig): string {
  return config.contactModel === "strict"
    ? `mayor que 0 g (siempre apoyado) y hasta ${limit(config.maxLoad)} g`
    : `entre ${limit(config.minLoad)} y ${limit(config.maxLoad)} g`;
}

export function resultLines(verdict: Verdict, finalDistance: number, config: SimulationConfig): string[] {
  if (verdict.approved) {
    const { maxLoad, minLoad, minNormal } = verdict.summary;
    return [
      `El tren completó el recorrido y quedó detenido a ${formatNumber(finalDistance, 2)} m, dentro de la zona de frenado.`,
      `Fuerza g máxima ${formatNumber(maxLoad.value, 2)} g y mínima ${formatNumber(minLoad.value, 2)} g, ${loadRule(config)}.`,
      `Fuerza normal mínima ${formatNumber(minNormal.value, 0)} N, en ${minNormal.section}.`
    ];
  }

  return verdict.violations.map(
    violation =>
      `${violation.condition}: ${formatNumber(violation.value, 3)} ${violation.unit} ` +
      `(límite ${violation.comparison} ${formatNumber(violation.limit, 3)} ${violation.unit}) ` +
      `en ${violation.section}, s = ${formatNumber(violation.position, 2)} m, t = ${formatNumber(violation.time, 3)} s.`
  );
}

export interface ElementRow {
  type: string;
  x: string;
  height: string;
  /** Loop o colina, en palabras (sin símbolos con guion bajo). */
  detail: string;
}

/** Número compacto: sin decimales si es entero, si no con 1 o 2. */
function compact(value: number): string {
  const digits = Number.isInteger(value) ? 0 : Number.isInteger(Math.round(value * 1e6) / 1e5) ? 1 : 2;
  return formatNumber(value, digits);
}

const metres = (value: number) => `${formatNumber(value, 1)} m`;

/** Filas de la tabla de elementos del informe: tipo, x, altura y su loop o colina. */
export function elementRows(config: SimulationConfig): ElementRow[] {
  return config.track.map(element => {
    switch (element.type) {
      case "start":
        return { type: "Inicio A", x: metres(0), height: metres(config.initialHeight), detail: "" };
      case "point":
        return {
          type: "Punto",
          x: metres(element.x),
          height: metres(element.y),
          detail: element.loop ? `loop de ${compact(element.loop.height)} m · radio en la cima ${compact(element.loop.topRadius)} m` : ""
        };
      case "hill":
        return { type: "Colina", x: metres(element.x), height: metres(element.height), detail: `radio de la cresta ${compact(element.crestRadius)} m` };
      case "end":
        return { type: "Final", x: metres(element.x), height: metres(0), detail: "" };
      case "booster":
        return {
          type: "Lanzador",
          x: metres(element.x),
          height: metres(element.y),
          detail: `${compact(element.length)} m de largo · ${compact(element.power / 1000)} kW · hasta ${compact(element.maxAcceleration)} m/s²`
        };
      case "trim":
        return { type: "Frenos de ajuste", x: metres(element.x), height: metres(element.y), detail: `${compact(element.length)} m de largo · c = ${compact(element.damping)} N·s/m` };
    }
  });
}

/** La subida por cadena en una línea: ángulo, cadena, motor y tiempo; o «sin subida». */
export function liftText(config: SimulationConfig): string {
  const metrics = liftMetrics(config);
  const start = config.track[0];
  const lift = start?.type === "start" ? start.lift : undefined;
  if (!metrics || !lift) {
    const launched = config.track.some(element => element.type === "booster");
    return launched ? "Sin subida por cadena (montaña rusa lanzada)" : "Sin subida por cadena";
  }

  const degrees = (lift.angle * 180) / Math.PI;
  return (
    `${formatNumber(degrees, 1)}° · ${formatNumber(metrics.length, 1)} m a ${formatNumber(lift.chainSpeed, 1)} m/s (${formatNumber(metrics.time, 0)} s) · ` +
    `motor de ${formatNumber(metrics.power / 1000, 1)} kW con η = ${formatNumber(lift.efficiency * 100, 0)} % · ${formatNumber(metrics.energy / 1000, 0)} kJ`
  );
}

export interface EnergyRow {
  label: string;
  value: string;
  detail: string;
}

/**
 * Filas de energía del informe: la inicial, la de entrada de los lanzadores
 * (si hubo) y la disipada y el error de balance como fracción de la energía
 * disponible E₀ + W_entrada.
 */
export function energyRows(summary: Verdict["summary"], trainCars = 1): EnergyRow[] {
  const input = Math.max(0, summary.inputEnergy ?? 0);
  const chain = summary.chainEnergy ?? 0;
  const available = summary.initialEnergy + input + chain;
  const base = input + chain !== 0 ? "de la disponible (E₀ + W_entrada)" : "de la inicial";
  const share = (value: number) => (available > 0 ? (100 * value) / available : 0);

  return [
    {
      label: "Energía inicial",
      value: `${formatNumber(summary.initialEnergy, 0)} J`,
      detail: trainCars > 1 ? "m·g·ȳ₀ + ½·m·v₀² (centro de masa al salir)" : "m·g·H + ½·m·v₀²"
    },
    ...(input > 0 ? [{ label: "Energía de entrada (lanzadores)", value: `${formatNumber(input, 0)} J`, detail: "W_entrada = ∫F_lanzador·v dt" }] : []),
    ...(chain !== 0 ? [{ label: "Trabajo de la cadena (carros en la subida)", value: `${formatNumber(chain, 0)} J`, detail: "la cadena sostiene al tren a v_c mientras tiene carros" }] : []),
    { label: "Energía disipada", value: `${formatNumber(summary.dissipatedEnergy, 0)} J`, detail: `${formatNumber(share(summary.dissipatedEnergy), 1)} % ${base}` }
  ];
}

/** Elementos de un diseño, para compararlos; null si la entrada no es válida. */
function trackKey(input: Parameters<typeof resolveConfig>[0]): string | null {
  try {
    return JSON.stringify(resolveConfig(input).track);
  } catch {
    return null;
  }
}

/**
 * Nombre del diseño para el informe y las descargas: el del trazado si sus
 * elementos son los de la plantilla, el del escenario de referencia si es uno
 * sin tocar, o «Diseño basado en …» si se editaron.
 */
export function designName(config: SimulationConfig): string {
  const base = mapName(config.mapId);
  const key = JSON.stringify(config.track);
  if (trackKey(mapTemplate(config.mapId)) === key) return base;

  const scenario = SCENARIOS.find(item => item.config.mapId === config.mapId && trackKey(item.config) === key);
  return scenario ? scenario.title : `Diseño basado en «${base}»`;
}

