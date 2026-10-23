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
