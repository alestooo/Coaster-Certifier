/**
 * Lanzadores LSM y frenos de ajuste sobre su tramo recto, a escala real:
 * - capa estática: estatores del lanzador (placas azules) y aletas de cobre
 *   de los frenos, entre los rieles;
 * - capa dinámica: mientras el tren está adentro, la zona se enciende.
 */
import { geometryAt } from "../../physics/track/geometry.js";
import { PALETTE } from "./palette.js";
import { box } from "./draw.js";

/** Separación entre placas del estator y entre aletas de cobre (m). */
const STATOR_SPACING_M = 1.1;
const FIN_SPACING_M = 0.8;
/** Alto y ancho de una placa o aleta (m). */
const PLATE_HEIGHT_M = 0.45;
const PLATE_WIDTH_M = 0.5;
/** Alto de la franja encendida sobre la vía (m). */
const GLOW_HEIGHT_M = 0.9;
/** Lo mínimo que se dibuja en pantalla (px), para que no desaparezca en el teléfono. */
const MIN_PX = 1;

/**
 * Altura de la vía de una zona (es horizontal: la del inicio).
 * @param {any} track
 * @param {{start: number}} zone
 */
const zoneHeight = (track, zone) => geometryAt(track, zone.start).y;

/**
 * Estatores y aletas (capa estática, cacheada con el mundo).
 * @param {import("./index.js").Frame} frame
 */
export function drawZoneHardware({ ctx, camera, scene }) {
  const zones = scene.track.zones ?? [];
  if (!zones.length) return;
  const m = (/** @type {number} */ value) => Math.max(MIN_PX, value * camera.scale);

  for (const zone of zones) {
    const booster = zone.kind === "booster";
    const spacing = booster ? STATOR_SPACING_M : FIN_SPACING_M;
    const y = zoneHeight(scene.track, zone);
    const startX = geometryAt(scene.track, zone.start).x;
    const endX = geometryAt(scene.track, zone.end).x;
    const railY = camera.toY(y);

    for (let x = startX + spacing / 2; x < endX; x += spacing) {
      const px = camera.toX(x);
      box(ctx, px - m(PLATE_WIDTH_M) / 2, railY - m(PLATE_HEIGHT_M + 0.1), m(PLATE_WIDTH_M), m(PLATE_HEIGHT_M), booster ? PALETTE.boosterStator : PALETTE.trimFin, m(0.05));
      box(ctx, px - m(PLATE_WIDTH_M) / 2, railY - m(PLATE_HEIGHT_M + 0.1), m(PLATE_WIDTH_M), m(0.1), booster ? PALETTE.boosterStatorLight : PALETTE.trimFinLight, 0);
    }
  }
}

/**
 * La zona donde está el tren se enciende (capa dinámica): el lanzador empuja,
 * los frenos de ajuste frenan.
 * @param {import("./index.js").Frame} frame
 */
export function drawZoneActivity({ ctx, camera, scene }) {
  const { state, track, config } = scene;
  if (!state) return;

  // Frenos de la recta final: se encienden mientras frenan (el tren entró y todavía se mueve).
  if (config?.brakeMode === "station" && state.distance >= track.brakeStart && state.speed > 0.05) {
    const height = Math.max(MIN_PX * 2, GLOW_HEIGHT_M * camera.scale);
    ctx.fillStyle = PALETTE.brakeGlow;
    ctx.fillRect(camera.toX(track.brakeX), camera.toY(0) - height, camera.toX(track.endX) - camera.toX(track.brakeX), height);
  }

  if (!state.zoneKind || !track.zones?.length) return;

  const zone = track.zones.find((/** @type {any} */ candidate) => state.distance >= candidate.start && state.distance < candidate.end);
  if (!zone) return;

  const y = zoneHeight(track, zone);
  const left = camera.toX(geometryAt(track, zone.start).x);
  const right = camera.toX(geometryAt(track, zone.end).x);
  const height = Math.max(MIN_PX * 2, GLOW_HEIGHT_M * camera.scale);

  ctx.fillStyle = zone.kind === "booster" ? PALETTE.boosterGlow : PALETTE.trimGlow;
  ctx.fillRect(left, camera.toY(y) - height, right - left, height);
}
