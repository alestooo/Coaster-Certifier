import { kineticEnergy, potentialEnergy, elasticEnergy } from "./kinematics.js";

/**
 * @typedef {Object} Energies
 * @property {number} kinetic Energía cinética (J).
 * @property {number} gravitational Energía potencial gravitatoria (J).
 * @property {number} elastic Energía potencial elástica (J).
 * @property {number} mechanical Energía mecánica total (J).
 * @property {number} dissipated Energía disipada acumulada (J).
 * @property {number} initial Energía mecánica inicial (J).
 * @property {number} input Trabajo de entrada acumulado W_entrada (lanzadores) (J).
 * @property {number} balanceError E_m + E_disipada − E_inicial − W_entrada (J).
 */

/**
 * Energía mecánica inicial del recorrido evaluado: m·g·H + ½·m·v₀².
 * @param {import("../config.js").SimulationConfig} config
 * @returns {number} Energía (J).
 */
export function initialEnergy(config) {
  return (
    potentialEnergy(config.mass, config.gravity, config.initialHeight) +
    kineticEnergy(config.mass, config.initialSpeed)
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
 * @returns {Energies}
 */
export function calculateEnergies(config, speed, height, compression, dissipated, input = 0) {
  const kinetic = kineticEnergy(config.mass, speed);
  const gravitational = potentialEnergy(config.mass, config.gravity, height);
  const elastic = elasticEnergy(config.springConstant, compression);
  const mechanical = kinetic + gravitational + elastic;
  const initial = initialEnergy(config);

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
