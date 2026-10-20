// Responsable: Dylan.
// Base provisional: pendiente recta sin fricción ni resorte.
//
// Ampliar con:
// - Normal según curvatura y orientación.
// - Fricción opuesta al movimiento.
// - Fuerza del resorte.
// - Validación de los casos límite.
//
// Contrato de salida: fuerzas en N.
// tangential lleva signo; friction es una magnitud no negativa.

export function calculateForces(state, geometry, config) {
  if (geometry.curvature !== 0) {
    throw new Error("La fuerza normal en curvas aún no está implementada.");
  }

  return {
    tangential:
      -config.mass * config.gravity * Math.sin(geometry.angle),

    normal:
      config.mass * config.gravity * Math.cos(geometry.angle),

    friction: 0,
    spring: 0,
  };
}