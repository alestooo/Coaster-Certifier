<script lang="ts">
  import type { Camera } from "../../ui/renderer/camera.js";

  interface Props {
    camera: Camera;
    /** Punto de la vía bajo el cursor (m). */
    x: number;
    y: number;
    section: string;
    lines: string[];
  }

  let { camera, x, y, section, lines }: Props = $props();

  /** Espacio que necesita la etiqueta; cerca de los bordes se abre hacia el otro lado (px). */
  const CARD_ROOM_X = 290;
  const CARD_ROOM_Y = 90;

  let flipX = $derived(camera.toX(x) > camera.width - CARD_ROOM_X);
  let flipY = $derived(camera.toY(y) < CARD_ROOM_Y);
</script>

<div class="probe" style:translate={`${camera.toX(x)}px ${camera.toY(y)}px`} role="status" aria-live="off">
  <span class="dot" aria-hidden="true"></span>
  <div class="card" class:flip-x={flipX} class:flip-y={flipY}>
    {#if section}<strong>{section}</strong>{/if}
    {#each lines as line}<span>{line}</span>{/each}
  </div>
</div>

<style>
  .probe {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .dot {
    position: absolute;
    left: -6px;
    top: -6px;
    width: 12px;
    height: 12px;
    border: 2px solid white;
    border-radius: 50%;
    background: var(--primary);
    box-shadow: 0 0 0 3px rgb(122 75 198 / 25%);
    box-sizing: border-box;
  }

  .card {
    position: absolute;
    left: 14px;
    bottom: 14px;
    display: grid;
    gap: 1px;
    width: max-content;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgb(45 33 64 / 92%);
    color: white;
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
    line-height: 1.4;
    box-shadow: var(--shadow);
  }

  .card.flip-x {
    left: auto;
    right: 14px;
  }

  .card.flip-y {
    bottom: auto;
    top: 14px;
  }

  strong {
    font-size: 11px;
    font-weight: 900;
    color: var(--tooltip-muted);
  }
</style>
