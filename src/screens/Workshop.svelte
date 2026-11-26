<script lang="ts">
  import { endedRejected } from "../lib/run-status";
  import { onDestroy, onMount, tick, untrack } from "svelte";

  import WorkshopBar from "../components/workshop/WorkshopBar.svelte";
  import Stage from "../components/workshop/Stage.svelte";
  import SidePanel from "../components/workshop/SidePanel.svelte";
  import SelectionPanel from "../components/workshop/SelectionPanel.svelte";
  import PointPanel from "../components/workshop/PointPanel.svelte";
  import RulesPanel from "../components/workshop/RulesPanel.svelte";
  import TelemetryDrawer from "../components/workshop/TelemetryDrawer.svelte";
  import VerdictPanel from "../components/lab/VerdictPanel.svelte";
  import LoadError from "../components/LoadError.svelte";
  import { PANEL_TITLES, type PanelMode } from "../components/workshop/panel";

  import { DesignSession } from "../lib/design-session.svelte";
  import { FixSearch } from "../lib/fix-search.svelte";
  import type { LazyModule } from "../lib/lazy-module.svelte";
  import { workshopParts, prefetchWorkshopParts } from "../lib/workshop-parts";
  import { whenIdle } from "../lib/idle";
  import { FIELD_GROUPS, visibleGroups } from "../lib/field-definitions";
  import type { AreaId } from "../lib/audit";
  import { mapName, type MapId, mapTemplate } from "../game/maps";
  import type { Passenger } from "../game/passengers";
  import { buildTrack, runSimulation, toCsv, DEFAULT_CONFIG } from "../physics/index.js";
  import { downloadText, downloadJson, stampedName } from "../ui/export";
  import { formatNumber } from "../ui/format";
  import type { SimulationConfig } from "../lib/types";


  interface Props {
    passengers: Passenger[];
    /** Falso mientras el taller queda oculto detrás del menú: no atiende atajos de teclado. */
    active?: boolean;
    onHome: () => void;
  }

  let { passengers: initialPassengers, active = true, onHome }: Props = $props();

  /** Ancho a partir del cual la telemetría arranca abierta (px). */
  const WIDE_LAYOUT_MIN_PX = 701;

  // Se entra al trazado del anexo con los valores del anexo.
  const session = new DesignSession(
    { ...DEFAULT_CONFIG, ...mapTemplate("reference") },
    untrack(() => initialPassengers)
  );

  let panel = $state<PanelMode | null>(null);
  let selectedArea = $state<AreaId | null>(null);
  /** Punto elegido del trazado personalizado (se edita en el lienzo y en el panel). */
  let selectedPoint = $state<number | null>(null);
  /** Alto con el que la hoja del panel tapa el lienzo en el teléfono. */
  let sheetHeight = $state(0);
  let telemetryOpen = $state(typeof window === "undefined" || window.matchMedia(`(min-width: ${WIDE_LAYOUT_MIN_PX}px)`).matches);
  /** Problema abierto sobre la pista, corrección en vista previa y aviso al terminar rechazado. */
  let openIssue = $state<number | null>(null);
  let ghost = $state.raw<SimulationConfig | null>(null);
  let ping = $state(false);
  let pingTimer: ReturnType<typeof setTimeout> | null = null;

  const fixes = new FixSearch();
  const PING_MS = 2000;

  /** Piezas que viajan aparte (ver `lib/workshop-parts`). */
  const { passengerEditor, report: reportModule, guide: guideModule } = workshopParts;
  /** Sin `requestIdleCallback`, las piezas se precargan a este tiempo de abrir el taller. */
  const PREFETCH_FALLBACK_MS = 2000;

  // Con el taller a la vista, el resto baja en reposo: abre al instante y no depende de la red después.
  onMount(() => whenIdle(prefetchWorkshopParts, PREFETCH_FALLBACK_MS));

  interface Openable {
    open(): void;
  }

  let stage: Stage;
  let guide = $state<Openable>();
  let reportDialog = $state<Openable>();

  type DialogName = "guide" | "report";

  /** Diálogos pedidos que todavía no se montaron: se abren apenas existen. */
  const pendingOpen: Partial<Record<DialogName, () => void>> = {};

  /**
   * Descarga el diálogo si hace falta y lo abre (ya, o apenas se monte).
   * Devuelve si quedó abierto; si la descarga falla, avisa `LoadError`.
   */
  async function openLazyDialog(name: DialogName, module: LazyModule<unknown>, dialog: () => Openable | undefined): Promise<boolean> {
    try {
      await module.load();
    } catch {
      return false;
    }

    const mounted = dialog();
    if (mounted) {
      mounted.open();
      return true;
    }

    return new Promise(resolve => {
      pendingOpen[name] = () => {
        dialog()?.open();
        resolve(true);
      };
    });
  }

  // El diálogo pedido se abre en cuanto `bind:this` lo entrega.
  $effect(() => {
    const mounted = { guide, report: reportDialog };
    untrack(() => {
      for (const name of ["guide", "report"] as const) {
        const open = pendingOpen[name];
        if (!mounted[name] || !open) continue;
        delete pendingOpen[name];
        open();
      }
    });
  });

  /**
   * Avisos de descarga fallida que no se muestran: arrancan ocultos (si falla la precarga en
   * reposo nadie pidió nada) y pedir la pieza los vuelve a mostrar; cerrarlos los oculta.
   */
  let hiddenErrors = $state({ guide: true, report: true });

  function openReport() {
    hiddenErrors = { ...hiddenErrors, report: false };
    return openLazyDialog("report", reportModule, () => reportDialog);
  }

  function openGuide() {
    hiddenErrors = { ...hiddenErrors, guide: false };
    return openLazyDialog("guide", guideModule, () => guide);
  }

  let runner = $derived(session.runner);
  let result = $derived(session.audit.result);
  let report = $derived(result?.report ?? null);
  let passengerSummary = $derived(
    `${session.passengers.length} ${session.passengers.length === 1 ? "pasajero" : "pasajeros"} · ${formatNumber(runner.config.mass, 0)} kg`
  );
  let selectionGroup = $derived(FIELD_GROUPS.find(group => group.id === selectedArea));

  // Un punto que ya no existe (otro recorrido, punto borrado o deshecho) deja de estar elegido.
  $effect(() => {
    const index = selectedPoint;
    if (index === null) return;

    const points = session.draft.customPoints;
    if (session.draft.mapId !== "custom" || index <= 0 || index >= points.length - 1) {
      untrack(() => selectPoint(null));
    }
  });

  // Una selección que el recorrido nuevo ya no tiene (p. ej. el loop en «Línea») se descarta.
  $effect(() => {
    const area = selectedArea;
    if (!area) return;

    if (!visibleGroups(session.draft).some(group => group.id === area)) {
      // La cámara estaba encuadrando esa parte: vuelve al encuadre completo.
      untrack(() => {
        stage?.leaveFocus();
        clearSelection();
      });
    }
  });

  /** Cierra el problema abierto y su vista previa (sin mover el foco). */
  function dropIssue() {
    if (openIssue === null && !ghost) return;
    openIssue = null;
    ghost = null;
  }

  // Cualquier cambio del diseño cierra el problema abierto y su vista previa.
  $effect(() => {
    void session.draft;
    void session.passengers;
    void session.cartMass;
    untrack(dropIssue);
  });

  // Empezar a reproducir también lo cierra; que la reproducción termine, no.
  $effect(() => {
    if (runner.running) untrack(dropIssue);
  });

  // Si la reproducción termina en un incumplimiento, el pin avisa dónde.
  $effect(() => {
    const status = runner.state.status;
    if (!endedRejected(status)) return;

    untrack(() => {
      ping = true;
      if (pingTimer) clearTimeout(pingTimer);
      pingTimer = setTimeout(() => (ping = false), PING_MS);
    });
  });

  onDestroy(() => {
    session.destroy();
    fixes.stop();
    if (pingTimer) clearTimeout(pingTimer);
  });

  /** Cierra el problema abierto y su vista previa; devuelve el foco a su pin. */
  async function closeIssue(returnFocus = true) {
    const index = openIssue;
    openIssue = null;
    ghost = null;

    if (!returnFocus || index === null) return;
    await tick();
    document.querySelectorAll<HTMLElement>(".marker .pin")[index]?.focus();
  }

  /** Muestra un problema sobre la pista; en el teléfono la hoja lo taparía, así que se cierra. */
  function showIssue(index: number) {
    if (window.matchMedia(`(max-width: ${WIDE_LAYOUT_MIN_PX - 1}px)`).matches) closePanel();
    openIssue = index;
  }

  function clearSelection() {
    selectedArea = null;
    selectedPoint = null;
    if (panel === "selection") panel = null;
  }

  function selectPoint(index: number | null) {
    if (index === null) {
      if (selectedPoint !== null) clearSelection();
      return;
    }

    selectedArea = null;
    selectedPoint = index;
    panel = "selection";
  }

  function select(area: AreaId | null) {
    if (!area) {
      clearSelection();
      return;
    }

    selectedArea = area;
    selectedPoint = null;
    panel = "selection";
  }

  function openPanel(mode: Exclude<PanelMode, "selection">) {
    if (panel === mode) {
      closePanel();
      return;
    }

    if (panel === "selection") stage.leaveFocus();
    selectedArea = null;
    selectedPoint = null;
    if (mode === "passengers") void passengerEditor.load();
    panel = mode;
  }

  function closePanel() {
    if (panel === "selection") {
      selectedArea = null;
      selectedPoint = null;
      stage.leaveFocus();
    }

    panel = null;
  }

  function chooseTemplate(mapId: MapId) {
    closePanel();
    session.loadTemplate(mapId);
  }

  function gesture(active: boolean) {
    if (active) {
      session.beginGesture();
    } else {
      session.endGesture();
    }
  }

  function isTyping(target: EventTarget | null): boolean {
    if (target instanceof HTMLTextAreaElement) return true;
    return target instanceof HTMLInputElement && !["range", "radio", "checkbox", "button"].includes(target.type);
  }

  function onKeydown(event: KeyboardEvent) {
    if (!active) return;

    const openDialog = document.querySelector("dialog[open]");
    const blocked = !!openDialog || !!document.querySelector(":popover-open");

    if (blocked || event.defaultPrevented) return;

    const typing = isTyping(event.target);

    if (event.key === "Escape") {
      if (typing) {
        (event.target as HTMLElement).blur();
        return;
      }
      if (openIssue !== null) {
        event.preventDefault();
        closeIssue();
        return;
      }
      if (panel) {
        event.preventDefault();
        closePanel();
      }
      return;
    }

    if (event.key === " " && !typing && (event.target === document.body || event.target instanceof HTMLCanvasElement)) {
      event.preventDefault();
      runner.toggle();
      return;
    }

    if (!(event.ctrlKey || event.metaKey) || event.altKey || typing) return;

    const key = event.key.toLowerCase();

    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if ((key === "z" && event.shiftKey) || key === "y") {
      event.preventDefault();
      redo();
    }
  }

  /**
   * Deshacer y rehacer sueltan el punto elegido: se guarda por posición, y con
   * los puntos de otro paso del historial esa posición es otro punto.
   */
  function undo() {
    selectPoint(null);
    session.undo();
  }

  function redo() {
    selectPoint(null);
    session.redo();
  }

  /** CSV a resolución completa (cada paso dt), idéntico al del script headless. */
  function exportCsv() {
    if (!result) return;
    const run = runSimulation(result.config);
    downloadText(stampedName(`coaster-${result.config.mapId}`, "csv"), toCsv(run.history), "text/csv");
  }

  /** Dictamen en JSON: configuración, dictamen y la vía (tramos y marcas A–F). */
  function exportJson() {
    if (!result) return;
    const track = buildTrack(result.config);
    downloadJson(stampedName(`dictamen-${result.config.mapId}`, "json"), {
      generatedAt: new Date().toISOString(),
      map: mapName(result.config.mapId),
      config: result.config,
      verdict: result.verdict,
      track: { sections: track.sections, markers: track.markers }
    });
  }
</script>

<svelte:window onkeydown={onKeydown} />

<main class="workshop" class:with-panel={!!panel}>
  <div class="bar-area">
    <WorkshopBar
      mapId={session.draft.mapId}
      {passengerSummary}
      canUndo={session.canUndo}
      canRedo={session.canRedo}
      {report}
      status={session.audit.status}
      invalid={!!session.errorMessage}
      {panel}
      onHome={() => {
        runner.pause();
        onHome();
      }}
      onTemplate={chooseTemplate}
      onScenario={id => {
        closePanel();
        session.loadScenario(id);
      }}
      onPanel={openPanel}
      onGuide={openGuide}
      onUndo={undo}
      onRedo={redo}
    />
  </div>

  <div class="stage-area">
    <Stage
      bind:this={stage}
      {session}
      passengers={session.passengers}
      {report}
      {result}
      {ghost}
      {fixes}
      {openIssue}
      {ping}
      onOpenIssue={index => {
        if (index === null) {
          closeIssue();
        } else {
          openIssue = index;
        }
      }}
      onDismissIssue={() => closeIssue(false)}
      onPreviewFix={config => (ghost = config)}
      onApplyFix={config => session.applyRecommendation(config)}
      {selectedArea}
      onSelect={select}
      {selectedPoint}
      sheetInset={sheetHeight}
      onSelectPoint={selectPoint}
    />
  </div>

  <div class="telemetry-area">
    <TelemetryDrawer {runner} bind:open={telemetryOpen} />
  </div>

  {#if panel}
    <div class="panel-area">
      {#if panel === "selection" && selectedPoint !== null}
        <SidePanel onSheet={height => (sheetHeight = height)} title={`Punto ${selectedPoint + 1} de ${session.draft.customPoints.length}`} onClose={closePanel}>
          <PointPanel
            index={selectedPoint}
            config={session.draft}
            onPoints={points => session.patch({ customPoints: points }, { discardInvalid: true })}
            onSelectPoint={selectPoint}
          />
        </SidePanel>
      {:else if panel === "selection" && selectedArea}
        <SidePanel onSheet={height => (sheetHeight = height)} title={selectionGroup?.title ?? PANEL_TITLES.selection} subtitle={selectionGroup?.points ?? ""} onClose={closePanel}>
          <SelectionPanel
            area={selectedArea}
            draft={session.draft}
            {report}
            errorField={session.errorField}
            errorMessage={session.errorMessage}
            onPatch={patch => session.patch(patch)}
            onGesture={gesture}
          />
        </SidePanel>
      {:else if panel === "verdict"}
        <SidePanel onSheet={height => (sheetHeight = height)} title={PANEL_TITLES.verdict} onClose={closePanel}>
          <VerdictPanel
            {result}
            status={session.audit.status}
            onShowIssue={showIssue}
            onOpenReport={openReport}
            onExportCsv={exportCsv}
            onExportJson={exportJson}
            onWatch={() => {
              runner.reset();
              runner.start();
            }}
          />
        </SidePanel>
      {:else if panel === "rules"}
        <SidePanel onSheet={height => (sheetHeight = height)} title={PANEL_TITLES.rules} subtitle="Qué se exige y con qué precisión se simula" onClose={closePanel}>
          <RulesPanel
            draft={session.draft}
            errorField={session.errorField}
            errorMessage={session.errorMessage}
            onPatch={patch => session.patch(patch)}
            onGesture={gesture}
          />
        </SidePanel>
      {:else if panel === "passengers"}
        <SidePanel
          title={PANEL_TITLES.passengers}
          subtitle={`${session.passengers.length} ${session.passengers.length === 1 ? "pasajero" : "pasajeros"} · ${session.cartCount} ${session.cartCount === 1 ? "carrito" : "carritos"} · ${formatNumber(runner.config.mass, 0)} kg`}
          onClose={closePanel}
        >
          <!-- El editor de avatares se carga recién cuando se abre el panel. -->
          {#await passengerEditor.promise}
            <p class="loading">Cargando pasajeros…</p>
          {:then editor}
            {#if editor}
            <editor.default
              passengers={session.passengers}
              cartMass={session.cartMass}
              error={session.errorField === "mass" ? session.errorMessage : ""}
              onChange={next => session.setPassengers(next)}
              onCartMass={value => session.setCartMass(value)}
            />
            {/if}
          {:catch error}
            <LoadError message="No se pudieron cargar los pasajeros." onRetry={() => passengerEditor.retry(error)} />
          {/await}
        </SidePanel>
      {/if}
    </div>
  {/if}
</main>

<!-- La guía y el informe viajan aparte (ver lib/workshop-parts). -->
{#if guideModule.promise}
  {#await guideModule.promise then module}
    <module.default bind:this={guide} onPreset={id => session.loadScenario(id)} />
  {/await}
{/if}

{#if result && reportModule.promise}
  {#await reportModule.promise then module}
    <module.default
      bind:this={reportDialog}
      verdict={result.verdict}
      config={result.config}
      history={result.history}
      passengers={session.passengers}
      mapName={mapName(result.config.mapId)}
    />
  {/await}
{/if}

<!-- Si alguno no se pudo descargar, el aviso se apila abajo (sin tapar a otro) y se puede cerrar. -->
<div class="toasts">
  {#if guideModule.promise && !hiddenErrors.guide}
    {#await guideModule.promise catch error}
      <LoadError
        floating
        message="No se pudo descargar la guía."
        onRetry={() => { guideModule.retry(error); void openGuide(); }}
        onDismiss={() => (hiddenErrors = { ...hiddenErrors, guide: true })}
      />
    {/await}
  {/if}
  {#if result && reportModule.promise && !hiddenErrors.report}
    {#await reportModule.promise catch error}
      <LoadError
        floating
        message="No se pudo descargar el informe."
        onRetry={() => { reportModule.retry(error); void openReport(); }}
        onDismiss={() => (hiddenErrors = { ...hiddenErrors, report: true })}
      />
    {/await}
  {/if}
</div>



<style>
  .workshop {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas:
      "bar"
      "stage"
      "telemetry";
    background: var(--page-bg);
    color: var(--text);
  }

  .workshop.with-panel {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "bar bar"
      "stage panel"
      "telemetry panel";
  }

  .bar-area {
    grid-area: bar;
    min-width: 0;
  }

  .stage-area {
    grid-area: stage;
    display: grid;
    min-width: 0;
    min-height: 0;
  }

  .telemetry-area {
    grid-area: telemetry;
    min-width: 0;
  }

  .panel-area {
    grid-area: panel;
    display: flex;
    min-height: 0;
  }

  .loading {
    margin: 0;
    font-size: 12.5px;
    color: var(--muted);
  }

  .toasts {
    position: fixed;
    bottom: 16px;
    left: 50%;
    z-index: 60;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(360px, calc(100vw - 32px));
    translate: -50% 0;
    pointer-events: none;
  }

  .toasts > :global(*) {
    pointer-events: auto;
  }

  @media (max-width: 700px) {
    .workshop.with-panel {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        "bar"
        "stage"
        "telemetry";
    }
  }
</style>
