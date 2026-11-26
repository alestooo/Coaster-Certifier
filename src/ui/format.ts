/** Formato numérico en español de Costa Rica para la interfaz. */

const formatters = new Map<number, Intl.NumberFormat>();

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";

  let formatter = formatters.get(digits);

  if (!formatter) {
    formatter = new Intl.NumberFormat("es-CR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
    formatters.set(digits, formatter);
  }

  return formatter.format(value);
}

export function formatWithUnit(value: number | null | undefined, unit: string, digits = 2): string {
  const text = formatNumber(value, digits);
  return unit ? `${text} ${unit}` : text;
}

export function formatSeconds(value: number | null | undefined): string {
  return formatWithUnit(value, "s", 3);
}

export function kmh(metersPerSecond: number): number {
  return metersPerSecond * 3.6;
}

/** Signo menos tipográfico (U+2212), el de los textos de física. */
const MINUS = "−";
/** Un número con coma o punto decimal (sin exponente ni separador de miles). */
const DECIMAL = /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;
const J_PER_KJ = 1000;

/**
 * Número escrito por una persona: acepta coma o punto decimal y el signo «−».
 * Devuelve null si no es un número legible (vacío, letras, exponentes, dos comas).
 */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replaceAll(MINUS, "-").replace(/\s+/g, "");
  if (!DECIMAL.test(normalized)) return null;

  const value = Number(normalized.replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return value === 0 ? 0 : value;
}

/** Como `formatNumber`, pero con el signo menos tipográfico. */
export function formatSigned(value: number, digits = 2): string {
  return formatNumber(value, digits).replace("-", MINUS);
}

/** Rapidez: m/s como dato principal (unidad del modelo) y km/h como referencia. */
export function formatSpeed(metersPerSecond: number): { main: string; secondary: string } {
  return { main: formatWithUnit(metersPerSecond, "m/s", 1), secondary: formatWithUnit(kmh(metersPerSecond), "km/h", 0) };
}

/** Energía en kJ, la unidad de la interfaz (el CSV sigue en J). */
export function formatEnergy(joules: number, digits = 1): string {
  return formatWithUnit(joules / J_PER_KJ, "kJ", digits);
}

/** Separa el símbolo del anexo en base y subíndice: «h_L» → h con subíndice L. */
export function symbolParts(symbol: string): { base: string; sub?: string } {
  const separator = symbol.indexOf("_");
  return separator > 0 ? { base: symbol.slice(0, separator), sub: symbol.slice(separator + 1) } : { base: symbol };
}

const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** Notación científica con coma: 0,0502 → «5,02·10⁻²» (exponente en superíndice). */
export function formatScientific(value: number, digits = 2): string {
  if (value === 0) return "0";

  const [mantissa, exponent] = value.toExponential(digits).split("e");
  const power = Number(exponent);
  const sign = power < 0 ? "⁻" : "";
  const superscript = String(Math.abs(power)).replace(/\d/g, digit => SUPERSCRIPT_DIGITS[Number(digit)]);

  return `${formatSigned(Number(mantissa), digits)}·10${sign}${superscript}`;
}
