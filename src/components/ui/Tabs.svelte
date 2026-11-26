<script lang="ts">
  import type { Snippet } from "svelte";
  import { nextIndex } from "../../lib/ui/roving";

  /** Pestañas accesibles (tablist/tab/tabpanel) con el mismo aspecto que el segmentado. */
  interface Props {
    label: string;
    tabs: { id: string; label: string }[];
    active: string;
    onChange: (id: string) => void;
    children: Snippet<[string]>;
  }

  let { label, tabs, active, onChange, children }: Props = $props();

  const uid = $props.id();
  let buttons: HTMLButtonElement[] = $state([]);

  function key(event: KeyboardEvent, index: number) {
    const next = nextIndex(index, event.key, tabs.length);
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].id);
    buttons[next]?.focus();
  }
</script>

<div class="tablist" role="tablist" aria-label={label}>
  {#each tabs as tab, index (tab.id)}
    <button
      bind:this={buttons[index]}
      type="button"
      role="tab"
      id={`${uid}-tab-${tab.id}`}
      aria-selected={tab.id === active}
      aria-controls={`${uid}-panel`}
      tabindex={tab.id === active ? 0 : -1}
      onclick={() => onChange(tab.id)}
      onkeydown={event => key(event, index)}
    >
      {tab.label}
    </button>
  {/each}
</div>

<div class="panel" role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${active}`}>
  {@render children(active)}
</div>

<style>
  .tablist {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius-md);
    background: var(--surface-muted);
  }

  button {
    height: calc(var(--control-md) - 6px);
    padding: 0 var(--space-3);
    border: 0;
    border-radius: calc(var(--radius-md) - 3px);
    background: transparent;
    color: var(--text-soft);
    font: inherit;
    font-size: var(--text-13);
    font-weight: var(--weight-bold);
    cursor: pointer;
  }

  button[aria-selected="true"] {
    background: var(--surface);
    color: var(--primary-strong);
    box-shadow: var(--shadow-sm);
  }

  button:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
</style>
