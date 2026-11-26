<script lang="ts">
  import { Play, Pause, RotateCcw, FastForward } from "lucide-svelte";
  import { PLAYBACK_SPEEDS, type SimulationRunner, type PlaybackSpeed } from "../../lib/simulation-runner.svelte";
  import { formatNumber } from "../../ui/format";
  import IconButton from "../ui/IconButton.svelte";

  let { runner }: { runner: SimulationRunner } = $props();

  const SPEED_LABELS: Record<number, string> = { 0.25: "¼×", 0.5: "½×", 1: "1×", 2: "2×", 4: "4×" };

  let lastIndex = $derived(Math.max(0, runner.history.length - 1));
  let scrubValue = $derived(runner.scrubIndex ?? lastIndex);
  let view = $derived(runner.viewState);
  let canPlay = $derived(runner.running || !runner.isFinished);

  function cycleSpeed() {
    const index = PLAYBACK_SPEEDS.indexOf(runner.playbackSpeed);
    runner.playbackSpeed = PLAYBACK_SPEEDS[(index + 1) % PLAYBACK_SPEEDS.length] as PlaybackSpeed;
  }
</script>

<div class="pill" role="toolbar" aria-label="Reproducción del recorrido">
  <button
    type="button"
    class="play"
    disabled={!canPlay}
    aria-label={runner.running ? "Pausar" : "Reproducir"}
    title={runner.running ? "Pausar (espacio)" : "Reproducir (espacio)"}
    onclick={() => runner.toggle()}
  >
    {#if runner.running}<Pause size={18} />{:else}<Play size={18} />{/if}
  </button>

  <IconButton label="Volver al punto A" icon={RotateCcw} onclick={() => runner.reset()} />
  <IconButton label="Saltar al final" icon={FastForward} disabled={runner.isFinished} onclick={() => runner.runToEnd()} />

  <label class="timeline">
    <span class="visually-hidden">Línea de tiempo del recorrido</span>
    <input
      type="range"
      min="0"
      max={lastIndex}
      step="1"
      value={scrubValue}
      disabled={runner.history.length < 2}
      oninput={event => runner.scrubTo((event.currentTarget as HTMLInputElement).valueAsNumber)}
    />
  </label>

  <span class="time" title={view.section}>t = {formatNumber(view.time, 1)} s</span>

  <button type="button" class="speed" aria-label={`Velocidad de reproducción: ${SPEED_LABELS[runner.playbackSpeed]}`} title="Velocidad de reproducción" onclick={cycleSpeed}>
    {SPEED_LABELS[runner.playbackSpeed]}
  </button>
</div>

<style>
  .pill {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px 4px 4px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: rgb(255 255 255 / 92%);
    box-shadow: var(--shadow-sm);
    backdrop-filter: blur(6px);
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--text-soft);
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    background: var(--surface-soft);
  }

  button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .pill :global(.icon-button) {
    border-radius: 50%;
  }

  .play {
    width: 38px;
    height: 38px;
    background: var(--primary);
    color: white;
  }

  .play:hover:not(:disabled) {
    background: var(--primary-strong);
  }

  .timeline {
    display: flex;
    width: clamp(90px, 18vw, 220px);
  }

  .timeline input {
    width: 100%;
    accent-color: var(--primary);
  }

  .time {
    min-width: 64px;
    font-size: 12px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--text-soft);
  }

  .speed {
    width: auto;
    min-width: 34px;
    padding: 0 6px;
    border-radius: 8px;
    font: inherit;
    font-size: 12px;
    font-weight: 900;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @media (max-width: 700px) {
    .pill {
      width: 100%;
      box-sizing: border-box;
    }

    .timeline {
      flex: 1;
      width: auto;
    }
  }
</style>
