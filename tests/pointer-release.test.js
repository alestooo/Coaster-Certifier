import { describe, test, expect } from "vitest";
import { onPointerRelease } from "../src/lib/pointer-release.ts";

describe("Fin de un gesto aunque la manija desaparezca", () => {
  test("llama una sola vez al soltar o cancelar, y se puede quitar antes", () => {
    const target = new EventTarget();
    let calls = 0;

    onPointerRelease(target, () => calls++);
    target.dispatchEvent(new Event("pointerup"));
    target.dispatchEvent(new Event("pointercancel"));
    expect(calls).toBe(1);

    const stop = onPointerRelease(target, () => calls++);
    stop();
    target.dispatchEvent(new Event("pointerup"));
    expect(calls).toBe(1);
  });
});
