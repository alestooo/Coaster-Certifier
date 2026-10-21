export function calculateEnergies(
  config,
  speed,
  height,
  compression,
  dissipated
) {
  const kinetic =
    0.5 * config.mass * speed ** 2;

  const gravitational =
    config.mass * config.gravity * height;

  const elastic =
    0.5 *
    config.springConstant *
    compression ** 2;

  const mechanical =
    kinetic + gravitational + elastic;

  const initialEnergy =
    config.mass *
    config.gravity *
    config.initialHeight;

  return {
    kinetic,
    gravitational,
    elastic,
    mechanical,
    dissipated,

    balanceError:
      mechanical + dissipated - initialEnergy
  };
}