<script lang="ts">
  import type { SimulationConfig, SimulationState } from "../../lib/types";
  import { formatNumber, kmh } from "../../ui/format";

  let { state, config }: { state: SimulationState; config: SimulationConfig } = $props();

  type Metric = { label: string; value: string; accent?: "good" | "warn" | "bad" };

  let loadAccent = $derived.by((): Metric["accent"] => {
    if (state.load > config.maxLoad || state.load < config.minLoad || (config.contactModel === "strict" && state.forces.normal <= 0)) return "bad";
    if (state.load > config.maxLoad - 0.5 || state.load < config.minLoad + 0.5) return "warn";
    return "good";
  });

  let groups = $derived.by((): { title: string; metrics: Metric[] }[] => [
    {
      title: "Cinemática",
      metrics: [
        { label: "Rapidez", value: `${formatNumber(state.speed)} m/s` },
        { label: "Rapidez (km/h)", value: `${formatNumber(kmh(state.speed), 0)} km/h` },
        { label: "Posición s", value: `${formatNumber(state.distance)} m` },
        { label: "Altura y", value: `${formatNumber(state.position.y)} m` },
        { label: "Inclinación θ", value: `${formatNumber((state.angle * 180) / Math.PI, 1)}°` },
        { label: "a tangencial", value: `${formatNumber(state.tangentialAcceleration)} m/s²` },
        { label: "a normal", value: `${formatNumber(state.normalAcceleration)} m/s²` }
      ]
    },
    {
      title: "Dinámica",
      metrics: [
        { label: "Carga n = N/(mg)", value: `${formatNumber(state.load)} g`, accent: loadAccent },
        { label: "Normal N", value: `${formatNumber(state.forces.normal, 0)} N` },
        { label: "Fricción", value: `${formatNumber(state.forces.friction, 1)} N` },
        { label: "Peso tangencial", value: `${formatNumber(state.forces.gravity, 0)} N` },
        config.brakeMode === "spring"
          ? { label: "Resorte · compresión", value: `${formatNumber(state.forces.spring, 0)} N · ${formatNumber(state.springCompression)} m` }
          : { label: "Frenos", value: `${formatNumber(state.forces.brake, 0)} N` },
        { label: "Masa total", value: `${formatNumber(config.mass, 1)} kg` }
      ]
    },
    {
      title: "Energía",
      metrics: [
        { label: "Cinética", value: `${formatNumber(state.energies.kinetic, 0)} J` },
        { label: "Potencial", value: `${formatNumber(state.energies.gravitational, 0)} J` },
        { label: "Elástica", value: `${formatNumber(state.energies.elastic, 0)} J` },
        { label: "Mecánica total", value: `${formatNumber(state.energies.mechanical, 0)} J` },
        { label: "Disipada", value: `${formatNumber(state.energies.dissipated, 0)} J` },
        {
          label: "Error de balance",
          value: `${formatNumber(state.energies.balanceError, 2)} J`,
          accent: Math.abs(state.energies.balanceError) / state.energies.initial < 0.01 ? "good" : "warn"
        }
      ]
    }
  ]);
</script>

<div class="metrics">
  {#each groups as group}
    <section class="metrics-group">
      <h3>{group.title}</h3>
      <dl>
        {#each group.metrics as metric}
          <div class:good={metric.accent === "good"} class:warn={metric.accent === "warn"} class:bad={metric.accent === "bad"}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        {/each}
      </dl>
    </section>
  {/each}
</div>

<style>
  .metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 10px;
  }

  .metrics-group h3 {
    margin: 0 0 6px;
    font-size: 10px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #a18ab1;
  }

  dl {
    display: grid;
    gap: 5px;
    margin: 0;
  }

  dl > div {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 7px;
    background: #f9f5fd;
    border-left: 3px solid transparent;
  }

  dl > div.good {
    border-left-color: #39936b;
  }

  dl > div.warn {
    border-left-color: #d49927;
  }

  dl > div.bad {
    border-left-color: #c9444e;
    background: #fff3f5;
  }

  dt {
    font-size: 10.5px;
    color: #9b84aa;
  }

  dd {
    margin: 0;
    font-size: 11.5px;
    font-weight: 650;
    color: #4e3a63;
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
