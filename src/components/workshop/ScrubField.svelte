<script lang="ts">
  import { limitsOf, type FieldDefinition } from "../../lib/field-definitions";
  import type { SimulationConfig } from "../../lib/types";

  interface Props {
    field: FieldDefinition;
    config: SimulationConfig;
    error?: string;
    onInput: (value: number) => void;
    /** Inicio y fin del arrastre de la etiqueta: todo el gesto es un solo paso de deshacer. */
    onGesture?: (active: boolean) => void;
  }

  let { field, config, error = "", onInput, onGesture = () => {} }: Props = $props();

  /** Píxeles de arrastre horizontal por cada paso del campo. */
  const PX_PER_STEP = 4;
  const BIG_STEP = 10;

  let limits = $derived(limitsOf(field.key));
  let value = $derived(config[field.key] as number);
  let fraction = $derived(Math.min(1, Math.max(0, (value - limits[0]) / (limits[1] - limits[0]))));
  let hint = $derived(field.hint && !error ? field.hint(config) : "");
  let scrub: { x: number; value: number } | null = null;

  function decimals(step: number) {
    return Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  }

  function startScrub(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    scrub = { x: event.clientX, value };
    onGesture(true);
  }

  function moveScrub(event: PointerEvent) {
    if (!scrub) return;

    const steps = Math.round((event.clientX - scrub.x) / PX_PER_STEP) * (event.shiftKey ? BIG_STEP : 1);
    const next = Math.min(limits[1], Math.max(limits[0], scrub.value + steps * field.step));
    const rounded = Number(next.toFixed(decimals(field.step)));

    if (rounded !== value) onInput(rounded);
  }

  function endScrub() {
    if (!scrub) return;
    scrub = null;
    onGesture(false);
  }

  /** Esc descarta lo escrito (como en las manijas) en lugar de aplicarlo al perder el foco. */
  function typedKey(event: KeyboardEvent) {
    if (event.key !== "Escape") return;

    const input = event.currentTarget as HTMLInputElement;
    input.value = String(value);
    input.blur();
  }

  function typed(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (Number.isFinite(input.valueAsNumber)) onInput(input.valueAsNumber);
  }
</script>

<div class="field" class:has-error={!!error}>
  <div class="row">
    <!-- No es <label>: un clic tras arrastrar la etiqueta no debe enfocar el campo (Ctrl+Z seguiría deshaciendo el diseño).
         Arrastrarla es un atajo solo para puntero; el control accesible es el campo numérico, que la usa como nombre. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      class="scrub-label"
      id={`label-${field.key}`}
      title={`${field.help} Arrastrá la etiqueta para cambiar el valor.`}
      onpointerdown={startScrub}
      onpointermove={moveScrub}
      onpointerup={endScrub}
      onpointercancel={endScrub}
    >
      <span class="symbol">{field.symbol}</span>
      {field.label}
    </span>
    <span class="value">
      <input
        id={`field-${field.key}`}
        type="number"
        min={limits[0]}
        max={limits[1]}
        step="any"
        {value}
        aria-labelledby={`label-${field.key}`}
        aria-invalid={!!error}
        aria-describedby={`note-${field.key}`}
        onchange={typed}
        onkeydown={typedKey}
      />
      {#if field.unit}<span class="unit">{field.unit}</span>{/if}
    </span>
  </div>

  <div class="range" aria-hidden="true"><i style:width={`${fraction * 100}%`}></i></div>

  {#if error}
    <p class="note error" id={`note-${field.key}`} role="alert">{error}</p>
  {:else if hint}
    <p class="note" id={`note-${field.key}`}>{hint}</p>
  {/if}
</div>

<style>
  .field {
    display: grid;
    gap: 5px;
    padding: 9px 0;
  }

  .field + :global(.field) {
    border-top: 1px dashed var(--border);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .scrub-label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    font-size: 13px;
    font-weight: 800;
    color: var(--text);
    cursor: ew-resize;
    user-select: none;
    touch-action: none;
  }

  .symbol {
    padding: 2px 6px;
    border-radius: 6px;
    background: var(--primary-soft);
    color: var(--primary-strong);
    font-size: 11.5px;
    font-weight: 900;
    font-style: italic;
  }

  .value {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  input {
    width: 76px;
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 13px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  input:focus {
    outline: 2px solid var(--primary);
    outline-offset: 1px;
  }

  .unit {
    min-width: 34px;
    font-size: 11.5px;
    font-weight: 800;
    color: var(--muted);
  }

  .range {
    height: 3px;
    border-radius: 3px;
    background: var(--surface-muted);
    overflow: hidden;
  }

  .range i {
    display: block;
    height: 100%;
    background: var(--primary);
    opacity: 0.55;
  }

  .note {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.4;
    color: var(--muted);
  }

  .note.error {
    color: #b7303f;
    font-weight: 700;
  }

  .has-error input {
    border-color: var(--danger);
    background: var(--danger-soft);
  }
</style>
