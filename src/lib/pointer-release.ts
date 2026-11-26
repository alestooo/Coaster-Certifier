/**
 * Avisa cuando se suelta (o se cancela) el puntero en `target` (la ventana).
 *
 * Una manija que desaparece en pleno arrastre (Ctrl+Z vuelve a un recorrido
 * sin ella, Espacio reproduce y las oculta) ya no recibe su `pointerup`; la
 * ventana sí. Llama a `callback` una sola vez y devuelve cómo dejar de escuchar.
 */
export function onPointerRelease(target: EventTarget, callback: () => void): () => void {
  const stop = () => {
    target.removeEventListener("pointerup", finish);
    target.removeEventListener("pointercancel", finish);
  };
  const finish = () => {
    stop();
    callback();
  };

  target.addEventListener("pointerup", finish);
  target.addEventListener("pointercancel", finish);
  return stop;
}
