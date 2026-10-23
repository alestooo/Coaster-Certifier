<script lang="ts">
  import { LineChart, LayoutGrid, Settings2 } from "lucide-svelte";
  import ChartCard from "./ChartCard.svelte";
  import { CHART_KINDS } from "../../ui/charts/index.js";
  import type { SimulationConfig, SimulationState, Track, Verdict } from "../../lib/types";

  let {
    history,
    config,
    track,
    events
  }: {
    history: SimulationState[];
    config: SimulationConfig;
    track: Track;
    events: Verdict["violations"];
  } = $props();

  let kind = $state("load");
  let expanded = $state(false);
  let xAxis = $state<"time" | "distance">("time");
  let showMarkers = $state(true);
  let showSections = $state(true);
</script>

<section class="dock" aria-label="Gráficas en tiempo real">
  <header class="dock-head">
    <h2><LineChart size={16} /> Gráficas en tiempo real</h2>

    <div class="dock-tools">
      <div class="segmented" role="group" aria-label="Eje horizontal">
        <button type="button" class:active={xAxis === "time"} onclick={() => (xAxis = "time")}>Tiempo</button>
        <button type="button" class:active={xAxis === "distance"} onclick={() => (xAxis = "distance")}>Posición</button>
      </div>

      <details class="options">
        <summary><Settings2 size={14} /> Opciones</summary>
        <div class="options-menu">
          <label><input type="checkbox" bind:checked={showMarkers} /> Puntos críticos A–F</label>
          <label><input type="checkbox" bind:checked={showSections} /> Bandas por tramo</label>
        </div>
      </details>

      <button type="button" class="expand" class:active={expanded} onclick={() => (expanded = !expanded)}>
        <LayoutGrid size={14} /> {expanded ? "Una gráfica" : "Todas las gráficas"}
      </button>
    </div>
  </header>

  {#if expanded}
    <div class="dock-grid">
      {#each CHART_KINDS as item (item.id)}
        <ChartCard kind={item.id} {xAxis} {showMarkers} {showSections} {history} {config} {track} {events} height={210} />
      {/each}
    </div>
  {:else}
    <div class="dock-single">
      <nav class="kinds" aria-label="Magnitud graficada">
        {#each CHART_KINDS as item (item.id)}
          <button type="button" class:active={kind === item.id} onclick={() => (kind = item.id)}>{item.label}</button>
        {/each}
      </nav>

      <ChartCard {kind} {xAxis} {showMarkers} {showSections} {history} {config} {track} {events} height={260} />
    </div>
  {/if}
</section>

<style>
  .dock {
    display: grid;
    gap: 12px;
  }

  .dock-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .dock-head h2 {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 15px;
    color: var(--text);
  }

  .dock-tools {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .segmented {
    display: inline-flex;
    padding: 3px;
    border: 1px solid var(--border);
    border-radius: 11px;
    background: var(--surface-soft);
  }

  .segmented button,
  .expand,
  .options summary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--text-soft);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .segmented button.active {
    background: var(--surface);
    color: var(--primary);
    box-shadow: var(--shadow-sm);
  }

  .expand,
  .options summary {
    height: 36px;
    border: 1px solid var(--border);
    border-radius: 11px;
    background: var(--surface);
  }

  .expand.active {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--primary-soft);
  }

  .options {
    position: relative;
  }

  .options summary {
    list-style: none;
  }

  .options summary::-webkit-details-marker {
    display: none;
  }

  .options-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 20;
    display: grid;
    gap: 6px;
    min-width: 190px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow);
    font-size: 12px;
    color: var(--text-soft);
  }

  .options-menu label {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .options-menu input {
    accent-color: var(--primary);
  }

  .dock-single {
    display: grid;
    gap: 10px;
  }

  .kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .kinds button {
    height: 30px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    color: var(--muted);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .kinds button.active {
    border-color: var(--primary);
    background: var(--primary-soft);
    color: var(--primary-strong);
  }

  .dock-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 16px;
  }
</style>
