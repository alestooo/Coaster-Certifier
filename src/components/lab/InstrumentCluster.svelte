<script lang="ts">
  import { Gauge as GaugeIcon, Ruler, ArrowUpFromLine, Timer, Activity, Zap } from "lucide-svelte";
  import Gauge from "./Gauge.svelte";
  import type { SimulationConfig, SimulationState } from "../../lib/types";
  import { formatNumber, kmh } from "../../ui/format";

  let { state, config, maxSpeed }: { state: SimulationState; config: SimulationConfig; maxSpeed: number } = $props();

  let speedMax = $derived(Math.max(60, Math.ceil((kmh(maxSpeed) * 1.15) / 20) * 20));

  let loadZones = $derived([
    { from: -3, to: config.minLoad, color: "var(--danger)" },
    { from: config.minLoad, to: config.minLoad + 0.5, color: "var(--accent)" },
    { from: config.minLoad + 0.5, to: config.maxLoad - 0.8, color: "var(--success)" },
    { from: config.maxLoad - 0.8, to: config.maxLoad, color: "var(--accent)" },
    { from: config.maxLoad, to: 8, color: "var(--danger)" }
  ]);

  let energies = $derived.by(() => {
    const total = Math.max(1e-9, state.energies.initial);
    const parts = [
      { key: "kinetic", label: "Cinética", value: state.energies.kinetic, color: "#d49927" },
      { key: "gravitational", label: "Potencial", value: state.energies.gravitational, color: "#368bc0" },
      { key: "elastic", label: "Elástica", value: state.energies.elastic, color: "#9b65bb" },
      { key: "dissipated", label: "Disipada", value: state.energies.dissipated, color: "#cf737b" }
    ];

    return parts.map(part => ({ ...part, fraction: Math.max(0, Math.min(1, part.value / total)) }));
  });

  let readouts = $derived([
    { icon: Ruler, label: "Posición s", value: `${formatNumber(state.distance, 1)} m` },
    { icon: ArrowUpFromLine, label: "Altura", value: `${formatNumber(state.position.y, 1)} m` },
    { icon: Activity, label: "Normal N", value: `${formatNumber(state.forces.normal, 0)} N` },
    { icon: Zap, label: "a tangencial", value: `${formatNumber(state.tangentialAcceleration, 1)} m/s²` },
    { icon: GaugeIcon, label: "a normal", value: `${formatNumber(state.normalAcceleration, 1)} m/s²` },
    { icon: Timer, label: "Tiempo", value: `${formatNumber(state.time, 2)} s` }
  ]);
</script>

<div class="cluster">
  <Gauge
    value={kmh(state.speed)}
    min={0}
    max={speedMax}
    zones={[{ from: 0, to: Math.max(0.5, kmh(state.speed)), color: "var(--primary)" }]}
    label="Rapidez"
    unit="km/h"
    display={formatNumber(kmh(state.speed), 0)}
    sublabel={`${formatNumber(state.speed, 2)} m/s`}
    ticks={[{ at: 0, text: "0" }, { at: speedMax / 2, text: String(speedMax / 2) }, { at: speedMax, text: String(speedMax) }]}
  />

  <Gauge
    value={state.load}
    min={-2}
    max={7}
    zones={loadZones}
    label="Carga n = N/(mg)"
    unit="g"
    display={formatNumber(state.load, 2)}
    sublabel={state.section}
    ticks={[{ at: config.minLoad, text: `${config.minLoad} g` }, { at: 1, text: "1 g" }, { at: config.maxLoad, text: `+${config.maxLoad} g` }]}
  />

  <div class="energy">
    <div class="energy-head">
      <span>Energía</span>
      <strong>{formatNumber(state.energies.mechanical, 0)} J mecánica · {formatNumber(state.energies.initial, 0)} J inicial</strong>
    </div>

    <div class="energy-bar" role="img" aria-label="Reparto de la energía inicial">
      {#each energies as part}
        {#if part.fraction > 0.002}
          <span style:flex={part.fraction} style:background={part.color} title={`${part.label}: ${formatNumber(part.value, 0)} J`}></span>
        {/if}
      {/each}
    </div>

    <ul class="energy-legend">
      {#each energies as part}
        <li><i style:background={part.color}></i>{part.label} <b>{formatNumber(100 * part.fraction, 0)} %</b></li>
      {/each}
    </ul>

    <p class="energy-balance" class:warn={Math.abs(state.energies.balanceError) / state.energies.initial > 0.01}>
      Balance E_m + E_dis − E₀ = {formatNumber(state.energies.balanceError, 2)} J
    </p>
  </div>

  <ul class="readouts">
    {#each readouts as item}
      <li>
        <item.icon size={14} />
        <span>{item.label}</span>
        <strong>{item.value}</strong>
      </li>
    {/each}
  </ul>
</div>

<style>
  .cluster {
    display: grid;
    grid-template-columns: 190px 190px minmax(0, 1fr) minmax(0, 1fr);
    gap: 14px;
    align-items: center;
  }

  .energy {
    display: grid;
    gap: 7px;
  }

  .energy-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .energy-head span {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .energy-head strong {
    font-size: 11.5px;
    color: var(--text-soft);
    font-weight: 700;
  }

  .energy-bar {
    display: flex;
    height: 14px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--surface-muted);
  }

  .energy-bar span {
    display: block;
    min-width: 0;
  }

  .energy-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 11px;
    color: var(--muted);
  }

  .energy-legend i {
    display: inline-block;
    width: 9px;
    height: 9px;
    margin-right: 5px;
    border-radius: 3px;
    vertical-align: -1px;
  }

  .energy-legend b {
    color: var(--text-soft);
    font-variant-numeric: tabular-nums;
  }

  .energy-balance {
    margin: 0;
    font-size: 10.5px;
    color: var(--faint);
    font-variant-numeric: tabular-nums;
  }

  .energy-balance.warn {
    color: var(--danger);
  }

  .readouts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .readouts li {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    column-gap: 7px;
    align-items: center;
    padding: 7px 9px;
    border-radius: var(--radius-sm);
    background: var(--surface-soft);
    color: var(--muted);
  }

  .readouts li :global(svg) {
    grid-row: span 2;
    color: var(--primary);
  }

  .readouts span {
    font-size: 10px;
    font-weight: 700;
  }

  .readouts strong {
    font-size: 12.5px;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  @media (max-width: 1250px) {
    .cluster {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 560px) {
    .cluster {
      grid-template-columns: 1fr;
      justify-items: stretch;
    }
  }
</style>
