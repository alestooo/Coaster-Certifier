<script lang="ts">
  import { untrack } from "svelte";
  import { PencilRuler, Map as MapIcon, Users, BookOpen } from "lucide-svelte";

  import Guide from "../components/Guide.svelte";
  import TrackEditor from "../components/TrackEditor.svelte";
  import Inspector from "../components/lab/Inspector.svelte";
  import SettingsPanel from "../components/lab/SettingsPanel.svelte";
  import TrainPanel from "../components/lab/TrainPanel.svelte";
  import StagePanel from "../components/lab/StagePanel.svelte";
  import InstrumentCluster from "../components/lab/InstrumentCluster.svelte";
  import VerdictPanel from "../components/lab/VerdictPanel.svelte";
  import ChartsDock from "../components/lab/ChartsDock.svelte";
  import ReportDialog from "../components/lab/ReportDialog.svelte";

  import { SimulationRunner } from "../lib/simulation-runner.svelte";
  import { scenarioConfig, type ScenarioId } from "../game/scenarios";
  import { mapName } from "../game/maps";
  import { resolveConfig, buildTrack, ConfigError, toCsv } from "../physics/index.js";
  import { downloadText, downloadJson, stampedName } from "../ui/export";
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

  let cartMass = $state(CART_MASS);
  let masses = $state(people.map(passenger => passenger.mass));
  let applied = $state({ cartMass: CART_MASS, masses: people.map(passenger => passenger.mass) });

  let runner = new SimulationRunner(untrack(() => config));
  let draft = $state<SimulationConfig>(copyConfig(untrack(() => runner.config)));

  let designConfirmed = $state(untrack(() => config.mapId !== "custom"));
  let errorField = $state("");
  let errorMessage = $state("");
  let tab = $state<"design" | "train" | "verdict">("design");

  let signature = $state(untrack(() => fingerprint()));
  let dirty = $derived(fingerprint() !== signature);
  let enabled = $derived(designConfirmed && !dirty);

  let peopleWithMass = $derived(people.map((passenger, index) => ({ ...passenger, mass: masses[index] ?? passenger.mass })));

  let maxSpeedSeen = $derived.by(() => {
    let best = 0;
    for (const state of runner.history) if (state.speed > best) best = state.speed;
    return best;
  });

  let pendingMessage = $derived(
    !designConfirmed ? "Aplicá tu diseño de pista para empezar" : dirty ? "Hay cambios sin aplicar en el panel Diseño" : ""
  );

  let editorDialog: HTMLDialogElement;
  let report: ReportDialog;
  let guide: Guide;

  let wasFinished = false;

  $effect(() => {
    const finished = runner.isFinished;

    if (finished && !wasFinished && runner.history.length > 1) {
      tab = "verdict";
    }

    wasFinished = finished;
  });

  $effect(() => {
    if (untrack(() => config.mapId) === "custom") {
      editorDialog.showModal();
    }
  });

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
    draft = copyConfig(resolveConfig(scenarioConfig(id)));
    cartMass = CART_MASS;
    masses = people.map(() => DEFAULT_PASSENGER_MASS);
    tab = "design";
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

  function exportCsv() {
    downloadText(stampedName(`coaster-${runner.config.mapId}`, "csv"), toCsv(runner.history), "text/csv");
  }

  function exportJson() {
    downloadJson(stampedName(`dictamen-${runner.config.mapId}`, "json"), {
      generatedAt: new Date().toISOString(),
      map: mapName(runner.config.mapId),
      config: runner.config,
      verdict: runner.verdict
    });
  }
</script>

<main class="lab">
  <header class="lab-bar">
    <div class="lab-title">
      <span class="eyebrow">Laboratorio de certificación</span>
      <h1>{mapName(runner.config.mapId)}</h1>
    </div>

    <nav class="lab-actions" aria-label="Acciones del laboratorio">
      {#if draft.mapId === "custom"}
        <button type="button" class="accent" onclick={() => { runner.pause(); editorDialog.showModal(); }}>
          <PencilRuler size={15} /> Editar pista
        </button>
      {/if}
      <button type="button" onclick={onChangeMap}><MapIcon size={15} /> Recorrido</button>
      <button type="button" onclick={onEditPassengers}><Users size={15} /> Pasajeros</button>
      <button type="button" onclick={() => guide.open()}><BookOpen size={15} /> Guía</button>
    </nav>
  </header>

  <div class="lab-grid">
    <section class="lab-main" aria-label="Simulación">
      <div class="card stage-card">
        <StagePanel {runner} passengers={peopleWithMass} {enabled} verdict={runner.verdict} {pendingMessage} />
      </div>

      <div class="card">
        <InstrumentCluster state={runner.viewState} config={runner.config} maxSpeed={maxSpeedSeen} />
      </div>

      <div class="card">
        <ChartsDock history={runner.history} config={runner.config} track={runner.track} events={runner.state.events} />
      </div>
    </section>

    <Inspector bind:active={tab} attention={dirty ? "design" : runner.isFinished && runner.history.length > 1 ? "verdict" : null}>
      {#snippet design()}
        <SettingsPanel {draft} {dirty} {errorField} {errorMessage} onPatch={patch} onApply={apply} onDiscard={discard} onScenarios={() => guide.open()} />
      {/snippet}

      {#snippet train()}
        <TrainPanel
          passengers={people}
          {cartMass}
          {masses}
          {cartCount}
          onCartMass={value => { runner.pause(); cartMass = value; }}
          onPassengerMass={(index, value) => { runner.pause(); masses = masses.map((mass, position) => (position === index ? value : mass)); }}
          {onEditPassengers}
        />
        {#if dirty}
          <div class="train-apply">
            <button type="button" class="primary" onclick={apply}>Aplicar masas</button>
          </div>
        {/if}
      {/snippet}

      {#snippet verdict()}
        <VerdictPanel
          verdict={runner.verdict}
          running={runner.running}
          state={runner.state}
          config={runner.config}
          onApplyRecommendation={applyRecommendation}
          onOpenReport={() => report.open()}
          onExportCsv={exportCsv}
          onExportJson={exportJson}
        />
      {/snippet}
    </Inspector>
  </div>
</main>

<Guide bind:this={guide} onPreset={loadScenario} />

<ReportDialog
  bind:this={report}
  verdict={runner.verdict}
  config={runner.config}
  track={runner.track}
  history={runner.history}
  passengers={peopleWithMass}
  mapName={mapName(runner.config.mapId)}
/>

<dialog bind:this={editorDialog} class="editor-modal" aria-label="Editor de pista personalizada">
  <div class="editor-modal-heading">
    <button type="button" class="close" aria-label="Cerrar editor" onclick={() => editorDialog.close()}>✕</button>
  </div>

  <TrackEditor config={draft} onChange={updatePoints} onPatch={patch} />

  {#if errorMessage}
    <p role="alert" class="editor-error">{errorMessage}</p>
  {/if}

  <div class="editor-actions">
    <button type="button" class="secondary" onclick={() => editorDialog.close()}>Cerrar</button>
    <button type="button" class="primary" onclick={() => { if (apply()) editorDialog.close(); }}>Aplicar diseño y volver</button>
  </div>
</dialog>
