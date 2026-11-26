import { describe, test, expect } from "vitest";
import { stoppedByViolation, endedRejected } from "../src/lib/run-status";

describe("Estado final del recorrido", () => {
  test("la simulación se corta en un incumplimiento con rejected, lost-contact o timeout", () => {
    for (const status of ["rejected", "lost-contact", "timeout"]) expect(stoppedByViolation(status)).toBe(true);
  });

  test("un tren que se queda quieto antes de E no cortó la simulación: no llega", () => {
    expect(stoppedByViolation("stalled")).toBe(false);
  });

  test("terminar rechazado incluye quedarse quieto antes de E", () => {
    for (const status of ["rejected", "lost-contact", "stalled", "timeout"]) expect(endedRejected(status)).toBe(true);
    for (const status of ["finished", "stopped", "running"]) expect(endedRejected(status)).toBe(false);
  });

  test("un tren que termina o sigue corriendo no se detuvo por un incumplimiento", () => {
    for (const status of ["finished", "stopped", "running"]) expect(stoppedByViolation(status)).toBe(false);
  });
});
