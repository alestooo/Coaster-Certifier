<script lang="ts">
  import { ZoomIn, ZoomOut, Maximize, LocateFixed } from "lucide-svelte";

  interface Props {
    following: boolean;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFit: () => void;
    onFollow: () => void;
  }

  let { following, onZoomIn, onZoomOut, onFit, onFollow }: Props = $props();
</script>

<div class="zoom" role="toolbar" aria-label="Cámara">
  <button type="button" aria-label="Alejar" title="Alejar" onclick={onZoomOut}><ZoomOut size={16} /></button>
  <button type="button" aria-label="Encuadrar el recorrido" title="Encuadrar (doble clic en el fondo)" onclick={onFit}><Maximize size={15} /></button>
  <button type="button" aria-label="Acercar" title="Acercar (rueda del ratón)" onclick={onZoomIn}><ZoomIn size={16} /></button>
  <span class="divider" aria-hidden="true"></span>
  <button type="button" class:active={following} aria-pressed={following} aria-label="Seguir al tren" title="Seguir al tren" onclick={onFollow}>
    <LocateFixed size={16} />
  </button>
</div>

<style>
  .zoom {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
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

  button:hover {
    background: var(--surface-soft);
  }

  button.active {
    background: var(--primary-soft);
    color: var(--primary-strong);
  }

  .divider {
    width: 1px;
    height: 18px;
    margin: 0 2px;
    background: var(--border);
  }
</style>
