// Responsable: Alejandro.
// Entradas en SI; todas las energías se devuelven en J.

export function kineticEnergy(mass, velocity) {
  return 0.5 * mass * velocity ** 2;
}

export function gravitationalEnergy(mass, gravity, height) {
  return mass * gravity * height;
}

export function elasticEnergy(stiffness, compression) {
  return 0.5 * stiffness * compression ** 2;
}

export function calculateEnergies({
  mass,
  gravity,
  velocity,
  height,
  stiffness = 0,
  compression = 0,
  dissipated = 0,
}) {
  const kinetic = kineticEnergy(mass, velocity);
  const gravitational = gravitationalEnergy(mass, gravity, height);
  const elastic = elasticEnergy(stiffness, compression);

  return {
    kinetic,
    gravitational,
    elastic,
    mechanical: kinetic + gravitational + elastic,
    dissipated,
  };
}