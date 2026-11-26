import { describe, test, expect } from "vitest";
import { runSimulation, resolveConfig, buildTrack, findScenario } from "../src/physics/index.js";
import { loadProfile, loadTone, ribbonRuns, legendItems, LOAD_BIN_M } from "../src/lib/load-profile.ts";
import { sampleHistory } from "../src/lib/sampling.ts";

function runOf(input) {
  const config = resolveConfig(input);
  const run = runSimulation(config);
  return { config, track: buildTrack(config), run };
}

describe("Perfil de fuerza g a lo largo de la vía", () => {
  test("el anexo aprobado no tiene tramos excedidos y el perfil cubre del inicio a la detención", () => {
    // Arrange
    const { config, track, run } = runOf(findScenario("certification").config);

    // Act
    const profile = loadProfile(run.history, track);

    // Assert
    expect(run.verdict.approved).toBe(true);
    expect(profile[0].from).toBe(0);
    expect(profile.at(-1).to).toBeGreaterThanOrEqual(run.final.distance - LOAD_BIN_M);
    expect(profile.some(bin => loadTone(bin, config) === "over")).toBe(false);
  });

  test("el loop circular tiene tramos excedidos dentro del loop", () => {
    // Arrange
    const { config, track, run } = runOf(findScenario("circular-loop").config);
    const loop = track.sections.find(section => section.name.startsWith("Loop"));

    // Act
    const over = loadProfile(run.history, track).filter(bin => loadTone(bin, config) === "over");

    // Assert
    expect(over.length).toBeGreaterThan(0);
    expect(over.every(bin => bin.from >= loop.start - LOAD_BIN_M && bin.to <= loop.end + LOAD_BIN_M)).toBe(true);
  });

  test("no quedan huecos entre tramos consecutivos aunque el tren avance más de 0,5 m por muestra", () => {
    // Arrange: muestras cada 0,05 s; a más de 10 m/s el tren avanza más de 0,5 m entre muestras.
    const interval = 0.05;
    const { track, run } = runOf(findScenario("certification").config);
    const sampled = sampleHistory(run.history, interval);

    // Act
    const profile = loadProfile(sampled, track);

    // Assert
    expect(Math.max(...sampled.map(state => state.speed)) * interval).toBeGreaterThan(LOAD_BIN_M);
    for (let index = 1; index < profile.length; index++) {
      expect(profile[index].from).toBeCloseTo(profile[index - 1].to, 9);
    }
  });

  test("loadTone ordena excede > cerca > flotación > cómoda", () => {
    const strict = resolveConfig({ maxLoad: 5, contactModel: "strict" });
    const wheels = resolveConfig({ maxLoad: 5, minLoad: -1, contactModel: "safety-wheels" });

    expect(loadTone({ min: 1, max: 5.1 }, strict)).toBe("over");
    expect(loadTone({ min: 0, max: 2 }, strict)).toBe("over");
    expect(loadTone({ min: 0.1, max: 4.6 }, strict)).toBe("near");
    expect(loadTone({ min: 0.1, max: 2 }, strict)).toBe("float");
    expect(loadTone({ min: 0.5, max: 3 }, strict)).toBe("comfort");
    expect(loadTone({ min: -0.5, max: 2 }, wheels)).toBe("float");
    expect(loadTone({ min: -1.2, max: 2 }, wheels)).toBe("over");
  });

  test("ribbonRuns une tramos contiguos del mismo tono", () => {
    // Arrange
    const config = resolveConfig({ mapId: "slope", maxLoad: 5 });
    const track = buildTrack(config);
    const profile = [
      { from: 0, to: 0.5, min: 0.5, max: 1 },
      { from: 0.5, to: 1, min: 0.5, max: 1.2 },
      { from: 1, to: 1.5, min: 0.5, max: 4.7 },
      { from: 1.5, to: 2, min: 0.5, max: 4.8 }
    ];

    // Act
    const runs = ribbonRuns(profile, track, config);

    // Assert
    expect(runs.map(run => run.tone)).toEqual(["comfort", "near"]);
    expect(runs[0]).toMatchObject({ from: 0, to: 1 });
    expect(runs[1]).toMatchObject({ from: 1, to: 2 });
    expect(runs[0].points.length).toBeGreaterThanOrEqual(2);
  });

  test("con ruedas anti-levantamiento, perder el contacto en el loop se pinta como excedido", () => {
    // Arrange: sin energía suficiente el tren pierde contacto en el loop (N ≤ 0 se rechaza siempre ahí).
    const { config, track, run } = runOf({ mapId: "reference", contactModel: "safety-wheels", initialHeight: 15 });

    // Act
    const tones = loadProfile(run.history, track).map(bin => loadTone(bin, config));

    // Assert
    expect(run.final.status).toBe("lost-contact");
    expect(tones).toContain("over");
  });
});

describe("Leyenda de la franja de fuerza g", () => {
  test("con «siempre apoyado» el límite inferior es N ≤ 0", () => {
    const over = legendItems(resolveConfig({ contactModel: "strict" })).find(item => item.tone === "over");

    expect(over.text).toBe("> 5,0 g o ≤ 0 g");
  });

  test("con ruedas anti-levantamiento dice «<» como el motor, que rechaza recién por debajo de n_mín", () => {
    const over = legendItems(resolveConfig({ contactModel: "safety-wheels" })).find(item => item.tone === "over");

    expect(over.text).toBe("> 5,0 g o < -1,0 g");
  });
});
