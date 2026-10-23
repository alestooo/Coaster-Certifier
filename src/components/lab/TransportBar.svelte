<script lang="ts">
  import { Play, Pause, SkipForward, FastForward, RotateCcw, Maximize2, LocateFixed, Layers, ZoomIn } from "lucide-svelte";
  import { PLAYBACK_SPEEDS, type SimulationRunner, type PlaybackSpeed } from "../../lib/simulation-runner.svelte";
  import { formatNumber } from "../../ui/format";

  type Options = Record<string, boolean>;

  let {
    runner,
    enabled,
    cameraMode = $bindable<"full" | "follow">("full"),
    zoom = $bindable(1.6),
    options = $bindable<Options>({})
  }: {
    runner: SimulationRunner;
    enabled: boolean;
    cameraMode?: "full" | "follow";
    zoom?: number;
    options?: Options;
  } = $props();

  const SPEED_LABELS: Record<number, string> = { 0.25: "¼×", 0.5: "½×", 1: "1×", 2: "2×", 4: "4×" };

  const LAYERS: { key: string; label: string }[] = [
    { key: "showScenery", label: "Escenario" },
    { key: "showSections", label: "Tramos" },
    { key: "showMarkers", label: "Puntos A–F" },
    { key: "showTrail", label: "Estela de rapidez" },
    { key: "showForces", label: "Fuerzas sobre el tren" },
    { key: "showReadings", label: "Lecturas sobre el canvas" },
    { key: "showGauge", label: "Indicador g sobre el canvas" }
  ];

  let lastIndex = $derived(Math.max(0, runner.history.length - 1));
  let scrubValue = $derived(runner.scrubIndex ?? lastIndex);
  let view = $derived(runner.viewState);
  let canPlay = $derived(enabled && (runner.running || !runner.isFinished));
</script>

<div class="transport">
  <div class="transport-actions">
    <button
      class="play"
      type="button"
      disabled={!canPlay}
      aria-label={runner.running ? "Pausar" : "Reproducir"}
      onclick={() => runner.toggle()}
    >
      {#if runner.running}<Pause size={20} />{:else}<Play size={20} />{/if}
      <span>{runner.running ? "Pausar" : "Reproducir"}</span>
    </button>

    <button class="certify" type="button" disabled={!enabled || runner.isFinished} title="Simular el recorrido completo y emitir el dictamen" onclick={() => runner.runToEnd()}>
      <FastForward size={16} />
      <span>Certificar</span>
    </button>

    <button class="icon" type="button" disabled={!enabled || runner.isFinished || runner.running} title="Avanzar un paso" aria-label="Avanzar un paso" onclick={() => runner.stepOnce()}>
      <SkipForward size={16} />
    </button>

    <button class="icon" type="button" title="Reiniciar" aria-label="Reiniciar" onclick={() => runner.reset()}>
      <RotateCcw size={16} />
    </button>
  </div>

  <div class="transport-timeline">
    <input
      type="range"
      min="0"
      max={lastIndex}
      step="1"
      value={scrubValue}
      disabled={runner.history.length < 2}
      aria-label="Línea de tiempo del recorrido"
      oninput={event => runner.scrubTo((event.currentTarget as HTMLInputElement).valueAsNumber)}
    />
    <div class="timeline-meta">
      <span>{view.section}</span>
      <span>
        t = {formatNumber(view.time, 2)} s · s = {formatNumber(view.distance, 1)} m
        {#if runner.scrubIndex !== null}
          · <button type="button" class="link" onclick={() => runner.scrubTo(null)}>volver al presente</button>
        {/if}
      </span>
    </div>
  </div>

  <div class="transport-tools">
    <div class="segmented" role="group" aria-label="Velocidad de reproducción">
      {#each PLAYBACK_SPEEDS as speed}
        <button type="button" class:active={runner.playbackSpeed === speed} onclick={() => (runner.playbackSpeed = speed as PlaybackSpeed)}>
          {SPEED_LABELS[speed]}
        </button>
      {/each}
    </div>

    <div class="segmented" role="group" aria-label="Cámara">
      <button type="button" class:active={cameraMode === "full"} title="Recorrido completo" aria-label="Recorrido completo" onclick={() => (cameraMode = "full")}>
        <Maximize2 size={14} />
      </button>
      <button type="button" class:active={cameraMode === "follow"} title="Seguir al tren" aria-label="Seguir al tren" onclick={() => (cameraMode = "follow")}>
        <LocateFixed size={14} />
      </button>
    </div>

    {#if cameraMode === "follow"}
      <label class="zoom" title="Zoom">
        <ZoomIn size={14} />
        <input type="range" min="1" max="2.5" step="0.1" bind:value={zoom} aria-label="Zoom" />
      </label>
    {/if}

    <details class="layers">
      <summary><Layers size={14} /> Capas</summary>
      <div class="layers-menu">
        {#each LAYERS as layer}
          <label><input type="checkbox" bind:checked={options[layer.key]} /> {layer.label}</label>
        {/each}
      </div>
    </details>
  </div>
</div>

<style>
  .transport {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    padding: 10px 4px 0;
  }

  .transport-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .transport button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--text-soft);
    font: inherit;
    font-weight: 800;
    font-size: 12.5px;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
  }

  .transport button:hover:not(:disabled) {
    background: var(--surface-soft);
    transform: translateY(-1px);
  }

  .transport button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .play {
    height: 46px;
    padding: 0 18px 0 14px;
    border-color: var(--primary) !important;
    background: linear-gradient(180deg, #9a6be0, var(--primary)) !important;
    color: var(--primary-text) !important;
    box-shadow: 0 6px 16px rgb(122 75 198 / 30%);
  }

  .certify {
    height: 40px;
    padding: 0 14px;
    border-color: #c9ead9 !important;
    background: var(--success-soft) !important;
    color: #1f7a57 !important;
  }

  .icon {
    width: 40px;
    height: 40px;
    justify-content: center;
    padding: 0;
  }

  .transport-timeline {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .transport-timeline input[type="range"] {
    width: 100%;
    margin: 0;
    accent-color: var(--primary);
  }

  .timeline-meta {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .timeline-meta span:first-child {
    font-weight: 800;
    color: var(--text-soft);
  }

  .link {
    display: inline !important;
    padding: 0 !important;
    border: 0 !important;
    background: none !important;
    color: var(--primary) !important;
    font-size: 11px !important;
    text-decoration: underline;
  }

  .transport-tools {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .segmented {
    display: inline-flex;
    padding: 3px;
    border: 1px solid var(--border);
    border-radius: 11px;
    background: var(--surface-soft);
  }

  .segmented button {
    height: 30px;
    min-width: 34px;
    padding: 0 9px;
    justify-content: center;
    border: 0;
    border-radius: 8px;
    background: transparent;
    font-size: 12px;
  }

  .segmented button.active {
    background: var(--surface);
    color: var(--primary);
    box-shadow: var(--shadow-sm);
  }

  .zoom {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
  }

  .zoom input {
    width: 80px;
    margin: 0;
    accent-color: var(--primary);
  }

  .layers {
    position: relative;
  }

  .layers summary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 11px;
    background: var(--surface);
    color: var(--text-soft);
    font-size: 12px;
    font-weight: 800;
    list-style: none;
    cursor: pointer;
  }

  .layers summary::-webkit-details-marker {
    display: none;
  }

  .layers-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 20;
    display: grid;
    gap: 6px;
    min-width: 200px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow);
    font-size: 12px;
    color: var(--text-soft);
  }

  .layers-menu label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
  }

  .layers-menu input {
    width: auto;
    accent-color: var(--primary);
  }

  @media (max-width: 1100px) {
    .transport {
      grid-template-columns: 1fr;
    }

    .transport-tools {
      flex-wrap: wrap;
    }
  }

  @media (max-width: 560px) {
    .play span,
    .certify span {
      display: none;
    }

    .play {
      padding: 0 14px;
    }
  }
</style>
