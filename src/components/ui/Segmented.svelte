<script lang="ts" generics="T extends string">
  import { nextIndex } from "../../lib/ui/roving";
  import type { IconComponent } from "../../lib/ui/icon";

  /** Opciones excluyentes (radiogroup): un solo diseño en toda la app, con flechas de teclado. */
  interface Option {
    value: T;
    label: string;
    icon?: IconComponent;
    /** Nombre accesible cuando la opción es solo un ícono o un dibujo. */
    ariaLabel?: string;
  }

  interface Props {
    label: string;
    value: T;
    options: Option[];
    onChange: (value: T) => void;
    size?: "sm" | "md";
    /** Ocupa todo el ancho, con opciones de igual tamaño. */
    block?: boolean;
  }

  let { label, value, options, onChange, size = "md", block = false }: Props = $props();

  let buttons: HTMLButtonElement[] = $state([]);

  function key(event: KeyboardEvent, index: number) {
    const next = nextIndex(index, event.key, options.length);
    if (next === null) return;
    event.preventDefault();
    onChange(options[next].value);
    buttons[next]?.focus();
  }
</script>

<div class="segmented {size}" class:block role="radiogroup" aria-label={label}>
  {#each options as option, index (option.value)}
    {@const Icon = option.icon}
    <button
      bind:this={buttons[index]}
      type="button"
      role="radio"
      aria-checked={option.value === value}
      aria-label={option.ariaLabel}
      tabindex={option.value === value ? 0 : -1}
      onclick={() => onChange(option.value)}
      onkeydown={event => key(event, index)}
    >
      {#if Icon}<Icon size={14} />{/if}
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius-md);
    background: var(--surface-muted);
  }

  .block {
    display: flex;
    width: 100%;
  }

  .block button {
    flex-basis: 0;
  }

  button {
    display: inline-flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    padding: 0 var(--space-3);
    border: 0;
    border-radius: calc(var(--radius-md) - 3px);
    background: transparent;
    color: var(--text-soft);
    font: inherit;
    font-weight: var(--weight-bold);
    white-space: nowrap;
    cursor: pointer;
  }

  .sm button {
    height: calc(var(--control-sm) - 6px);
    font-size: var(--text-12);
  }

  .md button {
    height: calc(var(--control-md) - 6px);
    font-size: var(--text-13);
  }

  button[aria-checked="true"] {
    background: var(--surface);
    color: var(--primary-strong);
    box-shadow: var(--shadow-sm);
  }

  button:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
</style>
