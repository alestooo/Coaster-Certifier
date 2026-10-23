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

<label class="field-control" class:has-error={error}>
  <span class="field-head">
    <span class="field-symbol">{field.symbol}</span>
    <span class="field-label">{field.label}</span>
    {#if field.unit}
      <span class="field-unit">{field.unit}</span>
    {/if}
  </span>

  <span class="field-inputs">
    <input
      type="range"
      {min}
      {max}
      step={field.step}
      {value}
      aria-label={`${field.label} (deslizador)`}
      oninput={emit}
    />

    <input
      type="number"
      {min}
      {max}
      step="any"
      required
      {value}
      aria-label={field.label}
      onchange={emit}
    />
  </span>

  <small class="field-help">{field.help} <span class="field-range">({min}–{max}{field.unit ? ` ${field.unit}` : ""})</span></small>
</label>

<style>
  .field-control {
    display: grid;
    gap: 5px;
    margin-bottom: 12px;
    font-size: 12px;
  }

  .field-head {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .field-symbol {
    min-width: 34px;
    padding: 2px 6px;
    border-radius: 6px;
    background: #efe6f8;
    color: #6d4a8c;
    font-size: 10.5px;
    font-weight: 750;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .field-label {
    flex: 1;
    font-weight: 600;
    color: #4e3a63;
  }

  .field-unit {
    color: #9b84ab;
    font-size: 11px;
  }

  .field-inputs {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 86px;
    gap: 8px;
    align-items: center;
  }

  .field-inputs input[type="range"] {
    width: 100%;
    margin: 0;
    padding: 0;
    accent-color: #8c63aa;
  }

  .field-inputs input[type="number"] {
    width: 100%;
    min-width: 0;
    padding: 7px 8px;
    border: 1px solid #dfd0ea;
    border-radius: 8px;
    background: #fcfaff;
    color: #624b75;
    font: inherit;
    font-size: 12px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .has-error .field-inputs input[type="number"] {
    border-color: #d46b7f;
    background: #fff5f7;
  }

  .field-help {
    color: #9d84af;
    font-size: 10.5px;
    line-height: 1.45;
  }

  .field-range {
    white-space: nowrap;
    color: #b7a4c4;
  }
</style>
