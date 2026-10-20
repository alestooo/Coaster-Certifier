// Responsable: Minor.
// Dibujo inicial de la pendiente.
// Ampliar para representar el trazado completo y sus puntos críticos.
// Las conversiones de metros a píxeles se hacen aquí.

import { getTrackGeometry } from "../physics/index.js";

export function renderSimulation(canvas, state, config) {
  const ctx = canvas.getContext("2d");
  const margin = 35;

  const start = getTrackGeometry(0, config);
  const end = getTrackGeometry(config.trackLength, config);

  const scale = Math.min(
    (canvas.width - 2 * margin) / end.x,
    (canvas.height - 2 * margin) / config.initialHeight
  );

  const toX = (x) => margin + x * scale;
  const toY = (y) => canvas.height - margin - y * scale;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.moveTo(toX(start.x), toY(start.y));
  ctx.lineTo(toX(end.x), toY(end.y));
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(
    toX(state.position.x),
    toY(state.position.y),
    9,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = "#6d28d9";
  ctx.fill();
}