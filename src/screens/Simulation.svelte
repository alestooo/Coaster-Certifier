<script lang="ts">
  import { untrack } from "svelte";

  import Guide from "../components/Guide.svelte";
  import TrackEditor from "../components/TrackEditor.svelte";
  import SettingsPanel from "../components/lab/SettingsPanel.svelte";
  import StagePanel from "../components/lab/StagePanel.svelte";
  import MetricsPanel from "../components/lab/MetricsPanel.svelte";
  import VerdictPanel from "../components/lab/VerdictPanel.svelte";
  import ChartsPanel from "../components/lab/ChartsPanel.svelte";
  import ReportDialog from "../components/lab/ReportDialog.svelte";

  import { SimulationRunner } from "../lib/simulation-runner.svelte";
  import { scenarioConfig, type ScenarioId } from "../game/scenarios";
  import { mapName } from "../game/maps";
  import { resolveConfig, buildTrack, ConfigError } from "../physics/index.js";
  import type { ConfigInput, SimulationConfig, TrackPoint } from "../lib/types";

  import {
    CART_MASS,
    DEFAULT_PASSENGER_MASS,
    MIN_PASSENGER_MASS,
    MAX_PASSENGER_MASS,
    calculateCartCount,
    type Passenger
  } from "../game/passengers";

  import "../styles/physics-lab.css";

  let {
    config,
    passengers,
    onEditPassengers,
    onChangeMap,
    onMapChange = () => {}
  }: {
    config: ConfigInput;
    passengers: Passenger[];
    onEditPassengers: () => void;
    onChangeMap: () => void;
    onMapChange?: (mapId: string) => void;
  } = $props();

  const people = untrack(() => passengers.map(passenger => ({ ...passenger })));
  const cartCount = calculateCartCount(people);

  const STATUS_LABELS: Record<string, string> = {
    running: "Listo / pausado",
    finished: "Detenido en la estación",
    stopped: "En reposo en la estación",
    stalled: "Detenido antes del frenado",
    rejected: "Límite excedido",
    "lost-contact": "Pérdida de contacto",
    timeout: "Fin del tiempo de observación"
  };

  let cartMass = $state(CART_MASS);
  let masses = $state(people.map(passenger => passenger.mass));
  let applied = $state({ cartMass: CART_MASS, masses: people.map(passenger => passenger.mass) });

  let runner = new SimulationRunner(untrack(() => config));
  let draft = $state<SimulationConfig>(copyConfig(untrack(() => runner.config)));

  let designConfirmed = $state(untrack(() => config.mapId !== "custom"));
  let errorField = $state("");
  let errorMessage = $state("");

  let signature = $state(untrack(() => fingerprint()));
  let dirty = $derived(fingerprint() !== signature);
  let started = $derived(runner.history.length > 1);

  let people2 = $derived(people.map((passenger, index) => ({ ...passenger, mass: masses[index] ?? passenger.mass })));

  let editorDialog: HTMLDialogElement;
  let report: ReportDialog;

  function copyConfig(source: SimulationConfig): SimulationConfig {
    return { ...source, customPoints: source.customPoints.map(point => ({ ...point })) };
  }

  function fingerprint() {
    return JSON.stringify({ draft, cartMass, masses });
  }

  function totalMass() {
    return cartCount * cartMass + masses.reduce((sum, mass) => sum + mass, 0);
  }

  function patch(partial: Partial<SimulationConfig>) {
    runner.pause();
    draft = { ...draft, ...partial };
  }

  function apply(): boolean {
    runner.pause();
    errorField = "";
    errorMessage = "";

    try {
      const invalidMass =
        !Number.isFinite(cartMass) ||
        cartMass < 1 ||
        cartMass > 10000 ||
        masses.some(mass => !Number.isFinite(mass) || mass < MIN_PASSENGER_MASS || mass > MAX_PASSENGER_MASS);

      if (invalidMass) {
        throw new ConfigError("Revisá los rangos de las masas.", "mass");
      }

      const next = resolveConfig({ ...draft, mass: totalMass() });
      buildTrack(next);
      runner.apply(next);

      draft = copyConfig(next);
      applied = { cartMass, masses: [...masses] };
      signature = fingerprint();
      designConfirmed = true;
      onMapChange(next.mapId);

      return true;
    } catch (problem) {
      errorField = problem instanceof ConfigError ? problem.field : "";
      errorMessage = problem instanceof Error ? problem.message : "Configuración inválida.";
      return false;
    }
  }

  function discard() {
    draft = copyConfig(runner.config);
    cartMass = applied.cartMass;
    masses = [...applied.masses];
    signature = fingerprint();
    errorField = "";
    errorMessage = "";
  }

  function loadScenario(id: ScenarioId) {
    runner.pause();
    // Cada escenario parte de los valores por defecto: no hereda campos del borrador anterior.
    draft = copyConfig(resolveConfig(scenarioConfig(id)));
    cartMass = CART_MASS;
    masses = people.map(() => DEFAULT_PASSENGER_MASS);
    apply();
  }

  function applyRecommendation(next: SimulationConfig) {
    runner.pause();
    draft = copyConfig(next);
    apply();
  }

  function updatePoints(points: TrackPoint[]) {
    patch({ customPoints: points });
  }

  $effect(() => {
    if (untrack(() => config.mapId) === "custom") {
      editorDialog.showModal();
    }
  });
</script>

<main class="physics-lab">
  <header class="lab-heading">
    <div>
      <span class="lab-eyebrow">LABORATORIO DE CERTIFICACIÓN</span>
      <h1>{mapName(runner.config.mapId)}</h1>
    </div>

    <div class="physics-toolbar">
      <span class="mode-badge">
        Límites {runner.config.minLoad} g a +{runner.config.maxLoad} g ·
        contacto {runner.config.contactModel === "strict" ? "estricto" : "ruedas de seguridad"} ·
        {runner.config.brakeMode === "station" ? "frenos" : "resorte"}
      </span>

      {#if draft.mapId === "custom"}
        <button class="edit-track-button" type="button" onclick={() => { runner.pause(); editorDialog.showModal(); }}>
          ✎ Editar pista
        </button>
      {/if}

      <button type="button" onclick={onChangeMap}>Cambiar recorrido</button>
      <button type="button" onclick={onEditPassengers}>Pasajeros</button>
      <Guide onPreset={loadScenario} />
    </div>
  </header>

  <div class="physics-layout">
    <aside class="physics-card settings">
      <SettingsPanel
        {draft}
        {cartMass}
        {masses}
        {cartCount}
        {dirty}
        {errorField}
        {errorMessage}
        onPatch={patch}
        onCartMass={value => { runner.pause(); cartMass = value; }}
        onPassengerMass={(index, value) => { runner.pause(); masses = masses.map((mass, position) => (position === index ? value : mass)); }}
        onApply={apply}
        onDiscard={discard}
      />
    </aside>

    <section class="physics-results" aria-label="Simulación y resultados">
      <div class="physics-card stage-card">
        <StagePanel
          {runner}
          passengers={people2}
          designConfirmed={designConfirmed && !dirty}
          statusLabel={STATUS_LABELS[runner.state.status] ?? runner.state.status}
        />
      </div>

      <div class="physics-bottom">
        <div class="physics-card verdict-card">
          <VerdictPanel
            verdict={runner.verdict}
            running={runner.running}
            {started}
            state={runner.state}
            config={runner.config}
            onApplyRecommendation={applyRecommendation}
            onOpenReport={() => report.open()}
          />
        </div>

        <div class="physics-card metrics-card">
          <h2>Magnitudes en el instante observado</h2>
          <MetricsPanel state={runner.viewState} config={runner.config} />
        </div>
      </div>

      <div class="physics-card chart-card">
        <ChartsPanel
          history={runner.history}
          config={runner.config}
          track={runner.track}
          events={runner.state.events}
        />
      </div>
    </section>
  </div>
</main>

<ReportDialog
  bind:this={report}
  verdict={runner.verdict}
  config={runner.config}
  track={runner.track}
  history={runner.history}
  passengers={people2}
  mapName={mapName(runner.config.mapId)}
/>

<dialog bind:this={editorDialog} class="editor-modal" aria-labelledby="editor-title">
  <div class="editor-modal-heading">
    <h2 id="editor-title">Pista personalizada</h2>
    <button type="button" aria-label="Cerrar editor" onclick={() => editorDialog.close()}>✕</button>
  </div>

  <TrackEditor points={draft.customPoints} onChange={updatePoints} />

  {#if errorMessage}
    <p role="alert" class="physics-error">{errorMessage}</p>
  {/if}

  <button
    class="primary"
    type="button"
    onclick={() => {
      if (apply()) editorDialog.close();
    }}
  >
    Aplicar diseño
  </button>
</dialog>
