import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { DesignSession } from "../src/lib/design-session.svelte.ts";
import { createPassenger, calculateTotalMass, CART_MASS, MAX_TRAIN_CARS } from "../src/game/passengers.ts";
import { DEFAULT_CONFIG } from "../src/physics/index.js";

/** Pausa del commit (120 ms) más un margen. */
const AFTER_COMMIT_MS = 130;
/** Pausa tras la cual una serie de cambios cuenta como un paso de deshacer (600 ms) más un margen. */
const AFTER_SETTLE_MS = 700;

function newSession(input = {}) {
  return new DesignSession({ ...DEFAULT_CONFIG, mapId: "reference", ...input }, [createPassenger(1), createPassenger(2)]);
}

describe("Sesión de diseño", () => {
  let session;

  beforeEach(() => {
    vi.useFakeTimers();
    session = newSession();
  });

  afterEach(() => {
    session.destroy();
    vi.useRealTimers();
  });

  test("un cambio se simula tras 120 ms", () => {
    // Act
    session.patch({ brakingLength: 30 });
    const before = session.runner.config.brakingLength;
    vi.advanceTimersByTime(AFTER_COMMIT_MS);

    // Assert
    expect(before).toBe(DEFAULT_CONFIG.brakingLength);
    expect(session.runner.config.brakingLength).toBe(30);
  });

  test("un valor fuera de rango deja el último diseño válido y explica el error", () => {
    // Act
    session.patch({ loopHeight: 500 });
    vi.advanceTimersByTime(AFTER_COMMIT_MS);

    // Assert
    expect(session.errorField).toBe("loopHeight");
    expect(session.errorMessage).toMatch(/Altura del loop/);
    expect(session.runner.config.loopHeight).toBe(DEFAULT_CONFIG.loopHeight);
  });

  test("varios cambios seguidos se deshacen en un solo paso", () => {
    // Arrange
    for (const brakingLength of [70, 60, 50]) {
      session.patch({ brakingLength });
      vi.advanceTimersByTime(50);
    }
    vi.advanceTimersByTime(AFTER_SETTLE_MS);

    // Act
    session.undo();

    // Assert
    expect(session.runner.config.brakingLength).toBe(DEFAULT_CONFIG.brakingLength);
    expect(session.canRedo).toBe(true);
  });

  test("loadTemplate cambia el recorrido, conserva las masas y se puede deshacer", () => {
    // Arrange
    const massBefore = session.runner.config.mass;

    // Act
    session.loadTemplate("loop");
    const afterLoad = session.runner.config.mapId;
    session.undo();

    // Assert
    expect(afterLoad).toBe("loop");
    expect(session.runner.config.mass).toBe(massBefore);
    expect(session.runner.config.mapId).toBe("reference");
  });

  test("el trazado del anexo se carga con los valores del anexo", () => {
    // Arrange: partir de otro trazado con valores cambiados.
    session.loadTemplate("loop");
    session.patch({ initialHeight: 18, brakingLength: 120 });

    // Act
    session.loadTemplate("reference");

    // Assert
    expect(session.runner.config).toMatchObject({
      mapId: "reference",
      initialHeight: 30,
      trackWidth: 320,
      loopHeight: 21.5,
      loopTopRadius: 5,
      hillHeight: 10,
      hillCrestRadius: 55,
      brakingLength: 60
    });
  });

  test("la masa total suma carritos y pasajeros", () => {
    expect(session.runner.config.mass).toBe(calculateTotalMass([createPassenger(1), createPassenger(2)]));
  });

  test("cambiar la cantidad de pasajeros ajusta masas y carritos", () => {
    // Arrange
    const three = [1, 2, 3].map(id => createPassenger(id));

    // Act
    session.setPassengers(three);
    vi.advanceTimersByTime(AFTER_COMMIT_MS);

    // Assert
    expect(session.masses).toHaveLength(3);
    expect(session.runner.config.mass).toBe(calculateTotalMass(three));
  });

  test("se pueden elegir más carros que los que piden los pasajeros: los vacíos suman su masa y se deshace", () => {
    // Act: dos pasajeros (un carro) en un tren de cinco.
    session.setTrainCars(5);
    vi.advanceTimersByTime(AFTER_SETTLE_MS);

    // Assert
    expect(session.cartCount).toBe(5);
    expect(session.runner.config.trainCars).toBe(5);
    expect(session.runner.config.mass).toBe(5 * CART_MASS + session.masses.reduce((sum, mass) => sum + mass, 0));

    session.undo();
    expect(session.runner.config.trainCars).toBe(1);
  });

  test("los pasajeros nunca quedan sin asiento: con más pasajeros el tren crece aunque se haya elegido menos", () => {
    session.setTrainCars(1);
    session.setPassengers([1, 2, 3].map(id => createPassenger(id)));
    vi.advanceTimersByTime(AFTER_COMMIT_MS);

    expect(session.cartCount).toBe(2);
    expect(session.runner.config.trainCars).toBe(2);
  });

  test("la cantidad de carros elegida se recorta al rango del taller", () => {
    session.setTrainCars(40);
    vi.advanceTimersByTime(AFTER_COMMIT_MS);
    expect(session.cartCount).toBe(MAX_TRAIN_CARS);

    session.setTrainCars(0);
    vi.advanceTimersByTime(AFTER_COMMIT_MS);
    expect(session.cartCount).toBe(1);
  });

  test("la vista previa refleja el borrador antes del commit y es null si es inválido", () => {
    // Act
    session.patch({ brakingLength: 30 });
    const valid = session.preview;
    session.patch({ loopHeight: 500 });
    const invalid = session.preview;

    // Assert
    expect(valid.config.brakingLength).toBe(30);
    expect(valid.track.endX - valid.track.brakeX).toBeCloseTo(30, 9);
    expect(invalid).toBeNull();
    expect(session.runner.config.brakingLength).toBe(DEFAULT_CONFIG.brakingLength);
  });

  test("un gesto con pausas largas cuenta como un solo paso de deshacer", () => {
    // Arrange
    session.beginGesture();
    session.patch({ brakingLength: 72 });
    vi.advanceTimersByTime(AFTER_SETTLE_MS);
    session.patch({ brakingLength: 60 });
    vi.advanceTimersByTime(AFTER_SETTLE_MS);
    session.endGesture();

    // Act
    session.undo();

    // Assert
    expect(session.runner.config.brakingLength).toBe(DEFAULT_CONFIG.brakingLength);
  });

  test("dos gestos seguidos, aunque estén a menos de 600 ms, son dos pasos", () => {
    // Arrange
    session.beginGesture();
    session.patch({ brakingLength: 70 });
    session.endGesture();
    vi.advanceTimersByTime(100);
    session.beginGesture();
    session.patch({ brakingLength: 50 });
    session.endGesture();

    // Act
    session.undo();

    // Assert
    expect(session.runner.config.brakingLength).toBe(70);
  });

  test("dos cambios discretos del trazado (agregar y borrar) seguidos son dos pasos de deshacer", () => {
    // Arrange: agregar un punto y enseguida borrarlo, a menos de 600 ms.
    const original = session.runner.config.track;
    const added = [...original.slice(0, -1), { type: "point", x: original.at(-1).x - 6, y: 0 }, original.at(-1)];
    session.setTrack(added, { step: true });
    vi.advanceTimersByTime(50);
    session.setTrack(original, { step: true });

    // Act
    session.undo();

    // Assert
    expect(session.runner.config.track).toHaveLength(original.length + 1);
    session.undo();
    expect(session.runner.config.track).toHaveLength(original.length);
  });

  test("una manija descarta un valor inválido de otro campo en lugar de quedar bloqueada", () => {
    // Arrange: n_máx fuera de rango escrito en el panel de reglas.
    session.patch({ maxLoad: 50 });
    vi.advanceTimersByTime(AFTER_COMMIT_MS);
    const blocked = session.errorField;

    // Act
    session.patch({ brakingLength: 60 }, { discardInvalid: true });
    vi.advanceTimersByTime(AFTER_COMMIT_MS);

    // Assert
    expect(blocked).toBe("maxLoad");
    expect(session.errorField).toBe("");
    expect(session.runner.config.brakingLength).toBe(60);
    expect(session.runner.config.maxLoad).toBe(DEFAULT_CONFIG.maxLoad);
  });

  test("con una masa inválida no hay vista previa", () => {
    // Act
    session.setPassengerMass(0, 5);

    // Assert
    expect(session.preview).toBeNull();
  });
});
