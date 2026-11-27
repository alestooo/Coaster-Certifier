/**
 * «1. Resultado» del informe, en el español de la interfaz (coma decimal).
 *
 * La librería arma frases propias con punto decimal para el script headless;
 * acá se escriben a partir de los mismos datos con `formatNumber`.
 */
import { formatNumber } from "../ui/format";
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
    }
  });
}
