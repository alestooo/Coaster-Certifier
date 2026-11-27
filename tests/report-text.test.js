import { describe, test, expect } from "vitest";
import { SCENARIOS } from "../src/physics/index.js";
import { runSimulation, findScenario, resolveConfig } from "../src/physics/index.js";
import { resultLines, elementRows, designName } from "../src/lib/report-text.ts";
import { mapTemplate } from "../src/game/maps.ts";
import { formatNumber } from "../src/ui/format.ts";

/** Un número con punto decimal («240.87»), que en la interfaz va con coma. */
const DOT_DECIMAL = /\d\.\d/;

describe("Resultado del informe en español", () => {
  test("un recorrido aprobado se explica con coma decimal", () => {
    // Arrange
    const config = resolveConfig(findScenario("certification").config);
    const run = runSimulation(config);

    // Act
    const lines = resultLines(run.verdict, run.history.at(-1).distance, config);

    // Assert
    expect(run.verdict.approved).toBe(true);
    expect(lines).toHaveLength(3);
    expect(lines.join(" ")).not.toMatch(DOT_DECIMAL);
    expect(lines[0]).toMatch(/quedó detenido a \d+,\d\d m/);
    // «Siempre apoyado» (el modelo por defecto) no usa n_mín: exige N > 0, como dice el dictamen.
    expect(config.contactModel).toBe("strict");
    expect(lines[1]).toContain("mayor que 0 g (siempre apoyado) y hasta 5 g");
  });

  test("con ruedas anti-levantamiento el resultado nombra el intervalo de la regla", () => {
    const config = resolveConfig({ ...findScenario("certification").config, contactModel: "safety-wheels" });
    const run = runSimulation(config);

    const lines = resultLines(run.verdict, run.history.at(-1).distance, config);

    expect(run.verdict.approved).toBe(true);
    expect(lines[1]).toContain("entre -1 y 5 g");
  });

  test("un recorrido rechazado nombra cada incumplimiento con coma decimal", () => {
    const config = resolveConfig(findScenario("circular-loop").config);
    const run = runSimulation(config);

    const lines = resultLines(run.verdict, run.history.at(-1).distance, config);

    expect(run.verdict.approved).toBe(false);
    expect(lines.length).toBe(run.verdict.violations.length);
    expect(lines.join(" ")).not.toMatch(DOT_DECIMAL);
    expect(lines[0]).toMatch(/s = \d+,\d\d m, t = \d+,\d{3} s\.$/);
  });
});

describe("Tabla de elementos del informe", () => {
  test("lista cada elemento con tipo, x, altura y su loop o colina; W sale del final", () => {
    // Arrange
    const config = resolveConfig(mapTemplate("reference"));

    // Act
    const rows = elementRows(config);

    // Assert
    expect(rows.map(row => row.type)).toEqual(["Inicio A", "Punto", "Colina", "Final"]);
    expect(rows[1]).toMatchObject({ x: "80,0 m", height: "0,0 m", detail: "loop de 21,5 m · radio en la cima 5 m" });
    expect(rows[2]).toMatchObject({ height: "10,0 m", detail: "radio de la cresta 55 m" });
    expect(rows.every(row => !/_/.test(row.detail))).toBe(true);
    expect(rows[3].x).toBe(`${formatNumber(config.trackWidth, 1)} m`);
  });
});

describe("Nombre del diseño", () => {
  test("es el del trazado si no se editó, y «basado en» si se cambió algún elemento", () => {
    const config = resolveConfig(mapTemplate("reference"));
    const edited = resolveConfig({ ...config, track: config.track.map((element, index) => (index === 1 ? { ...element, x: element.x + 5 } : element)) });

    expect(designName(config)).toBe("Trazado del anexo");
    expect(designName(resolveConfig({ ...config, initialHeight: 25 }))).toBe("Trazado del anexo");
    expect(designName(edited)).toBe("Diseño basado en «Trazado del anexo»");
  });

  test("un escenario de referencia sin tocar se llama como el escenario", () => {
    const scenario = SCENARIOS.find(item => item.id === "circular-loop");

    expect(designName(resolveConfig(scenario.config))).toBe(scenario.title);
  });
});

