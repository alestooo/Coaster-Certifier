/**
 * Tema de las gráficas a partir de los tokens del sistema de diseño. El
 * canvas no entiende var(--token): aquí se resuelve al valor calculado.
 */

const VAR_REFERENCE = /^var\((--[\w-]+)\)$/;

/** Valores de respaldo si el documento no está (pruebas) o el token falta. */
const FALLBACK = Object.freeze({ font: "system-ui, sans-serif", text: "#7a6b89", grid: "#eee6f5" });

/**
 * Lee un token del documento.
 * @param {string} name
 * @returns {string}
 */
export function readCssVar(name) {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Color listo para el canvas: «var(--x)» pasa a su valor; lo demás queda igual.
 * @param {string} color
 * @param {(name: string) => string} [read]
 * @returns {string}
 */
export function resolveColor(color, read = readCssVar) {
  const match = VAR_REFERENCE.exec(color);
  if (!match) return color;
  return read(match[1]) || color;
}

/**
 * Fuente, color del texto de los ejes y de la grilla.
 * @param {(name: string) => string} [read]
 * @returns {{font: string, text: string, grid: string}}
 */
export function readChartTheme(read = readCssVar) {
  return {
    font: read("--font-sans") || FALLBACK.font,
    text: read("--muted") || FALLBACK.text,
    grid: read("--border") || FALLBACK.grid
  };
}
