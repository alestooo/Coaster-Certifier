<script lang="ts">
  import { onMount } from "svelte";
  import { CHART_KINDS, createPhysicsChart, updatePhysicsChart, destroyPhysicsChart, chartImageUrl } from "../../ui/charts/index.js";
  import { downloadDataUrl, stampedName } from "../../ui/export";
  import type { SimulationConfig, SimulationState, Track, Verdict } from "../../lib/types";

  let {
    kind = $bindable("speed"),
    xAxis,
    showMarkers,
    showSections,
    history,
    config,
    track,
    events
  }: {
    kind?: string;
    xAxis: "time" | "distance";
    showMarkers: boolean;
    showSections: boolean;
    history: SimulationState[];
    config: SimulationConfig;
    track: Track;
    events: Verdict["violations"];
  } = $props();

  let canvas: HTMLCanvasElement;
  let chart: ReturnType<typeof createPhysicsChart> | undefined;

  onMount(() => {
    chart = createPhysicsChart(canvas, kind);

    return () => {
      if (chart) destroyPhysicsChart(chart);
      chart = undefined;
    };
  });

  $effect(() => {
    if (!chart) return;

    updatePhysicsChart(chart, history, {
      kind,
      xAxis,
      config,
      track,
      events,
      markers: showMarkers,
      sections: showSections,
      maxPoints: 1500
    });
  });

  function download() {
    if (!chart) return;
    downloadDataUrl(stampedName(`grafica-${kind}`, "png"), chartImageUrl(chart));
  }
</script>

<div class="chart-card">
  <div class="chart-tools">
    <select aria-label="Magnitud graficada" bind:value={kind}>
      {#each CHART_KINDS as option}
        <option value={option.id}>{option.label} ({option.unit})</option>
      {/each}
    </select>

    <button type="button" onclick={download} title="Descargar la gráfica como imagen PNG">⤓ PNG</button>
  </div>

  <div class="chart-area">
    <canvas bind:this={canvas} aria-label="Gráfica en tiempo real"></canvas>
  </div>
</div>

<style>
  .chart-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    min-height: 0;
  }

  .chart-tools {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .chart-tools select {
    flex: 1;
    min-width: 0;
  }

  .chart-area {
    position: relative;
    flex: 1;
    min-height: 230px;
  }
</style>
