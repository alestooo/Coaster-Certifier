import { describe, test, expect, vi, afterEach } from "vitest";
import { whenIdle } from "../src/lib/idle.ts";

describe("Trabajo en reposo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("usa requestIdleCallback cuando existe, y se puede cancelar", () => {
    const callbacks = new Map();
    let next = 0;
    vi.stubGlobal("requestIdleCallback", callback => {
      callbacks.set(++next, callback);
      return next;
    });
    vi.stubGlobal("cancelIdleCallback", id => callbacks.delete(id));
    let runs = 0;

    const cancel = whenIdle(() => runs++, 1500);
    expect(callbacks.size).toBe(1);
    cancel();

    expect(callbacks.size).toBe(0);
    expect(runs).toBe(0);
  });

  test("sin requestIdleCallback (Safari) espera el tiempo de respaldo", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    let runs = 0;

    whenIdle(() => runs++, 1500);
    vi.advanceTimersByTime(1499);
    expect(runs).toBe(0);
    vi.advanceTimersByTime(1);

    expect(runs).toBe(1);
  });
});
