// Responsable: Alejandro.
// Parámetros de la demostración inicial. Todas las unidades son SI.

export const DEFAULT_CONFIG = Object.freeze({
  mass: 500,             // kg
  gravity: 9.81,          // m/s²
  initialHeight: 20,     // m
  trackLength: 80,       // m medidos sobre la pendiente
  timeStep: 0.01,        // s
});

export function validateConfig(config) {
  for (const [name, value] of Object.entries(DEFAULT_CONFIG)) {
    if (!Number.isFinite(config[name])) {
      throw new Error(`El parámetro ${name} debe ser un número finito.`);
    }
  }

  if (config.mass <= 0 || config.gravity <= 0) {
    throw new Error("La masa y la gravedad deben ser positivas.");
  }

  if (
    config.initialHeight <= 0 ||
    config.trackLength <= config.initialHeight
  ) {
    throw new Error("La longitud debe ser mayor que la altura inicial.");
  }

  if (config.timeStep <= 0) {
    throw new Error("El paso de tiempo debe ser positivo.");
  }
}