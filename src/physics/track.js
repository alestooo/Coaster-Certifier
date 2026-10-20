// Responsable: Alejandro.
// Primera geometría: pendiente recta.
// Pendiente: sustituir por el trazado A–F con loop y colina.

export function getTrackGeometry(distance, config) {
  const s = Math.max(0, Math.min(distance, config.trackLength));
  const angle = -Math.asin(
    config.initialHeight / config.trackLength
  );

  return {
    distance: s,
    x: s * Math.cos(angle),
    y: config.initialHeight + s * Math.sin(angle),
    angle,                // rad
    curvature: 0,         // m⁻¹; pendiente recta
    section: "pendiente",
  };
}