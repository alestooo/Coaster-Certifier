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
