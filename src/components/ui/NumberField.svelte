<script lang="ts">
  import { formatNumber, parseDecimal } from "../../ui/format";
  import { decimalsFor, stepFrom } from "../../lib/ui/slider-scale";

  /**
   * Campo numérico de la app: texto con teclado decimal, muestra y acepta
   * coma, sin las flechas nativas. Confirma con Enter o al salir; Esc
   * descarta lo escrito; las flechas suman o restan un paso (Shift: ×10).
   * Lo ilegible no cambia nada: el campo vuelve a mostrar el valor vigente.
   */
  interface Props {
    value: number;
    step: number;
    /** Nombre accesible (se lee en voz alta). */
    label: string;
    unit?: string;
    min?: number;
    max?: number;
    id?: string;
    describedBy?: string;
    invalid?: boolean;
    /** Enfoca y selecciona el valor al aparecer (edición escrita de una manija). */
    autofocus?: boolean;
    onCommit: (value: number) => void;
  }

  let { value, step, label, unit = "", min = -Infinity, max = Infinity, id, describedBy, invalid = false, autofocus = false, onCommit }: Props = $props();

  const BIG_STEP = 10;

  let input: HTMLInputElement;
  /** Texto mientras se escribe; null cuando el campo muestra el valor vigente. */
  let draft = $state<string | null>(null);
  let shown = $derived(formatNumber(value, decimalsFor(step)));

  $effect(() => {
    if (!autofocus) return;
    input.focus();
    input.select();
  });

  function commit() {
    const parsed = draft === null ? null : parseDecimal(draft);
    draft = null;
    if (parsed !== null && parsed !== value) onCommit(parsed);
  }

  function nudge(direction: number, big: boolean) {
    const next = stepFrom(value, direction * (big ? BIG_STEP : 1), { min, max, step });
    draft = null;
    if (next !== value) onCommit(next);
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      // Descarta lo escrito; no cierra el panel (el segundo Esc sí).
      event.preventDefault();
      event.stopPropagation();
      draft = null;
      input.blur();
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      nudge(event.key === "ArrowUp" ? 1 : -1, event.shiftKey);
    }
  }
</script>

<span class="number" class:invalid>
  <input
    bind:this={input}
    {id}
    type="text"
    inputmode="decimal"
    autocomplete="off"
    spellcheck="false"
    aria-label={label}
    aria-invalid={invalid}
    aria-describedby={describedBy}
    value={draft ?? shown}
    oninput={event => (draft = event.currentTarget.value)}
    onblur={commit}
    onkeydown={keydown}
  />
  <!-- Siempre presente, aun vacía (μ): así los campos de un panel quedan alineados. -->
  <span class="unit" aria-hidden="true">{unit}</span>
</span>

<style>
  .number {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  input {
    width: 76px;
    height: var(--control-md);
    padding: 0 var(--space-2);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: var(--text-13);
    font-weight: var(--weight-bold);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  input:focus-visible {
    outline: none;
    border-color: var(--primary);
    box-shadow: var(--focus-ring);
  }

  .invalid input {
    border-color: var(--danger);
    color: var(--danger-text);
  }

  .unit {
    min-width: 2.2em;
    font-size: var(--text-12);
    font-weight: var(--weight-bold);
    color: var(--muted);
  }
</style>
