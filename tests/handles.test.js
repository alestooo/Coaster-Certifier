import { describe, test, expect } from "vitest";
import { buildTrack, resolveConfig } from "../src/physics/index.js";
import { handlesFor, proposeDrag, proposeValue, handleText, SPEED_ARROW_M_PER_MPS } from "../src/lib/handles.ts";

/** Configuración, trazado y manijas de un recorrido. */
function setup(input = {}) {
  const config = resolveConfig({ mapId: "reference", ...input });
  const track = buildTrack(config);
  const handles = handlesFor(track, config);
  const byId = id => handles.find(handle => handle.id === id);
  return { config, track, handles, byId };
}

describe("Manijas sobre la pista", () => {
  test("las manijas globales son A (H), la flecha v₀ y F (d_f); las del trazado están en track-edit", () => {
    // Arrange / Act
    const { config, track, handles, byId } = setup();

    // Assert
    expect(handles.map(handle => handle.id).sort()).toEqual(["brakeEnd", "speed", "start"]);
    expect(byId("start")).toMatchObject({ x: 0, y: config.initialHeight, axis: "y", key: "initialHeight", letter: "A" });
    expect(byId("brakeEnd").x).toBeCloseTo(track.endX, 6);
    expect(byId("brakeEnd").letter).toBe("F");
    expect(byId("speed").letter).toBeUndefined();
  });

  test("«Línea» tiene las mismas tres manijas globales", () => {
    const { handles } = setup({ mapId: "slope" });

    expect(handles.map(handle => handle.id).sort()).toEqual(["brakeEnd", "speed", "start"]);
  });

  test("arrastrar F 10 m a la izquierda acorta la zona de frenado 10 m", () => {
    // Arrange
    const { config, track, byId } = setup();

    // Act
    const proposal = proposeDrag(byId("brakeEnd"), { x: track.endX - 10, y: 0 }, config);

    // Assert
    expect(proposal.patch.brakingLength).toBeCloseTo(config.brakingLength - 10, 6);
    expect(proposal.limited).toBe(false);
    expect(proposal.reason).toBeNull();
  });

  test("arrastrar la flecha v₀ a lo largo de la tangente fija v₀ = largo/3", () => {
    // Arrange
    const { config, byId } = setup({ initialSpeed: 0 });
    const speed = byId("speed");
    const length = 2 * SPEED_ARROW_M_PER_MPS;

    // Act
    const proposal = proposeDrag(
      speed,
      { x: speed.anchor.x + speed.direction.x * length, y: speed.anchor.y + speed.direction.y * length },
      config
    );

    // Assert
    expect(SPEED_ARROW_M_PER_MPS).toBe(3);
    expect(proposal.patch.initialSpeed).toBeCloseTo(2, 6);
  });

  test("proposeValue respeta el paso del campo", () => {
    const { config, byId } = setup();

    expect(proposeValue(byId("start"), 20.26, config).value).toBeCloseTo(20.5, 9);
  });

  test("handleText da un texto hablado (sin símbolos con guion bajo) y, aparte, el símbolo y el valor para la etiqueta", () => {
    const { config, byId } = setup();
    const text = handleText(byId("brakeEnd"), 22, config);

    expect(text.label).toBe("Largo de frenado: 22 m");
    expect(text.symbol).toBe("d_f");
    expect(text.value).toBe("22 m");
  });

  test("los nombres accesibles de las manijas no tienen símbolos con guion bajo", () => {
    const { handles } = setup();

    expect(handles.length).toBeGreaterThan(0);
    for (const handle of handles) expect(handle.name, handle.id).not.toMatch(/_|ρ|v₀/);
  });
});
