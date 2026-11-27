import { kineticEnergy, potentialEnergy, elasticEnergy } from "./kinematics.js";

/**
 * @typedef {Object} Energies
 * @property {number} kinetic Energía cinética (J).
 * @property {number} gravitational Energía potencial gravitatoria (J).
 * @property {number} elastic Energía potencial elástica (J).
 * @property {number} mechanical Energía mecánica total (J).
 * @property {number} dissipated Energía disipada acumulada (J).
 * @property {number} initial Energía mecánica inicial (J).
 * @property {number} input Trabajo de entrada acumulado de los lanzadores (J).
 * @property {number} [chainWork] Trabajo de la cadena sobre los carros que siguen en la subida (tren articulado) (J).
 * @property {number} balanceError E_m + E_disipada − E_inicial − W_entrada (J).
 */

/**
 * Energía mecánica inicial del recorrido evaluado: m·g·H + ½·m·v₀² (con el
 * tren articulado, H es la altura del centro de masa al salir).
 * @param {import("../config.js").SimulationConfig} config
 * @param {number} [startHeight]
 * @param {number} [startSpeed]
 * @returns {number} Energía (J).
 */
export function initialEnergy(config, startHeight = config.initialHeight, startSpeed = config.initialSpeed) {
  return (
    potentialEnergy(config.mass, config.gravity, startHeight) +
    kineticEnergy(config.mass, startSpeed)
  );
}

/**
 * Balance energético del tren en un instante.
 *
 * @param {import("../config.js").SimulationConfig} config
 * @param {number} speed Rapidez (m/s).
 * @param {number} height Altura y (m).
 * @param {number} compression Compresión del resorte (m).
 * @param {number} dissipated Energía disipada acumulada (J).
 * @param {number} [input] Trabajo de entrada acumulado (J).
 * @param {number} [startHeight] Altura del centro de masa al salir (m); la de A para la partícula.
 * @param {number} [startSpeed] Rapidez al salir (m/s); v₀ para la partícula.
 * @returns {Energies}
 */
export function calculateEnergies(config, speed, height, compression, dissipated, input = 0, startHeight = config.initialHeight, startSpeed = config.initialSpeed) {
  const kinetic = kineticEnergy(config.mass, speed);
  const gravitational = potentialEnergy(config.mass, config.gravity, height);
  const elastic = elasticEnergy(config.springConstant, compression);
  const mechanical = kinetic + gravitational + elastic;
  const initial = initialEnergy(config, startHeight, startSpeed);

  return {
    kinetic,
    gravitational,
    elastic,
    mechanical,
    dissipated,
    initial,
    input,
    // Sin lanzadores W_entrada = 0 y el balance es exactamente el de siempre.
    balanceError: input === 0 ? mechanical + dissipated - initial : mechanical + dissipated - initial - input
  };
}
