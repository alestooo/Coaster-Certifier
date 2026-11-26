<script lang="ts">
  import { pointLegend } from "../../lib/point-legend";
  import type { Track } from "../../lib/types";

  /** Qué significa cada letra A–F del anexo; las que este trazado no tiene, con el motivo. */
  let { track }: { track: Track } = $props();

  let items = $derived(pointLegend(track));
</script>

<ul class="points" aria-label="Puntos críticos A–F">
  {#each items as item (item.letter)}
    <li class:absent={!item.present}>
      <span class="letter" aria-hidden="true">{item.letter}</span>
      <span class="text">
        <span class="name"><span class="visually-hidden">{item.letter}: </span>{item.name}</span>
        {#if item.note}<span class="note">{item.note}</span>{/if}
      </span>
    </li>
  {/each}
</ul>

<style>
  .points {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .letter {
    display: grid;
    flex: none;
    place-items: center;
    width: 20px;
    height: 20px;
    border: 2px solid var(--surface);
    border-radius: 50%;
    background: var(--primary-strong);
    color: var(--on-primary);
    font-size: var(--text-11);
    font-weight: var(--weight-black);
    box-shadow: var(--shadow-sm);
  }

  .absent .letter {
    background: var(--surface-muted);
    color: var(--muted);
    box-shadow: none;
  }

  .text {
    display: grid;
    gap: 1px;
    padding-top: 1px;
  }

  .name {
    font-size: var(--text-12);
    font-weight: var(--weight-bold);
    color: var(--text);
  }

  .absent .name {
    color: var(--muted);
  }

  .note {
    font-size: var(--text-11);
    color: var(--muted);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
