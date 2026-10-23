<script lang="ts">
  import { onMount } from "svelte";
  import { CheckCircle2, XCircle, Clock3, Hourglass } from "lucide-svelte";
  import TransportBar from "./TransportBar.svelte";
  import type { SimulationRunner } from "../../lib/simulation-runner.svelte";
  import type { Passenger } from "../../game/passengers";
  import type { Verdict } from "../../lib/types";
  import { renderSimulation, RENDER_DEFAULT_OPTIONS } from "../../ui/renderer/index.js";

  let {
    runner,
    passengers,
    enabled,
    verdict,
    pendingMessage = ""
  }: {
    runner: SimulationRunner;
    passengers: Passenger[];
    enabled: boolean;
    verdict: Verdict | null;
    pendingMessage?: string;
  } = $props();

  let canvas: HTMLCanvasElement;
  let cameraMode = $state<"full" | "follow">("full");
  let zoom = $state(1.6);
  let options = $state<Record<string, boolean>>({ ...RENDER_DEFAULT_OPTIONS, showReadings: false });

  let chip = $derived.by(() => {
    if (runner.running) return { text: "En curso", kind: "live", icon: Clock3 };
    if (!runner.isFinished) return { text: enabled ? "Listo para certificar" : "Aplicá el diseño", kind: "idle", icon: Hourglass };
    return verdict?.approved
      ? { text: "Trazado aprobado", kind: "ok", icon: CheckCircle2 }
      : { text: "Trazado rechazado", kind: "bad", icon: XCircle };
  });

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
  <div class="track-frame">
    <canvas bind:this={canvas} width="1200" height="520" aria-label="Pista y tren"></canvas>

    <div class="stage-chip {chip.kind}">
      <chip.icon size={15} />
      <span>{chip.text}</span>
    </div>

    {#if pendingMessage}
      <div class="stage-pending">{pendingMessage}</div>
    {/if}
  </div>

  <TransportBar {runner} {enabled} bind:cameraMode bind:zoom bind:options />
</div>

<style>
  .stage {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .track-frame {
    position: relative;
    aspect-ratio: 1200 / 520;
    max-height: 560px;
    border-radius: var(--radius);
    overflow: hidden;
    background: #ece5fc;
    box-shadow: inset 0 0 0 1px var(--border);
  }

  .track-frame canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .stage-chip {
    position: absolute;
    top: 12px;
    right: 12px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgb(255 255 255 / 92%);
    box-shadow: var(--shadow-sm);
    font-size: 12px;
    font-weight: 800;
    color: var(--text-soft);
    backdrop-filter: blur(6px);
  }

  .stage-chip.ok {
    color: #1f7a57;
    background: rgb(227 245 236 / 95%);
  }

  .stage-chip.bad {
    color: #b7303f;
    background: rgb(253 230 234 / 95%);
  }

  .stage-chip.live {
    color: var(--info);
    background: rgb(231 240 255 / 95%);
  }

  .stage-pending {
    position: absolute;
    left: 50%;
    bottom: 14px;
    transform: translateX(-50%);
    padding: 9px 14px;
    border-radius: 999px;
    background: rgb(45 33 64 / 86%);
    color: white;
    font-size: 12px;
    font-weight: 700;
    backdrop-filter: blur(6px);
  }
</style>
