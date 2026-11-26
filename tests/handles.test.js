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
  test("el anexo tiene las ocho manijas y cada una está sobre su punto", () => {
    // Arrange / Act
    const { config, track, handles, byId } = setup();

    // Assert
    expect(handles.map(handle => handle.id).sort()).toEqual(
      ["brakeEnd", "brakeEntry", "crest", "hillFoot", "loopRadius", "loopTop", "speed", "start"].sort()
    );
    expect(byId("start")).toMatchObject({ x: 0, y: config.initialHeight, axis: "y", key: "initialHeight" });
    expect(byId("loopTop").y).toBeCloseTo(config.loopHeight, 6);
    expect(byId("brakeEnd").x).toBeCloseTo(track.endX, 6);
    expect(byId("brakeEntry").x).toBeCloseTo(track.brakeX, 6);
    expect(byId("loopRadius").x - byId("loopTop").x).toBeCloseTo(config.loopTopRadius, 6);
    expect(byId("crest").y).toBeCloseTo(config.hillHeight, 6);
  });

  test("las manijas principales son A, C, D, E y F y llevan su letra", () => {
    const { handles } = setup();
    const primary = handles.filter(handle => handle.primary);

    expect(primary.map(handle => handle.id).sort()).toEqual(["brakeEnd", "brakeEntry", "crest", "loopTop", "start"].sort());
    expect(primary.map(handle => handle.letter).sort()).toEqual(["A", "C", "D", "E", "F"]);
    expect(handles.filter(handle => !handle.primary).every(handle => handle.letter === undefined)).toBe(true);
  });

  test("«Línea» no tiene manijas de loop ni de colina", () => {
    const { handles } = setup({ mapId: "slope" });

    expect(handles.map(handle => handle.id).sort()).toEqual(["brakeEnd", "brakeEntry", "speed", "start"].sort());
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

  test("subir la cima del loop respeta h_L ≤ 20R", () => {
    // Arrange
    const { config, byId } = setup({ loopTopRadius: 1, loopHeight: 14 });

    // Act
    const proposal = proposeDrag(byId("loopTop"), { x: byId("loopTop").x, y: 50 }, config);

    // Assert
    expect(proposal.value).toBeCloseTo(20, 6);
    expect(proposal.patch.loopHeight).toBeCloseTo(20, 6);
    expect(proposal.limited).toBe(true);
  });

  test("el radio de la cima no supera h_L/2", () => {
    // Arrange
    const { config, byId } = setup();
    const top = byId("loopTop");

    // Act
    const proposal = proposeDrag(byId("loopRadius"), { x: top.x + 100, y: top.y }, config);

    // Assert
    expect(proposal.value).toBeCloseTo(config.loopHeight / 2, 6);
    expect(proposal.limited).toBe(true);
  });

  test("una colina que no cabe se detiene en el último ancho construible y explica por qué", () => {
    // Arrange
    const { config, byId } = setup({ trackWidth: 160 });

    // Act
    const proposal = proposeDrag(byId("hillFoot"), { x: 1000, y: 0 }, config);

    // Assert
    expect(proposal.limited).toBe(true);
    expect(proposal.reason).toMatch(/colina/i);
    expect(proposal.reason).not.toMatch(/\d\.\d/);
    expect(proposal.reason).toMatch(/\d,\d m/);
    expect(proposal.value).toBeGreaterThan(config.hillCrestRadius);
    expect(() => buildTrack({ ...config, ...proposal.patch })).not.toThrow();
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
    const text = handleText(byId("loopTop"), 21.5, config);

    expect(text.label).toBe("Altura del loop: 21,5 m");
    expect(text.symbol).toBe("h_L");
    expect(text.value).toBe("21,5 m");
  });

  test("los nombres accesibles de las manijas no tienen símbolos con guion bajo", () => {
    const { handles } = setup();

    expect(handles.length).toBeGreaterThan(0);
    for (const handle of handles) expect(handle.name, handle.id).not.toMatch(/_|ρ|v₀/);
  });

  test("arrastrar el radio con el cursor quieto converge: R = R₀ + desplazamiento desde el inicio del gesto", () => {
    // Arrange: la cima C se corre cuando cambia R, así que no sirve de referencia durante el arrastre.
    let { config, byId } = setup();
    const start = { handle: byId("loopRadius"), point: { x: byId("loopRadius").x, y: byId("loopRadius").y } };
    const cursor = { x: start.point.x + 0.5, y: start.point.y };

    // Act: varios movimientos del puntero en el mismo lugar.
    for (let move = 0; move < 6; move++) {
      const fresh = handlesFor(buildTrack(config), config).find(handle => handle.id === "loopRadius");
      config = resolveConfig({ ...config, ...proposeDrag(fresh, cursor, config, start).patch });
    }

    // Assert
    expect(config.loopTopRadius).toBeCloseTo(start.handle.value + 0.5, 6);
  });
});
