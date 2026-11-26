/**
 * Bucle de dibujo bajo demanda.
 *
 * Mientras está activo (reproducción, arrastre, animación de cámara) dibuja
 * un cuadro por `requestAnimationFrame` con el tiempo real transcurrido.
 * Inactivo no gasta nada: cada `invalidate()` agenda un único cuadro, y
 * varios pedidos en el mismo tick se agrupan en ese cuadro.
 */
export interface FrameLoop {
  invalidate(): void;
  setActive(active: boolean): void;
  destroy(): void;
}

type RequestFrame = (callback: FrameRequestCallback) => number;
type CancelFrame = (handle: number) => void;

const MS_PER_SECOND = 1000;

export function createFrameLoop(
  draw: (elapsedSeconds: number) => void,
  raf: RequestFrame = callback => requestAnimationFrame(callback),
  caf: CancelFrame = handle => cancelAnimationFrame(handle)
): FrameLoop {
  let active = false;
  let destroyed = false;
  let handle: number | null = null;
  let previous: number | null = null;

  function frame(now: number) {
    handle = null;

    const elapsed = active && previous !== null ? (now - previous) / MS_PER_SECOND : 0;
    previous = active ? now : null;

    // Un cuadro que falla no detiene la animación; el error sigue llegando a la consola.
    try {
      draw(elapsed);
    } finally {
      if (active) schedule();
    }
  }

  function schedule() {
    if (handle === null && !destroyed) handle = raf(frame);
  }

  return {
    invalidate: schedule,
    setActive(next: boolean) {
      if (active === next) return;

      active = next;

      if (active) {
        schedule();
      } else {
        previous = null;
      }
    },
    destroy() {
      destroyed = true;
      if (handle !== null) caf(handle);
      handle = null;
    }
  };
}
