<script lang="ts" generics="T extends string">
  import type { ChoiceOption } from "../../lib/field-definitions";

  let {
    legend,
    name,
    options,
    value,
    onChange
  }: {
    legend: string;
    name: string;
    options: ChoiceOption<T>[];
    value: T;
    onChange: (value: T) => void;
  } = $props();
</script>

<fieldset class="choices">
  <legend>{legend}</legend>

  <div class="choice-row">
    {#each options as option (option.value)}
      <label class="choice" class:selected={value === option.value}>
        <input type="radio" {name} value={option.value} checked={value === option.value} onchange={() => onChange(option.value)} />
        <span class="radio" aria-hidden="true"></span>
        <strong>{option.title}</strong>
        <span class="description">{option.description}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .choices {
    margin: 0;
    padding: 8px 0 6px;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 7px;
    font-size: 10.5px;
    font-weight: 900;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .choice-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .choice {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto 1fr;
    column-gap: 7px;
    row-gap: 3px;
    padding: 9px 10px;
    border: 1px solid var(--border);
    border-radius: 11px;
    background: var(--surface);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }

  .choice:hover {
    border-color: var(--border-strong);
  }

  .choice:focus-within {
    box-shadow: 0 0 0 3px var(--primary-soft);
  }

  .choice input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .radio {
    width: 14px;
    height: 14px;
    margin-top: 1px;
    border: 2px solid var(--border-strong);
    border-radius: 50%;
    background: var(--surface);
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .choice.selected {
    border-color: var(--primary);
    background: var(--primary-soft);
  }

  .choice.selected .radio {
    border-color: var(--primary);
    box-shadow: inset 0 0 0 3px var(--surface), inset 0 0 0 8px var(--primary);
  }

  .choice strong {
    font-size: 12px;
    line-height: 1.25;
    color: var(--text);
  }

  .description {
    grid-column: 1 / -1;
    font-size: 10.5px;
    line-height: 1.4;
    color: var(--muted);
  }
</style>
