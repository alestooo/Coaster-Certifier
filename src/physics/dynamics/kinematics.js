/**
 * Relaciones cinemáticas y dinámicas elementales del modelo.
 *
 * Todas las funciones son puras y trabajan en unidades del SI.
 * Corresponden a las funciones planificadas en el Avance 1
 * (CalcularFuerzaNormal, CalcularFuerzaG, CalcularEnergiaCinetica, …).
 */

/**
 * Fuerza normal requerida para que el tren siga la vía:
 * N = m·(g·cos θ + κ·v²). Positiva cuando la vía empuja al tren.
 *
 * @param {number} mass Masa (kg).
 * @param {number} gravity Gravedad (m/s²).
 * @param {number} angle Inclinación θ de la tangente (rad).
 * @param {number} curvature Curvatura con signo κ (1/m).
 * @param {number} speed Rapidez (m/s).
 * @returns {number} Fuerza normal (N).
 */
export function normalForce(mass, gravity, angle, curvature, speed) {
  return mass * (gravity * Math.cos(angle) + curvature * speed * speed);
}

/**
 * Carga percibida por los pasajeros n = N / (m·g).
 * @param {number} normal Fuerza normal (N).
 * @param {number} mass Masa (kg).
 * @param {number} gravity Gravedad (m/s²).
 * @returns {number} Carga (g, adimensional).
 */
export function loadFactor(normal, mass, gravity) {
  return normal / (mass * gravity);
}

/**
 * Aceleración normal o centrípeta con signo a_n = κ·v².
 * @param {number} speed Rapidez (m/s).
 * @param {number} curvature Curvatura (1/m).
 * @returns {number} Aceleración normal (m/s²).
 */
export function normalAcceleration(speed, curvature) {
  return curvature * speed * speed;
}

/**
 * Segunda ley de Newton en la dirección tangencial: a_t = F_t / m.
 * @param {number} tangentialForce Suma de fuerzas tangenciales (N).
 * @param {number} mass Masa (kg).
 * @returns {number} Aceleración tangencial (m/s²).
 */
export function tangentialAcceleration(tangentialForce, mass) {
  return tangentialForce / mass;
}

/**
 * Componente tangencial del peso: −m·g·sin θ.
 * @param {number} mass Masa (kg).
 * @param {number} gravity Gravedad (m/s²).
 * @param {number} angle Inclinación (rad).
 * @returns {number} Fuerza (N), positiva en el sentido de avance.
 */
export function gravityTangential(mass, gravity, angle) {
  return -mass * gravity * Math.sin(angle);
}

/**
 * Magnitud de la fricción cinética f = μ·|N|.
 * @param {number} friction Coeficiente μ (adimensional).
 * @param {number} contactNormal Normal de contacto válida (N, ≥ 0).
 * @returns {number} Fuerza de fricción (N).
 */
export function frictionMagnitude(friction, contactNormal) {
  return friction * contactNormal;
}

/**
 * Fuerza restauradora del resorte F = −k·x (ley de Hooke).
 * @param {number} springConstant Constante k (N/m).
 * @param {number} compression Compresión x (m, ≥ 0).
 * @returns {number} Fuerza (N), opuesta al avance.
 */
export function springForce(springConstant, compression) {
  return -springConstant * compression;
}

/**
 * Fuerza del amortiguador viscoso F = −c·v, activa solo con el resorte comprimido.
 * @param {number} damping Coeficiente c (N·s/m).
 * @param {number} velocity Velocidad tangencial (m/s).
 * @param {number} compression Compresión (m).
 * @returns {number} Fuerza (N).
 */
export function damperForce(damping, velocity, compression) {
  return compression > 0 ? -damping * velocity : 0;
}

/** @param {number} mass @param {number} speed @returns {number} E_c = ½·m·v² (J). */
export function kineticEnergy(mass, speed) {
  return 0.5 * mass * speed * speed;
}

/** @param {number} mass @param {number} gravity @param {number} height @returns {number} E_p = m·g·h (J). */
export function potentialEnergy(mass, gravity, height) {
  return mass * gravity * height;
}

/** @param {number} springConstant @param {number} compression @returns {number} E_e = ½·k·x² (J). */
export function elasticEnergy(springConstant, compression) {
  return 0.5 * springConstant * compression * compression;
}

/**
 * Distancia de detención con desaceleración constante: d = v² / (2·a).
 * @param {number} speed Rapidez de entrada (m/s).
 * @param {number} deceleration Desaceleración (m/s²).
 * @returns {number} Distancia (m).
 */
export function brakingDistance(speed, deceleration) {
  return (speed * speed) / (2 * deceleration);
}

/**
 * Tiempo de detención con desaceleración constante: t = v / a.
 * @param {number} speed Rapidez de entrada (m/s).
 * @param {number} deceleration Desaceleración (m/s²).
 * @returns {number} Tiempo (s).
 */
export function brakingTime(speed, deceleration) {
  return speed / deceleration;
}

/**
 * Rapidez mínima en la cima de un loop de radio R para que N ≥ 0: v = √(g·R).
 * @param {number} gravity Gravedad (m/s²).
 * @param {number} radius Radio en la cima (m).
 * @returns {number} Rapidez (m/s).
 */
export function loopTopMinimumSpeed(gravity, radius) {
  return Math.sqrt(gravity * radius);
}

/**
 * Rapidez por conservación de la energía sin fricción a la altura y.
 * @param {number} gravity Gravedad (m/s²).
 * @param {number} initialHeight Altura inicial (m).
 * @param {number} height Altura actual (m).
 * @param {number} [initialSpeed] Rapidez inicial (m/s).
 * @returns {number} Rapidez (m/s); 0 si la altura es inalcanzable.
 */
export function frictionlessSpeed(gravity, initialHeight, height, initialSpeed = 0) {
  return Math.sqrt(
    Math.max(0, initialSpeed * initialSpeed + 2 * gravity * (initialHeight - height))
  );
}
