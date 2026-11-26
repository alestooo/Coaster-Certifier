<script lang="ts">
  import { Eye, EyeOff, MapPin } from "lucide-svelte";
  import { legendItems } from "../../lib/load-profile";
  import PointLegend from "./PointLegend.svelte";
  import type { SimulationConfig, Track } from "../../lib/types";

  interface Props {
    config: SimulationConfig;
    /** Trazado que se ve: la sección «Puntos» dice qué letras tiene. */
    track: Track;
    visible: boolean;
    /** Falso mientras no hay un dictamen vigente para el diseño que se ve. */
    available: boolean;
  }

  let { config, track, visible = $bindable(), available }: Props = $props();

  let items = $derived(legendItems(config));
  let showPoints = $state(false);

  /** Esc cierra la sección «Puntos» sin cerrar otra cosa. */
  function closeOnEscape(event: KeyboardEvent) {
    if (event.key !== "Escape" || !showPoints) return;
    event.stopPropagation();
    showPoints = false;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="legend" class:off={!visible} class:stale={!available} onkeydown={closeOnEscape}>
  <button type="button" aria-pressed={visible} title={visible ? "Ocultar la franja de fuerza g" : "Mostrar la franja de fuerza g"} onclick={() => (visible = !visible)}>
    {#if visible}<Eye size={14} />{:else}<EyeOff size={14} />{/if}
    <span>Fuerza g</span>
    <!-- Cuando no entra la lista, un punto con los cuatro tonos recuerda qué colorea la franja. -->
    <i class="swatch" aria-hidden="true"></i>
  </button>
  {#if visible}
    <ul aria-label="Colores de la franja de fuerza g">
      {#each items as item (item.tone)}
        <li title={item.detail}><i class={item.tone} aria-hidden="true"></i>{item.text} <span class="detail">{item.detail}</span></li>
      {/each}
    </ul>
  {/if}
  <button type="button" class="points-toggle" aria-label="Puntos A–F" aria-expanded={showPoints} aria-controls="point-legend" title="Qué significa cada letra" onclick={() => (showPoints = !showPoints)}>
    <MapPin size={14} />
    <span>Puntos A–F</span>
  </button>
  {#if showPoints}
    <div class="points-card" id="point-legend">
      <PointLegend {track} />
    </div>
  {/if}
</div>

<style>
  .legend {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 12px 4px 4px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: rgb(255 255 255 / 92%);
    box-shadow: var(--shadow-sm);
    backdrop-filter: blur(6px);
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-soft);
  }

  .legend.off {
    padding-right: 4px;
  }

  .legend.stale ul {
    opacity: 0.5;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: 999px;
    background: var(--surface-soft);
    color: var(--text-soft);
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  .points-card {
    position: absolute;
    top: calc(100% + var(--space-2));
    right: 0;
    width: min(300px, calc(100vw - 32px));
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-lg);
  }

  .points-toggle[aria-expanded="true"] {
    background: var(--primary-soft);
    color: var(--primary-strong);
  }

  ul {
    display: flex;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }

  i {
    width: 16px;
    height: 5px;
    border-radius: 3px;
  }

  .comfort {
    background: var(--success);
  }

  .near {
    background: var(--accent);
  }

  .over {
    background: var(--danger);
  }

  .float {
    background: var(--float);
  }

  .swatch {
    display: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: conic-gradient(var(--success) 0 25%, var(--accent) 0 50%, var(--danger) 0 75%, var(--float) 0);
  }

  .off .swatch {
    opacity: 0.4;
  }

  @media (max-width: 860px) {
    ul,
    .points-toggle span {
      display: none;
    }

    .swatch {
      display: inline-block;
    }

    .legend {
      padding-right: 4px;
    }
  }

  /* El umbral se lee en voz alta y aparece al pasar el puntero (title); no ensancha la leyenda. */
  .detail {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
