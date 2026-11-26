<script lang="ts">
  import { untrack } from "svelte";
  import { Activity, ChevronDown, ChevronUp, LayoutGrid } from "lucide-svelte";
  import LoadError from "../LoadError.svelte";
  import { workshopParts } from "../../lib/workshop-parts";
  // Solo las definiciones: Chart.js viaja con ChartCard, que se precarga en reposo o al abrir la telemetría.
  import { CHART_KINDS } from "../../ui/charts/definitions.js";
  import type { SimulationRunner } from "../../lib/simulation-runner.svelte";
  import { formatNumber } from "../../ui/format";

  interface Props {
    runner: SimulationRunner;
    open: boolean;
  }

  let { runner, open = $bindable() }: Props = $props();

  const J_PER_KJ = 1000;
  const CHART_HEIGHT_PX = 150;

  let kind = $state("load");
  let xAxis = $state<"time" | "distance">("time");
  let expanded = $state(false);

  /** Último estado publicado (≤ 10 Hz durante la reproducción) o el instante elegido en la línea de tiempo. */
  let sample = $derived(runner.scrubIndex !== null ? runner.viewState : (runner.history.at(-1) ?? runner.state));
  let events = $derived(runner.state.events);

  const charts = workshopParts.charts;
  $effect(() => {
    if (open) untrack(() => void charts.load());
  });
</script>

<section class="telemetry" aria-label="Telemetría">
  <header>
    <button type="button" class="toggle" aria-label="Telemetría" aria-expanded={open} aria-controls="telemetry-body" onclick={() => (open = !open)}>
      <Activity size={15} />
      <span>Telemetría</span>
      {#if open}<ChevronDown size={15} />{:else}<ChevronUp size={15} />{/if}
    </button>

    <dl class="readings">
      <div><dt>Rapidez</dt><dd>{formatNumber(sample.speed, 1)} <small>m/s</small></dd></div>
      <div><dt>Fuerza g</dt><dd>{formatNumber(sample.load, 2)} <small>g</small></dd></div>
      <div class="optional"><dt>Energía mecánica</dt><dd>{formatNumber(sample.energies.mechanical / J_PER_KJ, 1)} <small>kJ</small></dd></div>
      <div class="optional"><dt>Tramo</dt><dd class="section">{sample.section}</dd></div>
    </dl>

    {#if open}
      <div class="chart-tools">
        {#if !expanded}
          <select bind:value={kind} aria-label="Magnitud graficada">
            {#each CHART_KINDS as item (item.id)}
              <option value={item.id}>{item.label} ({item.unit})</option>
            {/each}
          </select>
        {/if}

        <div class="segmented" role="group" aria-label="Eje horizontal">
          <button type="button" class:active={xAxis === "time"} aria-pressed={xAxis === "time"} onclick={() => (xAxis = "time")}>Tiempo</button>
          <button type="button" class:active={xAxis === "distance"} aria-pressed={xAxis === "distance"} onclick={() => (xAxis = "distance")}>Posición</button>
        </div>

        <button type="button" class="icon" class:active={expanded} aria-pressed={expanded} aria-label="Todas las gráficas" title="Todas las gráficas" onclick={() => (expanded = !expanded)}>
          <LayoutGrid size={15} />
        </button>
      </div>
    {/if}
  </header>

  {#if open}
    <div class="body" class:grid={expanded} id="telemetry-body">
      {#await charts.promise}
        <p class="loading">Cargando gráficas…</p>
      {:then module}
        {#if module && expanded}
          {#each CHART_KINDS as item (item.id)}
            <module.default kind={item.id} {xAxis} showMarkers showSections history={runner.history} config={runner.config} track={runner.track} {events} height={CHART_HEIGHT_PX} />
          {/each}
        {:else if module}
          <module.default {kind} {xAxis} showMarkers showSections history={runner.history} config={runner.config} track={runner.track} {events} height={CHART_HEIGHT_PX} showHead={false} />
        {/if}
      {:catch error}
        <LoadError message="No se pudieron descargar las gráficas." onRetry={() => charts.retry(error)} />
      {/await}
    </div>
  {/if}
</section>

<style>
  .loading {
    margin: 0;
    padding: 12px;
    font-size: 12.5px;
    color: var(--muted);
  }

  .telemetry {
    min-width: 0;
    border-top: 1px solid var(--border);
    background: var(--surface);
  }

  header {
    display: flex;
    align-items: center;
    gap: 16px;
    min-height: 44px;
    padding: 0 12px;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text-soft);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .toggle {
    padding: 0 10px;
    background: var(--surface-soft);
  }

  .readings {
    display: flex;
    flex: 1;
    gap: 22px;
    min-width: 0;
    margin: 0;
    overflow: hidden;
  }

  .readings div {
    display: flex;
    align-items: baseline;
    gap: 6px;
    white-space: nowrap;
  }

  dt {
    font-size: 11px;
    font-weight: 800;
    color: var(--muted);
  }

  dd {
    margin: 0;
    font-size: 14px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    color: var(--text);
  }

  dd small {
    font-size: 11px;
    font-weight: 800;
    color: var(--muted);
  }

  .section {
    font-size: 12.5px;
    font-weight: 800;
    color: var(--text-soft);
  }

  .chart-tools {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  select {
    height: 30px;
    max-width: 230px;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
  }

  .segmented {
    display: flex;
    padding: 2px;
    border-radius: 9px;
    background: var(--surface-muted);
  }

  .segmented button {
    height: 26px;
    padding: 0 9px;
    border: 0;
    background: transparent;
  }

  .segmented button.active,
  .icon.active {
    background: var(--surface);
    color: var(--primary-strong);
    box-shadow: var(--shadow-sm);
  }

  .icon {
    justify-content: center;
    width: 30px;
  }

  .body {
    padding: 0 12px 8px;
  }

  .body.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 12px;
    max-height: 52dvh;
    overflow: auto;
  }

  @media (max-width: 1100px) {
    .optional {
      display: none !important;
    }
  }

  @media (max-width: 700px) {
    header {
      flex-wrap: wrap;
      gap: 8px 14px;
      padding: 6px 10px;
    }

    .chart-tools {
      width: 100%;
    }

    select {
      flex: 1;
      max-width: none;
    }
  }

  @media (max-width: 420px) {
    .toggle span {
      display: none;
    }

    .readings {
      gap: 12px;
    }
  }
</style>
