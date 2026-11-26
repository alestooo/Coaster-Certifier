import { describe, test, expect } from "vitest";
import { createHistory, record, undo, redo, canUndo, canRedo, MAX_HISTORY } from "../src/lib/design-history.ts";

describe("Historial de diseño (deshacer / rehacer)", () => {
  test("empieza sin pasos para deshacer ni rehacer", () => {
    // Arrange
    const history = createHistory({ H: 20 });

    // Act / Assert
    expect(history.present).toEqual({ H: 20 });
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  test("registrar un cambio permite deshacerlo y rehacerlo sin mutar el original", () => {
    // Arrange
    const initial = createHistory({ H: 20 });

    // Act
    const changed = record(initial, { H: 25 });
    const undone = undo(changed);
    const redone = redo(undone);

    // Assert
    expect(initial.present).toEqual({ H: 20 });
    expect(changed.present).toEqual({ H: 25 });
    expect(undone.present).toEqual({ H: 20 });
    expect(canRedo(undone)).toBe(true);
    expect(redone.present).toEqual({ H: 25 });
  });

  test("ignora un cambio idéntico al presente", () => {
    // Arrange
    const history = record(createHistory({ H: 20 }), { H: 25 });

    // Act
    const same = record(history, { H: 25 });

    // Assert
    expect(same).toBe(history);
  });

  test("un cambio nuevo descarta lo que se podía rehacer", () => {
    // Arrange
    const undone = undo(record(createHistory({ H: 20 }), { H: 25 }));

    // Act
    const branched = record(undone, { H: 30 });

    // Assert
    expect(branched.present).toEqual({ H: 30 });
    expect(canRedo(branched)).toBe(false);
  });

  test("deshacer o rehacer sin pasos devuelve el mismo historial", () => {
    // Arrange
    const history = createHistory({ H: 20 });

    // Act / Assert
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  test("conserva como máximo MAX_HISTORY pasos anteriores", () => {
    // Arrange
    let history = createHistory({ H: 0 });

    // Act
    for (let value = 1; value <= MAX_HISTORY + 10; value++) {
      history = record(history, { H: value });
    }

    // Assert
    expect(history.past).toHaveLength(MAX_HISTORY);
    expect(history.past[0]).toEqual({ H: 10 });
  });
});
