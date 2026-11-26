<script lang="ts">
  import { onDestroy, type Snippet } from "svelte";
  import { X } from "lucide-svelte";
  import IconButton from "../ui/IconButton.svelte";

  interface Props {
    title: string;
    subtitle?: string;
    onClose: () => void;
    /** Alto (px) con el que la hoja del teléfono tapa el lienzo; 0 como panel lateral. */
    onSheet?: (height: number) => void;
    children: Snippet;
  }

  let { title, subtitle = "", onClose, onSheet, children }: Props = $props();

  let element: HTMLElement;
  let height = $state(0);

  // En el teléfono el panel es una hoja fija sobre el lienzo: el lienzo encuadra por encima de ella.
  $effect(() => {
    const sheet = getComputedStyle(element).position === "fixed";
    onSheet?.(sheet ? height : 0);
  });

  onDestroy(() => onSheet?.(0));
</script>

<aside class="side" aria-label={title} bind:this={element} bind:offsetHeight={height}>
  <header>
    <div>
      <h2>{title}</h2>
      {#if subtitle}<p>{subtitle}</p>{/if}
    </div>
    <IconButton label="Cerrar panel" icon={X} title="Cerrar (Esc)" onclick={onClose} />
  </header>
  <div class="body">
    {@render children()}
  </div>
</aside>

<style>
  .side {
    display: flex;
    flex-direction: column;
    width: 348px;
    min-height: 0;
    border-left: 1px solid var(--border);
    background: var(--surface);
    animation: slide-in 0.18s ease-out;
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 14px 10px 16px;
    border-bottom: 1px solid var(--border);
  }

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 900;
    color: var(--text);
  }

  header p {
    margin: 2px 0 0;
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
  }

  .body {
    flex: 1;
    min-height: 0;
    padding: 14px 16px 20px;
    overflow: auto;
    overscroll-behavior: contain;
  }

  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateX(12px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .side {
      animation: none;
    }
  }

  @media (max-width: 700px) {
    .side {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 20;
      width: auto;
      max-height: 60dvh;
      border-left: 0;
      border-top: 1px solid var(--border);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      box-shadow: var(--shadow-lg);
      animation-name: sheet-in;
    }

    @keyframes sheet-in {
      from {
        transform: translateY(24px);
        opacity: 0;
      }
    }
  }
</style>
