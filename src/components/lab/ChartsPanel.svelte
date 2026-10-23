<script lang="ts">
  import ChartCard from "./ChartCard.svelte";
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

  let xAxis = $state<"time" | "distance">("time");
  let showMarkers = $state(true);
  let showSections = $state(true);
  let leftKind = $state("speed");
  let rightKind = $state("load");
  let twoCharts = $state(true);
</script>

<div class="charts-panel">
  <div class="charts-toolbar">
    <h2>Gráficas en tiempo real</h2>

    <div class="charts-controls">
      <label>
        Eje horizontal
        <select bind:value={xAxis}>
          <option value="time">Tiempo (s)</option>
          <option value="distance">Posición s (m)</option>
        </select>
      </label>

      <label><input type="checkbox" bind:checked={showMarkers} /> Puntos A–F</label>
      <label><input type="checkbox" bind:checked={showSections} /> Tramos</label>
      <label><input type="checkbox" bind:checked={twoCharts} /> Dos gráficas</label>
    </div>
  </div>

  <div class="charts-grid" class:single={!twoCharts}>
    <ChartCard bind:kind={leftKind} {xAxis} {showMarkers} {showSections} {history} {config} {track} {events} />

    {#if twoCharts}
      <ChartCard bind:kind={rightKind} {xAxis} {showMarkers} {showSections} {history} {config} {track} {events} />
    {/if}
  </div>
</div>

<style>
  .charts-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .charts-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .charts-toolbar h2 {
    margin: 0;
  }

  .charts-controls {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    font-size: 11px;
    color: #76528e;
  }

  .charts-controls label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin: 0;
  }

  .charts-controls select {
    width: auto;
  }

  .charts-controls input[type="checkbox"] {
    width: auto;
    accent-color: #8c63aa;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .charts-grid.single {
    grid-template-columns: 1fr;
  }

  @media (max-width: 1000px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
