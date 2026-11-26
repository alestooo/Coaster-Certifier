<script lang="ts">
  import { ZoomIn, ZoomOut, Maximize, LocateFixed } from "lucide-svelte";
  import IconButton from "../ui/IconButton.svelte";

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
  <IconButton label="Alejar" icon={ZoomOut} onclick={onZoomOut} />
  <IconButton label="Ver todo el trazado" icon={Maximize} title="Ver todo el trazado (doble clic en el fondo)" onclick={onFit} />
  <IconButton label="Acercar" icon={ZoomIn} title="Acercar (rueda del ratón)" onclick={onZoomIn} />
  <span class="divider" aria-hidden="true"></span>
  <IconButton label="Seguir al tren" icon={LocateFixed} pressed={following} onclick={onFollow} />
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

  /* En la barra flotante los botones son redondos, como la barra. */
  .zoom :global(.icon-button) {
    border-radius: 50%;
  }

  .divider {
    width: 1px;
    height: 18px;
    margin: 0 2px;
    background: var(--border);
  }
</style>
