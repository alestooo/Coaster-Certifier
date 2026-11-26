<script lang="ts">
  import type { Snippet } from "svelte";
  import { ChevronRight } from "lucide-svelte";

  /** Sección plegable de la app: un solo estilo, con el chevron de lucide en lugar del marcador del navegador. */
  interface Props {
    summary: string | Snippet;
    open?: boolean;
    children: Snippet;
  }

  let { summary, open = $bindable(false), children }: Props = $props();
</script>

<details class="disclosure" bind:open>
  <summary>
    <span class="chevron"><ChevronRight size={15} /></span>
    {#if typeof summary === "string"}{summary}{:else}{@render summary()}{/if}
  </summary>
  <div class="body">{@render children()}</div>
</details>

<style>
  summary {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: var(--control-sm);
    border-radius: var(--radius-sm);
    font-size: var(--text-13);
    font-weight: var(--weight-bold);
    color: var(--primary-strong);
    list-style: none;
    cursor: pointer;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .chevron {
    display: inline-flex;
    transition: transform 0.15s;
  }

  details[open] .chevron {
    transform: rotate(90deg);
  }

  .body {
    padding-top: var(--space-2);
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }
</style>
