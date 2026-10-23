<script lang="ts">
  import { limitsOf, type FieldDefinition } from "../../lib/field-definitions";

  let {
    field,
    value,
    error = false,
    onInput
  }: {
    field: FieldDefinition;
    value: number;
    error?: boolean;
    onInput: (value: number) => void;
  } = $props();

  let limits = $derived(limitsOf(field.key));
  let min = $derived(limits[0]);
  let max = $derived(limits[1]);

  function emit(event: Event) {
    const input = event.currentTarget as HTMLInputElement;

    if (Number.isFinite(input.valueAsNumber)) {
      onInput(input.valueAsNumber);
    }
  }
</script>

<div class="field" class:has-error={error} title={field.help}>
  <div class="field-row">
    <span class="field-symbol">{field.symbol}</span>
    <label class="field-label" for={`field-${field.key}`}>{field.label}</label>
    <span class="field-value">
      <input id={`field-${field.key}`} type="number" {min} {max} step="any" required {value} onchange={emit} />
      {#if field.unit}<span class="field-unit">{field.unit}</span>{/if}
    </span>
  </div>

  <input class="field-slider" type="range" {min} {max} step={field.step} {value} aria-label={`${field.label} (deslizador)`} oninput={emit} />
</div>

<style>
  .field {
    display: grid;
    gap: 4px;
    padding: 8px 0;
  }

  .field-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
  }

  .field-symbol {
    min-width: 38px;
    padding: 3px 6px;
    border-radius: 7px;
    background: var(--primary-soft);
    color: var(--primary-strong);
    font-size: 10.5px;
    font-weight: 900;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .field-label {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-soft);
    cursor: help;
  }

  .field-value {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .field-value input {
    width: 76px;
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 12.5px;
    font-weight: 800;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .field-value input:focus-visible {
    outline: 3px solid var(--primary-soft);
    border-color: var(--primary);
  }

  .has-error .field-value input {
    border-color: var(--danger);
    background: var(--danger-soft);
  }

  .field-unit {
    min-width: 28px;
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
  }

  .field-slider {
    width: 100%;
    margin: 0;
    accent-color: var(--primary);
  }
</style>
