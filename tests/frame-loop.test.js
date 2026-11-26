import { describe, test, expect } from "vitest";
import { createFrameLoop } from "../src/lib/frame-loop.ts";

/** requestAnimationFrame falso: los cuadros se disparan a mano. */
function fakeFrames() {
  let queue = [];
  let now = 0;
  let nextId = 1;

  return {
    raf: callback => {
      const id = nextId++;
      queue.push({ id, callback });
      return id;
    },
    caf: id => {
      queue = queue.filter(entry => entry.id !== id);
    },
    /** Dispara los cuadros agendados, avanzando el reloj `ms`. */
    flush(ms = 16) {
      now += ms;
      const due = queue;
      queue = [];
      for (const entry of due) entry.callback(now);
    },
    get pending() {
      return queue.length;
    }
  };
}

describe("Bucle de cuadros bajo demanda", () => {
  test("inactivo, tres invalidate seguidos dibujan un solo cuadro", () => {
    // Arrange
    const frames = fakeFrames();
    const drawn = [];
    const loop = createFrameLoop(elapsed => drawn.push(elapsed), frames.raf, frames.caf);

    // Act
    loop.invalidate();
    loop.invalidate();
    loop.invalidate();
    frames.flush();
    frames.flush();

    // Assert
    expect(drawn).toEqual([0]);
    expect(frames.pending).toBe(0);
  });

  test("activo, dibuja en cada cuadro con el tiempo real y al desactivar se detiene", () => {
    // Arrange
    const frames = fakeFrames();
    const drawn = [];
    const loop = createFrameLoop(elapsed => drawn.push(elapsed), frames.raf, frames.caf);

    // Act
    loop.setActive(true);
    frames.flush(16);
    frames.flush(20);
    frames.flush(10);
    loop.setActive(false);
    frames.flush(16);
    frames.flush(16);

    // Assert: el primer cuadro activo no acumula tiempo; luego 20 ms y 10 ms.
    expect(drawn.slice(0, 3)).toEqual([0, 0.02, 0.01]);
    expect(drawn.length).toBeLessThanOrEqual(4);
    expect(frames.pending).toBe(0);
  });

  test("destroy cancela el cuadro agendado", () => {
    const frames = fakeFrames();
    const drawn = [];
    const loop = createFrameLoop(elapsed => drawn.push(elapsed), frames.raf, frames.caf);

    loop.invalidate();
    loop.destroy();
    frames.flush();

    expect(drawn).toEqual([]);
  });

  test("si un cuadro falla, el bucle activo sigue pidiendo cuadros (y el error no se oculta)", () => {
    const frames = fakeFrames();
    let calls = 0;
    const loop = createFrameLoop(
      () => {
        calls++;
        if (calls === 1) throw new Error("cuadro roto");
      },
      frames.raf,
      frames.caf
    );

    loop.setActive(true);
    expect(() => frames.flush()).toThrow("cuadro roto");
    expect(frames.pending).toBe(1);
    frames.flush();

    expect(calls).toBe(2);
  });
});
