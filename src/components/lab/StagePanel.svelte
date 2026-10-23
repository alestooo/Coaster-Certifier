<script lang="ts">
  import { onMount } from "svelte";
  import { PLAYBACK_SPEEDS, type SimulationRunner, type PlaybackSpeed } from "../../lib/simulation-runner.svelte";
  import type { Passenger } from "../../game/passengers";
  import { renderSimulation, RENDER_DEFAULT_OPTIONS } from "../../ui/renderer/index.js";
  import { formatNumber, formatSeconds } from "../../ui/format";

  let {
    runner,
    passengers,
    designConfirmed,
    statusLabel
  }: {
    runner: SimulationRunner;
    passengers: Passenger[];
    designConfirmed: boolean;
    statusLabel: string;
  } = $props();

  let canvas: HTMLCanvasElement;
  let cameraMode = $state<"full" | "follow">("full");
  let zoom = $state(1.6);
  let options = $state({ ...RENDER_DEFAULT_OPTIONS });

  let lastIndex = $derived(Math.max(0, runner.history.length - 1));
  let scrubValue = $derived(runner.scrubIndex ?? lastIndex);
  let viewState = $derived(runner.viewState);

  const layerToggles: { key: keyof typeof RENDER_DEFAULT_OPTIONS; label: string }[] = [
    { key: "showSections", label: "Tramos" },
    { key: "showMarkers", label: "Puntos A–F" },
    { key: "showTrail", label: "Estela" },
    { key: "showForces", label: "Fuerzas" },
    { key: "showGauge", label: "Indicador g" }
  ];

  function draw() {
    if (!canvas) return;

    renderSimulation(canvas, {
      state: runner.viewState,
      config: runner.config,
      track: runner.track,
      passengers,
      history: runner.history,
      camera: { mode: cameraMode, zoom },
      options
    });
  }

  onMount(() => {
    let frame = 0;
    let previous: number | null = null;

    function animate(now: number) {
      const elapsed = previous === null ? 0 : (now - previous) / 1000;
      previous = now;

      runner.tick(elapsed);
      draw();
      frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  });
</script>

<div class="stage">
  <div class="stage-toolbar">
    <div class="run-buttons">
      <button class="primary" type="button" disabled={!designConfirmed || !runner.canStart} onclick={() => runner.start()}>
        ▶ Iniciar
      </button>
      <button type="button" disabled={!runner.running} onclick={() => runner.pause()}>❚❚ Pausar</button>
      <button type="button" disabled={!designConfirmed || runner.isFinished || runner.running} onclick={() => runner.stepOnce()} title="Avanzar un paso de reporte">
        ⏭ Paso
      </button>
      <button type="button" disabled={!designConfirmed || runner.isFinished} onclick={() => runner.runToEnd()} title="Simular el recorrido completo sin animación">
        ⏩ Completar
      </button>
      <button type="button" onclick={() => runner.reset()}>↺ Reiniciar</button>
    </div>

    <label class="speed-label">
      Velocidad
      <select bind:value={runner.playbackSpeed} aria-label="Velocidad de reproducción">
        {#each PLAYBACK_SPEEDS as speed}
          <option value={speed as PlaybackSpeed}>{speed}×</option>
        {/each}
      </select>
    </label>

    <select aria-label="Cámara" bind:value={cameraMode}>
      <option value="full">Recorrido completo</option>
      <option value="follow">Seguir al tren</option>
    </select>

    <label class="zoom-label">
      {zoom.toFixed(1)}×
      <input aria-label="Zoom" type="range" min="1" max="2.5" step=".1" bind:value={zoom} disabled={cameraMode === "full"} />
    </label>
  </div>

  <div class="track-frame">
    <canvas bind:this={canvas} width="1200" height="520" aria-label="Pista y tren"></canvas>
  </div>

  <div class="layer-toggles" role="group" aria-label="Capas del dibujo">
    {#each layerToggles as toggle}
      <label>
        <input type="checkbox" bind:checked={options[toggle.key]} />
        {toggle.label}
      </label>
    {/each}
  </div>

  <div class="timeline">
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

    <div class="timeline-info">
      <strong>{!designConfirmed ? "Aplicá primero tu diseño" : runner.running ? "En movimiento" : statusLabel}</strong>
      <span>
        {viewState.section} · t = {formatSeconds(viewState.time)} · s = {formatNumber(viewState.distance)} m
        {#if runner.scrubIndex !== null}
          · <button type="button" class="link" onclick={() => runner.scrubTo(null)}>volver al instante actual</button>
        {/if}
      </span>
    </div>
  </div>
</div>

<style>
  .stage {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    min-height: 0;
  }

  .stage-toolbar {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
  }

  .run-buttons {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .stage-toolbar select {
    width: auto;
  }

  .speed-label,
  .zoom-label {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 11px;
    color: #76528e;
  }

  .zoom-label {
    width: 120px;
    margin-left: auto;
  }

  .track-frame {
    position: relative;
    flex: 1;
    min-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 12px;
    background: #f8f4fd;
  }

  .track-frame canvas {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    max-height: 100%;
  }

  .layer-toggles {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 11px;
    color: #76528e;
  }

  .layer-toggles label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin: 0;
  }

  .layer-toggles input {
    width: auto;
    accent-color: #8c63aa;
  }

  .timeline {
    display: grid;
    gap: 4px;
  }

  .timeline input[type="range"] {
    width: 100%;
    margin: 0;
    accent-color: #8c63aa;
  }

  .timeline-info {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 11px;
    color: #9980aa;
  }

  .timeline-info strong {
    color: #76528e;
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: #8050c8;
    font-size: 11px;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
