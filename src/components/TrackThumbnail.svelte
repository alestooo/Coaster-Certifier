<script lang="ts">
  import { trackToSvg, metresGrid } from "../ui/track-svg";
  import type { ConfigInput } from "../lib/types";

  let {
    config,
    showMarkers = false,
    showGrid = false,
    verticalScale = "auto",
    class: className = ""
  }: {
    config: ConfigInput;
    showMarkers?: boolean;
    showGrid?: boolean;
    /** 1 = escala real; "auto" exagera la altura hasta ×2,5 para que se lea mejor. */
    verticalScale?: number | "auto";
    class?: string;
  } = $props();

  let projection = $derived(trackToSvg(config, { padding: 8, width: 640, verticalScale, maxVerticalScale: 2.5 }));
  let grid = $derived(projection.ok && showGrid ? metresGrid(projection) : null);
</script>

{#if projection.ok}
  <svg class={`track-thumbnail ${className}`} viewBox={projection.viewBox} aria-hidden="true">
    <defs>
      <linearGradient id="thumb-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ece5fc" />
        <stop offset="1" stop-color="#ffffff" />
      </linearGradient>
    </defs>

    <rect width={projection.width} height={projection.height} fill="url(#thumb-sky)" />
    <rect x="0" y={projection.groundY} width={projection.width} height={projection.height - projection.groundY} fill="#dfeede" />

    {#if grid}
      <g stroke="#d9cfe6" stroke-width="0.6">
        {#each grid.vertical as line}
          <line x1={line.position} y1="0" x2={line.position} y2={projection.groundY} stroke-dasharray={line.major ? "" : "2 3"} />
        {/each}
        {#each grid.horizontal as line}
          <line x1="0" y1={line.position} x2={projection.width} y2={line.position} stroke-dasharray={line.major ? "" : "2 3"} />
        {/each}
      </g>
    {/if}

    <rect x={projection.station.x} y={projection.station.y} width={projection.station.width} height={projection.station.height} rx="2" fill="#e8dff2" stroke="#bfa9d6" stroke-width="1" />
    <rect x={projection.brake.x} y={projection.brake.y} width={projection.brake.width} height={projection.brake.height} fill="#f4c7cf" />

    <path d={projection.path} fill="none" stroke="#c7b8d9" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" />
    <path d={projection.path} fill="none" stroke="var(--primary, #7a4bc6)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" />

    {#if projection.verticalScale > 1.05}
      <text x={projection.width - 6} y="12" text-anchor="end" font-size="9" font-weight="800" fill="#9b84b3" font-family="Nunito, system-ui, sans-serif">vertical ×{projection.verticalScale.toFixed(1)}</text>
    {/if}

    {#if showMarkers}
      {#each projection.markers as marker}
        <g transform={`translate(${marker.x} ${marker.y - 14})`}>
          <circle r="8" fill="#5f329a" stroke="white" stroke-width="2" />
          <text y="3.5" text-anchor="middle" font-size="9" font-weight="800" fill="white" font-family="Nunito, system-ui, sans-serif">{marker.label}</text>
        </g>
      {/each}
    {/if}
  </svg>
{:else}
  <div class={`track-thumbnail track-thumbnail-error ${className}`} role="img" aria-label="Trazado inválido">
    <span>Trazado inválido</span>
  </div>
{/if}

<style>
  .track-thumbnail {
    display: block;
    width: 100%;
    height: auto;
    border-radius: inherit;
  }

  .track-thumbnail-error {
    display: grid;
    place-items: center;
    min-height: 120px;
    background: var(--danger-soft, #fde6ea);
    color: var(--danger, #d9465a);
    font-size: 12px;
    font-weight: 700;
  }
</style>
