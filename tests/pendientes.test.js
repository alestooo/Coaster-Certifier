import { describe, test, expect } from "vitest";
import { resolveConfig, buildTrack, runSimulation, ConfigError, DEFAULT_CONFIG, DEFAULT_LIFT } from "../src/physics/index.js";
import { elementHandles } from "../src/lib/track-edit.ts";
import { buildAudit, areaForSection } from "../src/lib/audit.ts";
import { liftText } from "../src/lib/report-text.ts";
import { fieldByKey } from "../src/lib/field-definitions.ts";
import { targetedPatches } from "../src/physics/recommendations/index.js";

const lift = { type: "start", lift: DEFAULT_LIFT };

describe("Menores pendientes de las fases 5–7", () => {
  test("el mensaje de un loop sin espacio nombra el punto como el panel (por elemento, no por nodo)", () => {
    // La colina (elemento 2) aporta tres nodos: el loop es el «Punto 3» del panel, no el nodo 5.
    const track = [lift, { type: "point", x: 40, y: 0 }, { type: "hill", x: 100, height: 6, crestRadius: 20 }, { type: "point", x: 160, y: 0, loop: { height: 20, topRadius: 5 } }, { type: "point", x: 163, y: 0 }, { type: "end", x: 300 }];

    expect(() => buildTrack({ ...DEFAULT_CONFIG, initialHeight: 30, track })).toThrow(/El loop del punto 4 /);
  });

  test("un elemento nulo o que no es un objeto en el JSON da un error de configuración, no un TypeError", () => {
    expect(() => resolveConfig({ track: [lift, null, { type: "end", x: 200 }] })).toThrow(ConfigError);
    expect(() => resolveConfig({ track: [lift, 7, { type: "end", x: 200 }] })).toThrow(ConfigError);
  });

  test("los nombres hablados de la cima y la cresta no repiten el número cuando ya va en la letra", () => {
    const config = resolveConfig({ ...DEFAULT_CONFIG, initialHeight: 30, track: [lift, { type: "point", x: 60, y: 0 }, { type: "hill", x: 120, height: 8, crestRadius: 25 }, { type: "hill", x: 220, height: 6, crestRadius: 25 }, { type: "end", x: 320 }] });
    const names = elementHandles(buildTrack(config), config).filter(handle => handle.kind === "hillCrest").map(handle => handle.name);

    expect(names).toEqual(["Cresta de la colina D: posición y altura", "Cresta de la colina D2: posición y altura"]);
  });

  test("un tren que nunca se mueve «no arranca»", () => {
    const config = resolveConfig({ ...DEFAULT_CONFIG, initialHeight: 2, initialSpeed: 0, track: [{ type: "start" }, { type: "point", x: 40, y: 2 }, { type: "end", x: 100 }] });
    const run = runSimulation(config);

    const audit = buildAudit(run.verdict, config);

    expect(audit.issues[0].title).toMatch(/no arranca/i);
  });

  test("sin subida, el primer tramo plano no se llama «Caída inicial» y «lanzada» solo aparece con un lanzador", () => {
    const flat = resolveConfig({ ...DEFAULT_CONFIG, initialHeight: 2, track: [{ type: "start" }, { type: "point", x: 40, y: 2 }, { type: "end", x: 100 }] });
    const launched = resolveConfig({ ...flat, track: [{ type: "start" }, { type: "booster", x: 0, y: 2, length: 30, power: 100_000, maxAcceleration: 5 }, { type: "point", x: 60, y: 2 }, { type: "end", x: 120 }] });

    expect(buildTrack(flat).sections[0].name).toBe("Salida");
    expect(liftText(flat)).not.toMatch(/lanzada/);
    expect(liftText(launched)).toMatch(/lanzada/);
  });

  test("la ayuda de la altura de la colina ya no dice que con 0 m no hay colina", () => {
    expect(fieldByKey("hillHeight")?.help).not.toMatch(/Con 0 m/);
  });

  test("un despegue en una cresta (modo estricto) no propone subir la potencia del lanzador: ahí sobra rapidez", () => {
    // Lanzador fuerte y una colina cerrada: el tren despega en la cresta.
    const config = resolveConfig({
      ...DEFAULT_CONFIG,
      initialHeight: 10,
      track: [lift, { type: "point", x: 40, y: 0 }, { type: "booster", x: 50, y: 0, length: 40, power: 100_000, maxAcceleration: 12 }, { type: "hill", x: 170, height: 6, crestRadius: 40 }, { type: "end", x: 320 }]
    });
    const run = runSimulation(config);
    expect(run.verdict.violations[0].code).toBe("contact");

    const patches = targetedPatches(config, run);

    expect(patches.some(patch => patch.track?.[2]?.power > 100_000)).toBe(false);
  });

  test("un primer tramo plano («Salida») sigue siendo el área de salida", () => {
    expect(areaForSection("Salida")).toBe("start");
    expect(areaForSection("Salida del loop")).toBe("loop");
    expect(areaForSection("Caída inicial")).toBe("start");
  });
});
