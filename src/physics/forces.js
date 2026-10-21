import { geometryAt } from "./geometry.js";

export function calculateForces(
  distance,
  velocity,
  config,
  track
) {
  const geometry = geometryAt(
    distance,
    config,
    track
  );

  const normal =
    config.mass *
    (
      config.gravity * Math.cos(geometry.angle) +
      velocity ** 2 * geometry.curvature
    );

  const compression =
    config.brakeMode === "spring"
      ? Math.max(0, distance - track.springStart)
      : 0;

  const spring =
    -config.springConstant * compression;

  const gravity =
    -config.mass *
    config.gravity *
    Math.sin(geometry.angle);

  const drive = gravity + spring;

  const frictionLimit =
    config.friction * Math.max(0, normal);

  // Se usa el mismo coeficiente como umbral de adherencia.
  const friction =
    Math.abs(velocity) < 1e-10
      ? -Math.sign(drive) *
        Math.min(Math.abs(drive), frictionLimit)
      : -Math.sign(velocity) * frictionLimit;

  const brakeLimit =
    config.brakeMode === "station" &&
    distance >= track.springStart
      ? config.mass * config.brakeDeceleration
      : 0;

  const brake =
    Math.abs(velocity) < 1e-10
      ? -Math.sign(drive + friction) *
        Math.min(
          Math.abs(drive + friction),
          brakeLimit
        )
      : -Math.sign(velocity) * brakeLimit;

  const tangential =
    drive + friction + brake;

  return {
    geometry,
    normal,
    compression,
    spring,
    gravity,
    friction,
    brake,
    tangential,

    acceleration:
      tangential / config.mass,

    normalAcceleration:
      velocity ** 2 * geometry.curvature,

    load:
      normal / (config.mass * config.gravity)
  };
}