<script lang="ts">
  import { Info } from "lucide-svelte";
  import Sym from "./Sym.svelte";
  import NumberField from "./NumberField.svelte";
  import { fieldLimits, type FieldDefinition } from "../../lib/field-definitions";
  import { valueToSlider, sliderToValue, decimalsFor, stepFrom, SLIDER_STEPS } from "../../lib/ui/slider-scale";
  import { formatNumber } from "../../ui/format";
  import type { SimulationConfig } from "../../lib/types";

  /**
   * Un parámetro del diseño: slider (con los límites del diseño actual) y
   * valor exacto en un campo con coma. Arrastrar el slider entero es un
   * solo paso de deshacer.
   */
  interface Props {
    field: FieldDefinition;
    config: SimulationConfig;
    error?: string;
    onInput: (value: number) => void;
    /** Inicio y fin del arrastre del slider: todo el gesto es un solo paso de deshacer. */
    onGesture?: (active: boolean) => void;
  }

  let { field, config, error = "", onInput, onGesture = () => {} }: Props = $props();

  const PAGE_STEPS = 10;
  const KEY_DIRECTION: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: PAGE_STEPS, PageDown: -PAGE_STEPS };

  let limits = $derived(fieldLimits(field.key, config));
  let scale = $derived({ min: limits[0], max: limits[1], step: field.step, scale: field.scale ?? "linear" });
  let value = $derived(config[field.key] as number);
  let position = $derived(valueToSlider(value, scale));
  let hint = $derived(field.hint && !error ? field.hint(config) : "");
  let valueText = $derived(`${formatNumber(value, decimalsFor(field.step))} ${field.unit}`.trim());
  let showHelp = $state(false);
  let dragging = false;

  function slide(event: Event) {
    const next = sliderToValue(Number((event.currentTarget as HTMLInputElement).value), scale);
    if (next !== value) onInput(next);
  }

  function start() {
    if (dragging) return;
    dragging = true;
    onGesture(true);
  }

  function end() {
    if (!dragging) return;
    dragging = false;
    onGesture(false);
  }

  /** Con el teclado el slider avanza de a un paso del campo (no de a una posición). */
  function key(event: KeyboardEvent) {
    const [min, max] = limits;
    let next: number | null = null;

    if (event.key === "Home") next = min;
    else if (event.key === "End") next = max;
    else if (KEY_DIRECTION[event.key]) next = stepFrom(value, KEY_DIRECTION[event.key], { min, max, step: field.step });
    if (next === null) return;

    event.preventDefault();
    if (next !== value) onInput(next);
  }
</script>

<div class="field" class:has-error={!!error}>
  <div class="head">
    <span class="name"><Sym symbol={field.symbol} /> {field.label}</span>
    <button
      type="button"
      class="info"
      aria-expanded={showHelp}
      aria-controls={`help-${field.key}`}
      aria-label={`Qué es: ${field.label}`}
      title="Qué es"
      onclick={() => (showHelp = !showHelp)}
    >
      <Info size={14} />
    </button>
    <NumberField
      id={`field-${field.key}`}
      {value}
      step={field.step}
      unit={field.unit}
      label={field.label}
      min={limits[0]}
      max={limits[1]}
      invalid={!!error}
      describedBy={error || hint ? `note-${field.key}` : undefined}
      onCommit={onInput}
    />
  </div>

  <input
    class="slider"
    type="range"
    min="0"
    max={SLIDER_STEPS}
    step="1"
    value={position}
    aria-label={field.label}
    aria-valuetext={valueText}
    style:--fill={`${(position / SLIDER_STEPS) * 100}%`}
    oninput={slide}
    onkeydown={key}
    onpointerdown={start}
    onpointerup={end}
    onpointercancel={end}
    onlostpointercapture={end}
    onchange={end}
  />

  {#if showHelp}
    <p class="help" id={`help-${field.key}`}>{field.help}</p>
  {/if}

  {#if error}
    <p class="note error" id={`note-${field.key}`} role="alert">{error}</p>
  {:else if hint}
    <p class="note" id={`note-${field.key}`}>{hint}</p>
  {/if}
</div>

<style>
  .field {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) 0;
  }

  .field + :global(.field) {
    border-top: 1px solid var(--border);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .name {
    flex: 1;
    min-width: 0;
    font-size: var(--text-13);
    font-weight: var(--weight-bold);
    color: var(--text);
  }

  .name :global(.sym) {
    display: inline-block;
    min-width: 1.6em;
    margin-right: var(--space-1);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
    background: var(--primary-soft);
    color: var(--primary-strong);
    font-size: var(--text-12);
    text-align: center;
  }

  .info {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--control-sm);
    height: var(--control-sm);
    padding: 0;
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .info:hover,
  .info[aria-expanded="true"] {
    background: var(--surface-muted);
    color: var(--primary-strong);
  }

  .info:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  /* Slider del sistema: riel con el tramo recorrido en el color primario. */
  .slider {
    width: 100%;
    height: 18px;
    margin: 0;
    background: transparent;
    cursor: pointer;
    appearance: none;
  }

  .slider::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: var(--radius-pill);
    background: linear-gradient(90deg, var(--primary) var(--fill), var(--surface-muted) var(--fill));
  }

  .slider::-moz-range-track {
    height: 6px;
    border-radius: var(--radius-pill);
    background: linear-gradient(90deg, var(--primary) var(--fill), var(--surface-muted) var(--fill));
  }

  .slider::-webkit-slider-thumb {
    width: 18px;
    height: 18px;
    margin-top: -6px;
    border: 2px solid var(--primary);
    border-radius: 50%;
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    appearance: none;
  }

  .slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border: 2px solid var(--primary);
    border-radius: 50%;
    background: var(--surface);
    box-shadow: var(--shadow-sm);
  }

  .slider:focus-visible {
    outline: none;
  }

  .slider:focus-visible::-webkit-slider-thumb {
    box-shadow: var(--focus-ring);
  }

  .slider:focus-visible::-moz-range-thumb {
    box-shadow: var(--focus-ring);
  }

  .help,
  .note {
    margin: 0;
    font-size: var(--text-12);
    line-height: 1.45;
    color: var(--text-soft);
  }

  .help {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-soft);
  }

  .note.error {
    color: var(--danger-text);
    font-weight: var(--weight-bold);
  }
</style>
