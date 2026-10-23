<script lang="ts">
  import { onMount } from "svelte";
  import { Download } from "lucide-svelte";
  import { CHART_KINDS, createPhysicsChart, updatePhysicsChart, destroyPhysicsChart, chartImageUrl } from "../../ui/charts/index.js";
  import { downloadDataUrl, stampedName } from "../../ui/export";
  import type { SimulationConfig, SimulationState, Track, Verdict } from "../../lib/types";

  let {
    kind,
    xAxis,
    showMarkers,
    showSections,
    history,
    config,
    track,
    events,
    height = 240
  }: {
    kind: string;
    xAxis: "time" | "distance";
    showMarkers: boolean;
    showSections: boolean;
    history: SimulationState[];
    config: SimulationConfig;
    track: Track;
    events: Verdict["violations"];
    height?: number;
  } = $props();

  let canvas: HTMLCanvasElement;
  let chart: ReturnType<typeof createPhysicsChart> | undefined;

  let definition = $derived(CHART_KINDS.find(item => item.id === kind) ?? CHART_KINDS[0]);

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
  <div class="chart-head">
    <strong>{definition.label} <small>({definition.unit})</small></strong>
    <button type="button" onclick={download} title="Descargar como PNG" aria-label="Descargar gráfica como PNG"><Download size={14} /></button>
  </div>

  <div class="chart-area" style:height={`${height}px`}>
    <canvas bind:this={canvas} aria-label={`Gráfica de ${definition.label}`}></canvas>
  </div>
</div>

<style>
  .chart-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .chart-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .chart-head strong {
    font-size: 12.5px;
    color: var(--text-soft);
  }

  .chart-head small {
    font-weight: 600;
    color: var(--muted);
  }

  .chart-head button {
    display: inline-grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--muted);
    cursor: pointer;
  }

  .chart-area {
    position: relative;
    width: 100%;
  }
</style>
