/**
 * Próximo elemento al moverse con el teclado por un grupo de opciones
 * (listbox, segmentado, pestañas): flechas con vuelta, Home y End, saltando
 * los deshabilitados. Otra tecla, o ninguna opción habilitada → null.
 */
const STEP: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

export function nextIndex(current: number, key: string, count: number, disabled: readonly boolean[] = []): number | null {
  const enabled = (index: number) => !disabled[index];
  if (count <= 0 || !Array.from({ length: count }, (_, index) => index).some(enabled)) return null;

  if (key === "Home" || key === "End") {
    const direction = key === "Home" ? 1 : -1;
    let index = key === "Home" ? 0 : count - 1;
    while (!enabled(index)) index += direction;
    return index;
  }

  const step = STEP[key];
  if (!step) return null;

  let index = current;
  do index = (index + step + count) % count;
  while (!enabled(index));
  return index;
}
