import { kineticEnergy, potentialEnergy, elasticEnergy } from "./kinematics.js";

/**
 * @typedef {Object} Energies
 * @property {number} kinetic Energía cinética (J).
 * @property {number} gravitational Energía potencial gravitatoria (J).
 * @property {number} elastic Energía potencial elástica (J).
 * @property {number} mechanical Energía mecánica total (J).
 * @property {number} dissipated Energía disipada acumulada (J).
 * @property {number} initial Energía mecánica inicial (J).
 * @property {number} balanceError E_m + E_disipada − E_inicial (J).
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
 * @returns {Energies}
 */
export function calculateEnergies(config, speed, height, compression, dissipated) {
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
    balanceError: mechanical + dissipated - initial
  };
}
