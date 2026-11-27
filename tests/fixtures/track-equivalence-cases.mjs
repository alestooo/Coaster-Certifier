/**
 * Casos y forma normalizada de la prueba de equivalencia del modelo por
 * elementos: los 12 escenarios, las plantillas del selector y cada trazado
 * con sus valores por defecto. La referencia se capturó con el modelo viejo.
 */
import { buildTrack, resolveConfig, runSimulation, SCENARIOS, MAP_IDS } from "../../src/physics/index.js";
import { MAPS } from "../../src/game/maps.ts";

/** @returns {{name: string, config: object}[]} */
export function equivalenceCases() {
  return [
    ...SCENARIOS.map(scenario => ({ name: `escenario ${scenario.id}`, config: scenario.config })),
    ...MAPS.map(map => ({ name: `plantilla ${map.id}`, config: map.template })),
    ...MAP_IDS.map(mapId => ({ name: `por defecto ${mapId}`, config: { mapId } }))
  ];
}

/**
 * Trazado y dictamen en una forma comparable entre modelos.
 * @param {object} input
 */
export function normalize(input) {
  const config = resolveConfig(input);
  const track = buildTrack(config);
  const run = runSimulation(config);
  const lineEnds = new Set(track.segments.filter(segment => segment.kind === "line").map(segment => segment.end));

  return {
    nodes: track.nodes.map(node => ({
      x: node.x,
      y: node.y,
      crest: node.role === "crest",
      loopHeight: node.loopHeight || 0,
      loopTopRadius: node.loopHeight ? node.loopTopRadius : 0
    })),
    lineSegments: lineEnds.size,
    markers: track.markers.map(marker => ({ label: marker.label, role: marker.role, distance: marker.distance })),
    sections: track.sections.map(section => ({ name: section.name, kind: section.kind, length: section.length })),
    totalLength: track.totalLength,
    brakeStart: track.brakeStart,
    brakeX: track.brakeX,
    endX: track.endX,
    verdict: {
      approved: run.verdict.approved,
      status: run.final.status,
      distance: run.final.distance,
      time: run.final.time,
      maxLoad: run.verdict.summary.maxLoad.value,
      minLoad: run.verdict.summary.minLoad.value,
      maxSpeed: run.verdict.summary.maxSpeed.value,
      violations: run.verdict.violations.map(violation => ({ code: violation.code, position: violation.position }))
    }
  };
}
