<script lang="ts">
  import ParamSlider from "../ui/ParamSlider.svelte";
  import { buildTrack, estimateRide, ESTIMATE_ASSUMPTIONS } from "../../physics/index.js";
  import { formatNumber, kmh } from "../../ui/format";
  import type { AuditResult } from "../../lib/live-audit.svelte";

  /**
   * Estimación de la atracción a partir del recorrido auditado: recorrido,
   * tiempos y capacidad, movimiento, energía y estructura, con supuestos
   * editables. La masa es la del tren y los pasajeros del taller.
   */
  interface Props {
    result: AuditResult | null;
    /** Asientos del tren del taller (carros × asientos por carro). */
    seats: number;
  }

  let { result, seats }: Props = $props();

  let supportSpacing = $state<number>(ESTIMATE_ASSUMPTIONS.supportSpacing.default);
  let stationSeconds = $state<number>(ESTIMATE_ASSUMPTIONS.stationSeconds.default);
  let seatOverride = $state<number | null>(null);

  let estimate = $derived.by(() => {
    if (!result) return null;
    const run = { history: result.history, final: result.final, track: buildTrack(result.config), verdict: result.verdict };
    return estimateRide(result.config, run, { supportSpacing, stationSeconds, seats: seatOverride ?? seats });
  });

  const m = (value: number | null, digits = 1) => (value === null ? "—" : `${formatNumber(value, digits)} m`);
  const s = (value: number | null, digits = 1) => (value === null ? "—" : `${formatNumber(value, digits)} s`);
  const kJ = (value: number | null) => (value === null ? "—" : `${formatNumber(value / 1000, 0)} kJ`);
  const kW = (value: number | null) => (value === null ? "—" : `${formatNumber(value / 1000, 1)} kW`);
</script>

{#if estimate}
  {#if !estimate.complete}
    <p class="warning" role="status">
      El recorrido no termina detenido en la estación: el tiempo de vuelta, el ciclo, la capacidad y el frenado aparecen cuando el diseño se aprueba
      (o al menos se detiene en la zona de frenado).
    </p>
  {/if}
  <section class="group" aria-label="Recorrido">
    <h3>Recorrido</h3>
    <dl>
      <dt>Vía de A a F</dt><dd>{m(estimate.path.trackLength)}</dd>
      <dt>Subida</dt><dd>{estimate.path.liftLength === null ? "sin subida" : m(estimate.path.liftLength)}</dd>
      <dt>Largo total</dt><dd>{m(estimate.path.total)}</dd>
    </dl>
  </section>

  <section class="group" aria-label="Tiempos y capacidad">
    <h3>Tiempos y capacidad</h3>
    <dl>
      <dt>Subida</dt><dd>{s(estimate.times.lift, 0)}</dd>
      <dt>Recorrido (de A a la detención)</dt><dd>{s(estimate.times.ride)}</dd>
      <dt>Ciclo (estación + subida + recorrido)</dt><dd>{s(estimate.times.cycle, 0)}</dd>
      <dt>Capacidad</dt><dd class="strong">{estimate.times.throughput === null ? "—" : `${formatNumber(estimate.times.throughput, 0)} pasajeros/h`}</dd>
    </dl>
  </section>

  <section class="group" aria-label="Rapidez y fuerza g">
    <h3>Rapidez y fuerza g</h3>
    <dl>
      <dt>Rapidez máxima</dt><dd>{formatNumber(estimate.motion.maxSpeed, 1)} m/s ({formatNumber(kmh(estimate.motion.maxSpeed), 0)} km/h)</dd>
      <dt>Fuerza g máxima y mínima</dt><dd>{formatNumber(estimate.motion.maxLoad, 2)} g · {formatNumber(estimate.motion.minLoad, 2)} g</dd>
      <dt>Flotación (n &lt; 0,2 g)</dt><dd>{s(estimate.motion.floatSeconds)}</dd>
      <dt>Por encima de 4 g</dt><dd>{s(estimate.motion.highLoadSeconds)}</dd>
    </dl>
  </section>

  <section class="group" aria-label="Energía">
    <h3>Energía</h3>
    <dl>
      <dt>Subida por vuelta</dt><dd>{estimate.energy.liftEnergyKWh === null ? "sin subida" : `${formatNumber(estimate.energy.liftEnergyKWh, 3)} kWh · motor de ${kW(estimate.energy.liftPower)}`}</dd>
      <dt>Disipada en los frenos</dt><dd>{kJ(estimate.energy.brakeEnergy)} · pico de {kW(estimate.energy.peakBrakePower)}</dd>
      <dt>Aportada por los lanzadores</dt><dd>{estimate.energy.launchEnergy > 0 ? kJ(estimate.energy.launchEnergy) : "—"}</dd>
    </dl>
  </section>

  <section class="group" aria-label="Estructura">
    <h3>Estructura</h3>
    <dl>
      <dt>Columnas</dt><dd>{formatNumber(estimate.structure.supports, 0)} · {m(estimate.structure.totalColumnHeight, 0)} en total · la más alta {m(estimate.structure.tallestColumn)}</dd>
      <dt>Altura máxima</dt><dd>{m(estimate.structure.maxHeight)}</dd>
      <dt>{estimate.path.liftLength === null ? "Huella (de A a F)" : "Huella (del pie de la subida a F)"}</dt><dd>{m(estimate.structure.footprint)}</dd>
    </dl>
  </section>

  <section class="group" aria-label="Supuestos">
    <h3>Supuestos</h3>
    <ParamSlider
      id="estimate-station"
      label="Tiempo en la estación"
      symbol="t_e"
      unit="s"
      step={5}
      help="Lo que tarda el tren en la estación: bajar, subir pasajeros y revisar las barras."
      value={estimate.assumptions.stationSeconds}
      limits={[ESTIMATE_ASSUMPTIONS.stationSeconds.range[0], ESTIMATE_ASSUMPTIONS.stationSeconds.range[1]]}
      onInput={value => (stationSeconds = value)}
    />
    <ParamSlider
      id="estimate-seats"
      label="Asientos por tren"
      symbol="N_a"
      unit=""
      step={1}
      help="Pasajeros por vuelta. Por defecto, los asientos de los carros del taller."
      value={estimate.assumptions.seats}
      limits={[ESTIMATE_ASSUMPTIONS.seats.range[0], ESTIMATE_ASSUMPTIONS.seats.range[1]]}
      onInput={value => (seatOverride = Math.round(value))}
    />
    <ParamSlider
      id="estimate-spacing"
      label="Separación entre columnas"
      symbol="d_c"
      unit="m"
      step={1}
      help="Cada cuántos metros de vía va una columna. Los loops se apoyan en su base y la vía a nivel del suelo, en zapatas."
      value={estimate.assumptions.supportSpacing}
      limits={[ESTIMATE_ASSUMPTIONS.supportSpacing.range[0], ESTIMATE_ASSUMPTIONS.supportSpacing.range[1]]}
      onInput={value => (supportSpacing = value)}
    />
    <p class="note">El ángulo y la eficiencia de la subida se editan en «Salida» (un clic en la caída inicial). La masa es la del tren y los pasajeros.</p>
  </section>
{:else}
  <p class="note">La estimación aparece cuando termina la auditoría del diseño.</p>
{/if}

<style>
  .group {
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--border);
  }

  h3 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-12);
    font-weight: var(--weight-bold);
    color: var(--primary-strong);
  }

  dl {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px var(--space-3);
    margin: 0;
    font-size: var(--text-12);
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: var(--weight-bold);
    color: var(--text);
  }

  dd.strong {
    color: var(--primary-strong);
  }

  .warning {
    margin: var(--space-2) 0 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--accent-soft);
    color: var(--warn-text);
    font-size: var(--text-12);
    line-height: 1.45;
  }

  .note {
    margin: var(--space-2) 0 0;
    font-size: var(--text-12);
    line-height: 1.45;
    color: var(--muted);
  }
</style>
