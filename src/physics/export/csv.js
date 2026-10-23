/**
 * Exportación del historial de estados a CSV.
 * No depende del navegador: la usan el script headless y la interfaz.
 */

/**
 * Columnas exportadas, con unidad en el encabezado.
 * @type {ReadonlyArray<{key: string, header: string, read: (state: any) => number | string}>}
 */
export const CSV_COLUMNS = Object.freeze([
  { key: "time", header: "t_s", read: state => state.time },
  { key: "distance", header: "s_m", read: state => state.distance },
  { key: "x", header: "x_m", read: state => state.position.x },
  { key: "y", header: "y_m", read: state => state.position.y },
  { key: "velocity", header: "v_mps", read: state => state.velocity },
  { key: "speed", header: "rapidez_mps", read: state => state.speed },
  { key: "angle", header: "theta_rad", read: state => state.angle },
  { key: "curvature", header: "kappa_1pm", read: state => state.curvature },
  { key: "tangentialAcceleration", header: "a_t_mps2", read: state => state.tangentialAcceleration },
  { key: "normalAcceleration", header: "a_n_mps2", read: state => state.normalAcceleration },
  { key: "normal", header: "N_N", read: state => state.forces.normal },
  { key: "load", header: "carga_g", read: state => state.load },
  { key: "friction", header: "friccion_N", read: state => state.forces.friction },
  { key: "spring", header: "resorte_N", read: state => state.forces.spring },
  { key: "damper", header: "amortiguador_N", read: state => state.forces.damper },
  { key: "brake", header: "freno_N", read: state => state.forces.brake },
  { key: "compression", header: "compresion_m", read: state => state.springCompression },
  { key: "kinetic", header: "E_cinetica_J", read: state => state.energies.kinetic },
  { key: "gravitational", header: "E_potencial_J", read: state => state.energies.gravitational },
  { key: "elastic", header: "E_elastica_J", read: state => state.energies.elastic },
  { key: "mechanical", header: "E_mecanica_J", read: state => state.energies.mechanical },
  { key: "dissipated", header: "E_disipada_J", read: state => state.energies.dissipated },
  { key: "balanceError", header: "error_balance_J", read: state => state.energies.balanceError },
  { key: "section", header: "tramo", read: state => state.section },
  { key: "status", header: "estado", read: state => state.status }
]);

/**
 * @param {number | string} value
 * @param {number} precision
 */
function formatCell(value, precision) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toPrecision(precision) : "";
  }

  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Convierte un historial de estados en texto CSV.
 *
 * @param {ReadonlyArray<any>} history Estados consecutivos.
 * @param {{separator?: string, precision?: number}} [options]
 * @returns {string} Texto CSV con encabezado.
 */
export function toCsv(history, options = {}) {
  const separator = options.separator ?? ",";
  const precision = options.precision ?? 9;

  const header = CSV_COLUMNS.map(column => column.header).join(separator);

  const rows = history.map(state =>
    CSV_COLUMNS.map(column => formatCell(column.read(state), precision)).join(separator)
  );

  return [header, ...rows].join("\n") + "\n";
}
