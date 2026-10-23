/**
 * Pruebas de la geometría del trazado: continuidad, longitudes y
 * curvaturas con valores cerrados conocidos.
 */
import { describe, it, expect } from "vitest";
import {
  buildTrack,
  geometryAt,
  createLoop,
  loopPoint,
  hillHalfWidth,
  ConfigError
} from "../src/physics/index.js";

describe("Loop en forma de lágrima", () => {
  const loop = createLoop({ x: 0, y: 0, height: 20, topRadius: 5, section: "Loop" });

  it("tiene altura h_L, radio R en la cima y R_ref·(1+c) en la base", () => {
    expect(loop.reference).toBe(10);
    expect(loop.shape).toBeCloseTo(0.5, 12);
    expect(loop.bottomRadius).toBeCloseTo(15, 12);

    const top = loopPoint(loop, loop.topDistance);
    expect(top.y).toBeCloseTo(20, 9);
    expect(top.angle).toBeCloseTo(Math.PI, 9);
    expect(1 / top.curvature).toBeCloseTo(5, 9);

    const bottom = loopPoint(loop, 0);
    expect(1 / bottom.curvature).toBeCloseTo(15, 9);
  });

  it("mide 2π·R_ref sin importar la forma y sale desplazado π·c·R_ref", () => {
    expect(loop.length).toBeCloseTo(2 * Math.PI * 10, 12);

    const exit = loopPoint(loop, loop.length);
    expect(exit.x).toBeCloseTo(Math.PI * 0.5 * 10, 6);
    expect(exit.y).toBeCloseTo(0, 6);
    expect(Math.sin(exit.angle)).toBeCloseTo(0, 6);
  });

  it("es una circunferencia cuando R = h_L / 2", () => {
    const circle = createLoop({ x: 0, y: 0, height: 12, topRadius: 6, section: "Loop" });

    for (let index = 0; index <= 12; index++) {
      const point = loopPoint(circle, (circle.length * index) / 12);
      expect(1 / point.curvature).toBeCloseTo(6, 9);
      expect(Math.hypot(point.x, point.y - 6)).toBeCloseTo(6, 6);
    }
  });

  it("reconstruye la longitud de arco: s(θ) = R_ref·(θ + c·sin θ)", () => {
    for (const fraction of [0.1, 0.3, 0.5, 0.75, 0.9]) {
      const distance = loop.length * fraction;
      const point = loopPoint(loop, distance);
      const recovered = loop.reference * (point.angle + loop.shape * Math.sin(point.angle));
      expect(recovered).toBeCloseTo(distance, 8);
    }
  });
});

describe("Trazado construido", () => {
  const config = {
    mapId: "reference",
    initialHeight: 32,
    trackWidth: 320,
    loopHeight: 20,
    loopTopRadius: 5,
    hillHeight: 10,
    hillCrestRadius: 40,
    brakingLength: 60
  };
  const track = buildTrack(config);

  it("es continuo en posición y ángulo en cada unión de tramos", () => {
    for (let index = 1; index < track.segments.length; index++) {
      const boundary = track.segments[index].start;
      const before = geometryAt(track, boundary - 1e-6);
      const after = geometryAt(track, boundary + 1e-6);

      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1e-4);
      expect(Math.abs(Math.sin(after.angle) - Math.sin(before.angle))).toBeLessThan(1e-3);
    }
  });

  it("coloca la cresta con radio ρ_c = w² / (6·h_c)", () => {
    const crest = track.markers.find(marker => marker.role === "crest");
    const geometry = geometryAt(track, crest.distance);
    const half = hillHalfWidth(10, 40);

    expect(half ** 2 / (6 * 10)).toBeCloseTo(40, 9);
    expect(geometry.y).toBeCloseTo(10, 6);
    expect(Math.abs(geometry.angle)).toBeLessThan(1e-6);
    expect(1 / Math.abs(geometry.curvature)).toBeCloseTo(40, 0);
    expect(geometry.curvature).toBeLessThan(0);
  });

  it("expone los puntos críticos A–F en orden", () => {
    expect(track.markers.map(marker => marker.label)).toEqual(["A", "B", "C", "D", "E", "F"]);

    const distances = track.markers.map(marker => marker.distance);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
    expect(track.markers.at(-1).distance).toBeCloseTo(track.totalLength, 9);
    expect(track.brakeStart + 60).toBeCloseTo(track.totalLength, 9);
  });

  it("prolonga la tangente inicial para s < 0 y limita s > longitud total", () => {
    const start = geometryAt(track, 0);
    const behind = geometryAt(track, -5);

    expect(behind.y).toBeGreaterThan(start.y);
    expect(Math.hypot(behind.x - start.x, behind.y - start.y)).toBeCloseTo(5, 9);

    const beyond = geometryAt(track, track.totalLength + 50);
    expect(beyond.x).toBeCloseTo(track.endX, 9);
  });

  it("devuelve la misma instancia memorizada para la misma geometría", () => {
    expect(buildTrack({ ...config })).toBe(track);
    expect(buildTrack({ ...config, mass: 1234 })).toBe(track);
    expect(buildTrack({ ...config, trackWidth: 321 })).not.toBe(track);
  });
});

describe("Validación geométrica", () => {
  it("rechaza colinas que no caben en el ancho disponible", () => {
    expect(() =>
      buildTrack({ mapId: "valley", trackWidth: 60, hillHeight: 30, hillCrestRadius: 100 })
    ).toThrow(ConfigError);
  });

  it("rechaza loops personalizados sin espacio horizontal", () => {
    expect(() =>
      buildTrack({
        mapId: "custom",
        trackWidth: 60,
        customPoints: [
          { x: 0, y: 1, loopHeight: 0, loopTopRadius: 0 },
          { x: 0.5, y: 0, loopHeight: 40, loopTopRadius: 10 },
          { x: 1, y: 0, loopHeight: 0, loopTopRadius: 0 }
        ]
      })
    ).toThrow(/espacio horizontal/);
  });

  it("rechaza un primer tramo que no desciende", () => {
    expect(() =>
      buildTrack({
        mapId: "custom",
        customPoints: [
          { x: 0, y: 1, loopHeight: 0, loopTopRadius: 0 },
          { x: 0.5, y: 1, loopHeight: 0, loopTopRadius: 0 },
          { x: 1, y: 0, loopHeight: 0, loopTopRadius: 0 }
        ]
      })
    ).toThrow(/descender/);
  });
});
