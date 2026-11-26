import { formatNumber } from "../ui/format";
import type { Verdict } from "./types";

export type DesignCheck = Verdict["designChecks"][number];

/** Cómo se escribe la comparación de cada condición (unidad y palabras). */
const DETAIL: { prefix: string; write: (actual: string, limit: string) => string; digits: number }[] = [
  { prefix: "loop-", digits: 2, write: (actual, limit) => `${actual} m frente a ${limit} m requeridos` },
  { prefix: "crest-", digits: 2, write: (actual, limit) => `${actual} m frente a ${limit} m de la cresta` },
  { prefix: "brake-capacity", digits: 1, write: (actual, limit) => `v_E² ideal ${actual} m²/s² frente a ${limit} m²/s² disponibles` },
  { prefix: "brake-comfort", digits: 2, write: (actual, limit) => `${actual} m/s² frente a ${limit} m/s²` },
  { prefix: "spring-capacity", digits: 2, write: (actual, limit) => `${actual} m frente a ${limit} m permitidos` }
];

/**
 * Nombre y detalle de una condición de diseño, con coma decimal. La física
 * entrega los números (`actual`, `limit`); el texto con punto queda para el
 * script headless.
 */
export function designCheckText(check: DesignCheck): { name: string; detail: string } {
  const rule = DETAIL.find(candidate => check.id.startsWith(candidate.prefix));
  if (!rule) return { name: check.name, detail: check.detail };

  return {
    name: check.name,
    detail: rule.write(formatNumber(check.actual, rule.digits), formatNumber(check.limit, rule.digits))
  };
}
