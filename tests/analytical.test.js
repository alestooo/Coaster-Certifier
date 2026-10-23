/**
 * Pruebas de validación analítica.
 *
 * Cada escenario tiene solución cerrada conocida; el motor se compara
 * contra ella dentro de una tolerancia declarada y justificada:
 *
 * - RK4 con paso ≤ 1 ms: para aceleración constante el método es exacto
 *   (el polinomio de segundo grado se integra sin error de truncamiento),
 *   por lo que solo queda el error de redondeo (~1e-12 relativo).
 * - La geometría curva usa una tabla de longitud de arco de 400 muestras
 *   por tramo con interpolación lineal; su error relativo es del orden
 *   de 1e-5, que domina en las pruebas de conservación de energía.
 * - Los instantes en que el tren cruza una posición se interpolan
 *   linealmente entre muestras de 10 ms: error ≤ ½·a·(Δt)² ≈ 3e-4 s.
 */
import { describe, it, expect } from "vitest";
import { IDEAL, simulate, bracketAtDistance, timeAtDistance } from "./helpers.js";

const G = 9.81;

describe("Plano inclinado sin fricción", () => {
  const H = 20;
  const W = 40;
  const L = Math.hypot(W, H);
  const sinAlpha = H / L;
  const run = simulate({ mapId: "incline", initialHeight: H, trackWidth: W });

  it("sigue s = ½·g·sin(α)·t² y v = g·sin(α)·t en cada muestra de la rampa", () => {
    const onRamp = run.history.filter(state => state.distance < L && state.time > 0);
    expect(onRamp.length).toBeGreaterThan(50);

    for (const state of onRamp) {
      const expectedDistance = 0.5 * G * sinAlpha * state.time ** 2;
      const expectedSpeed = G * sinAlpha * state.time;

      expect(state.distance).toBeCloseTo(expectedDistance, 8);
      expect(state.speed).toBeCloseTo(expectedSpeed, 8);
    }
  });

  it("llega abajo en t = √(2L / (g·sin α)) con rapidez √(2gH)", () => {
    const expectedTime = Math.sqrt((2 * L) / (G * sinAlpha));
    const [, after] = bracketAtDistance(run.history, L);

    expect(Math.abs(timeAtDistance(run.history, L) - expectedTime)).toBeLessThan(1e-3);

    // La unión rampa–recta es un cambio brusco de pendiente: en el subpaso
    // que la cruza RK4 pierde su orden (error O(a·Δt_sub) ≈ 4e-3 m/s).
    expect(after.speed).toBeCloseTo(Math.sqrt(2 * G * H), 2);
  });
});

describe("Plano inclinado con fricción cinética", () => {
  const H = 20;
  const W = 60;
  const mu = 0.05;
  const L = Math.hypot(W, H);
  const sinAlpha = H / L;
  const cosAlpha = W / L;
  const acceleration = G * (sinAlpha - mu * cosAlpha);
  const run = simulate({ mapId: "incline", initialHeight: H, trackWidth: W, friction: mu });

  it("acelera con a = g·(sin α − μ·cos α) y disipa μ·m·g·cos α·s", () => {
    const onRamp = run.history.filter(state => state.distance < L && state.time > 0);

    for (const state of onRamp) {
      expect(state.speed).toBeCloseTo(acceleration * state.time, 8);
      expect(state.energies.dissipated).toBeCloseTo(
        mu * IDEAL.mass * G * cosAlpha * state.distance,
        6
      );
      expect(Math.abs(state.energies.balanceError)).toBeLessThan(1e-6);
    }
  });
});

describe("Conservación de la energía mecánica (μ = 0)", () => {
  it("mantiene E_m dentro del 1 % exigido y de 1e-4 relativo durante todo el valle", () => {
    const run = simulate({
      mapId: "valley",
      initialHeight: 25,
      trackWidth: 220,
      hillHeight: 8,
      hillCrestRadius: 30,
      maxTime: 10
    });

    const initial = run.history[0].energies.mechanical;
    const beforeBrake = run.history.filter(state => state.distance < run.track.brakeStart);

    expect(beforeBrake.length).toBeGreaterThan(100);

    for (const state of beforeBrake) {
      const relative = Math.abs(state.energies.mechanical - initial) / initial;
      expect(relative).toBeLessThan(1e-4);
      expect(relative).toBeLessThan(0.01);
    }
  });

  it("conserva la energía a lo largo de un loop en lágrima", () => {
    const run = simulate({
      mapId: "loop",
      initialHeight: 35,
      trackWidth: 220,
      loopHeight: 24,
      loopTopRadius: 6
    });

    const initial = run.history[0].energies.mechanical;
    const inLoop = run.history.filter(state => state.kind === "loop");

    expect(inLoop.length).toBeGreaterThan(50);

    for (const state of inLoop) {
      expect(Math.abs(state.energies.mechanical - initial) / initial).toBeLessThan(1e-4);
    }
  });
});

describe("Balance energético con fricción (μ > 0)", () => {
  const run = simulate({
    mapId: "valley",
    initialHeight: 25,
    trackWidth: 220,
    hillHeight: 8,
    hillCrestRadius: 30,
    friction: 0.02
  });

  it("cumple E_m(t) + E_disipada(t) = E_m(0) en todo el historial", () => {
    for (const state of run.history) {
      expect(Math.abs(state.energies.balanceError) / state.energies.initial).toBeLessThan(1e-4);
    }
  });

  it("acumula una energía disipada no negativa y no decreciente", () => {
    for (let index = 1; index < run.history.length; index++) {
      expect(run.history[index].energies.dissipated).toBeGreaterThanOrEqual(
        run.history[index - 1].energies.dissipated - 1e-9
      );
    }
  });
});

describe("Frenos de estación (MRUA)", () => {
  const H = 20;
  const a = 4;
  const run = simulate({
    mapId: "slope",
    initialHeight: H,
    trackWidth: 160,
    brakeDeceleration: a,
    brakingLength: 100
  });

  it("entra a la zona de frenado con v_E = √(2gH) y se detiene en d = v_E²/(2a) y t = v_E/a", () => {
    const entrySpeed = Math.sqrt(2 * G * H);
    const braking = run.verdict.summary.braking;

    expect(run.final.status).toBe("finished");
    expect(braking.entrySpeed).toBeCloseTo(entrySpeed, 3);
    expect(braking.stoppingDistance).toBeCloseTo(entrySpeed ** 2 / (2 * a), 4);
    expect(braking.stoppingTime).toBeCloseTo(entrySpeed / a, 3);
  });

  it("disipa en los frenos exactamente la energía cinética de entrada", () => {
    expect(run.final.energies.dissipated / (IDEAL.mass * G * H)).toBeCloseTo(1, 6);
    expect(run.final.energies.kinetic).toBeCloseTo(0, 9);
  });
});

describe("Resorte de frenado ideal", () => {
  const H = 15;
  const k = 6000;
  const m = 500;
  const run = simulate({
    mapId: "slope",
    initialHeight: H,
    trackWidth: 160,
    brakeMode: "spring",
    springConstant: k,
    maxCompression: 60,
    brakingLength: 100,
    mass: m,
    maxTime: 40
  });

  it("alcanza la compresión máxima x = √(2·m·g·H / k)", () => {
    const expected = Math.sqrt((2 * m * G * H) / k);
    const maxCompression = Math.max(...run.history.map(state => state.springCompression));

    expect(maxCompression).toBeCloseTo(expected, 3);
  });

  it("almacena ½·k·x² = m·g·H y tarda (π/2)·√(m/k) en comprimirse", () => {
    const entryTime = timeAtDistance(run.history, run.track.brakeStart);
    const peak = run.history.reduce((best, state) =>
      state.springCompression > best.springCompression ? state : best
    );

    expect(peak.energies.elastic).toBeCloseTo(m * G * H, -1);
    expect(peak.time - entryTime).toBeCloseTo((Math.PI / 2) * Math.sqrt(m / k), 2);
  });

  it("devuelve la energía y rebota: no se declara detenido artificialmente", () => {
    const peakIndex = run.history.findIndex(state => state.springCompression === Math.max(...run.history.map(s => s.springCompression)));
    const afterPeak = run.history.slice(peakIndex + 5, peakIndex + 50);

    expect(afterPeak.every(state => state.velocity < 0)).toBe(true);
    expect(["finished", "stopped"]).not.toContain(run.final.status);
    expect(run.verdict.approved).toBe(false);
  });
});

describe("Contacto en la cima del loop", () => {
  const R = 6;
  const loop = { mapId: "loop", trackWidth: 240, loopHeight: 2 * R, loopTopRadius: R };

  it("rechaza el caso límite v_C² = g·R (normal cero) con H = 2,5·R", () => {
    const run = simulate({ ...loop, initialHeight: 2.5 * R * (1 - 1e-3) });
    const event = run.final.events.at(-1);

    expect(run.final.status).toBe("lost-contact");
    expect(event?.section).toBe("Loop 1");
    expect(event?.unit).toBe("N");
    expect(run.verdict.approved).toBe(false);
  });

  it("con H = 2,5·R·(1+ε) la normal mínima en la cima vale m·g·5ε", () => {
    const epsilon = 0.02;
    const run = simulate({ ...loop, initialHeight: 2.5 * R * (1 + epsilon), maxLoad: 10 });
    const inLoop = run.history.filter(state => state.kind === "loop");
    const minNormal = Math.min(...inLoop.map(state => state.forces.normal));

    expect(run.final.status).toBe("finished");
    expect(minNormal / (IDEAL.mass * G)).toBeCloseTo(5 * epsilon, 2);
  });

  it("en la cima de un loop circular N = m·(v²/R − g)", () => {
    const run = simulate({ ...loop, initialHeight: 20, maxLoad: 10 });
    const top = run.track.markers.find(marker => marker.role === "loop-top");
    const [before, after] = bracketAtDistance(run.history, top.distance);
    const sample = after.distance - top.distance < top.distance - before.distance ? after : before;
    const expected = IDEAL.mass * (sample.speed ** 2 / R - G);

    expect(sample.forces.normal).toBeCloseTo(expected, 0);
    expect(sample.position.y).toBeCloseTo(2 * R, 1);
  });
});

describe("Carga en la base del loop y en la cresta de la colina", () => {
  it("entra al loop con n_B = 1 + v_B² / (g·R_B)", () => {
    const H = 30;
    const run = simulate({
      mapId: "loop",
      initialHeight: H,
      trackWidth: 240,
      loopHeight: 20,
      loopTopRadius: 5,
      maxLoad: 10
    });

    const loop = run.track.loops[0];
    const entry = run.history.find(state => state.kind === "loop");
    const expected = 1 + (2 * G * H) / (G * loop.bottomRadius);

    expect(loop.bottomRadius).toBeCloseTo(15, 9);
    expect(entry.load).toBeCloseTo(expected, 1);
  });

  it("pasa la cresta con n_D = 1 − v_D² / (g·ρ_c) y v_D² = 2g(H − h_c)", () => {
    const H = 25;
    const hc = 10;
    const rho = 60;
    const run = simulate({
      mapId: "valley",
      initialHeight: H,
      trackWidth: 260,
      hillHeight: hc,
      hillCrestRadius: rho
    });

    const crest = run.verdict.summary.criticalPoints.find(point => point.role === "crest");
    const expectedSpeedSquared = 2 * G * (H - hc);

    expect(crest.reached).toBe(true);
    expect(crest.speed ** 2).toBeCloseTo(expectedSpeedSquared, 0);
    expect(crest.load).toBeCloseTo(1 - expectedSpeedSquared / (G * rho), 2);
  });
});

describe("Independencia de la masa", () => {
  it("la rapidez no depende de la masa cuando la fricción es μ·N", () => {
    const base = { mapId: "valley", initialHeight: 25, trackWidth: 220, hillHeight: 8, hillCrestRadius: 30, friction: 0.03 };
    const light = simulate({ ...base, mass: 500 });
    const heavy = simulate({ ...base, mass: 5000 });

    expect(light.history.length).toBe(heavy.history.length);

    light.history.forEach((state, index) => {
      expect(state.speed).toBeCloseTo(heavy.history[index].speed, 9);
      expect(state.load).toBeCloseTo(heavy.history[index].load, 9);
    });

    expect(heavy.final.energies.dissipated).toBeCloseTo(10 * light.final.energies.dissipated, 4);
  });
});
