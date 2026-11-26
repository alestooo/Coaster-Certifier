<script lang="ts">
  import { Eye, EyeOff } from "lucide-svelte";
  import { legendItems } from "../../lib/load-profile";
  import type { SimulationConfig } from "../../lib/types";

  interface Props {
    config: SimulationConfig;
    visible: boolean;
    /** Falso mientras no hay un dictamen vigente para el diseño que se ve. */
    available: boolean;
  }

  let { config, visible = $bindable(), available }: Props = $props();

  let items = $derived(legendItems(config));
</script>

<div class="legend" class:off={!visible} class:stale={!available}>
  <button type="button" aria-pressed={visible} title={visible ? "Ocultar la franja de fuerza g" : "Mostrar la franja de fuerza g"} onclick={() => (visible = !visible)}>
    {#if visible}<Eye size={14} />{:else}<EyeOff size={14} />{/if}
    <span>Fuerza g</span>
    <!-- Cuando no entra la lista, un punto con los cuatro tonos recuerda qué colorea la franja. -->
    <i class="swatch" aria-hidden="true"></i>
  </button>
  {#if visible}
    <ul aria-label="Colores de la franja de fuerza g">
      {#each items as item (item.tone)}
        <li><i class={item.tone} aria-hidden="true"></i>{item.text}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .legend {
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
    background: #2f9d78;
  }

  .near {
    background: #f2a93b;
  }

  .over {
    background: #d9465a;
  }

  .float {
    background: #3a7bd5;
  }

  .swatch {
    display: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: conic-gradient(#2f9d78 0 25%, #f2a93b 0 50%, #d9465a 0 75%, #3a7bd5 0);
  }

  .off .swatch {
    opacity: 0.4;
  }

  @media (max-width: 860px) {
    ul {
      display: none;
    }

    .swatch {
      display: inline-block;
    }

    .legend {
      padding-right: 4px;
    }
  }
</style>
