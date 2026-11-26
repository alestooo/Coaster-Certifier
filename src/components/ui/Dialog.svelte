<script lang="ts">
  import type { Snippet } from "svelte";
  import { X } from "lucide-svelte";
  import IconButton from "./IconButton.svelte";

  /**
   * Marco común de los diálogos: encabezado, acciones, cierre, fondo y
   * comportamiento en el teléfono (pantalla completa). Se abre con
   * `showModal()`; Esc y el botón de cierre llaman a `onClose`.
   */
  interface Props {
    title: string;
    eyebrow?: string;
    wide?: boolean;
    /** «night»: fondo nocturno del menú (créditos). */
    tone?: "light" | "night";
    class?: string;
    onClose?: () => void;
    actions?: Snippet;
    children: Snippet;
  }

  let { title, eyebrow = "", wide = false, tone = "light", class: className = "", onClose = () => {}, actions, children }: Props = $props();

  const uid = $props.id();
  let dialog: HTMLDialogElement;

  export function showModal() {
    if (!dialog.open) dialog.showModal();
  }

  export function close() {
    dialog.close();
  }

  export function isOpen(): boolean {
    return dialog.open;
  }
</script>

<dialog bind:this={dialog} class="dialog {tone} {className}" class:wide aria-labelledby={`${uid}-title`} onclose={onClose}>
  <header>
    <div class="titles">
      {#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
      <h2 id={`${uid}-title`}>{title}</h2>
    </div>
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
    <IconButton label={`Cerrar: ${title}`} icon={X} variant="secondary" onclick={() => dialog.close()} />
  </header>
  <div class="body">{@render children()}</div>
</dialog>

<style>
  .dialog {
    width: min(760px, calc(100vw - 32px));
    max-height: calc(100dvh - 48px);
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    color: var(--text);
  }

  .dialog.wide {
    width: min(1100px, calc(100vw - 32px));
  }

  /* Mismo marco con los colores de la noche del menú: los controles heredan las variables. */
  .dialog.night {
    --surface: var(--menu-ink);
    --surface-soft: var(--menu-plum);
    --surface-muted: var(--menu-plum);
    --text: var(--menu-snow-warm);
    --text-soft: var(--menu-veil);
    --muted: var(--menu-dust);
    --border: rgb(206 175 235 / 15%);
    --border-strong: var(--menu-mist-deep);
    --primary-strong: var(--menu-snow);
    width: min(460px, calc(100vw - 32px));
    border-color: var(--menu-orchid);
    background: radial-gradient(circle at top right, var(--menu-plum), transparent 60%), var(--menu-ink);
  }

  .dialog.night h2 {
    color: var(--menu-cream-warm);
  }

  .dialog[open] {
    display: flex;
    flex-direction: column;
  }

  .dialog::backdrop {
    background: var(--backdrop);
    backdrop-filter: blur(4px);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-4) var(--space-3) var(--space-6);
    border-bottom: 1px solid var(--border);
  }

  .titles {
    flex: 1;
    min-width: 0;
  }

  .eyebrow {
    margin: 0 0 2px;
    font-size: var(--text-11);
    font-weight: var(--weight-black);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--muted);
  }

  h2 {
    margin: 0;
    font-size: var(--text-20);
    font-weight: var(--weight-black);
    color: var(--text);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  @media (max-width: 700px) {
    .dialog,
    .dialog.wide {
      width: 100vw;
      max-width: 100vw;
      height: 100dvh;
      max-height: 100dvh;
      border-radius: 0;
    }

    header {
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
    }

    .actions {
      order: 3;
      flex-basis: 100%;
    }

    header {
      flex-wrap: wrap;
    }
  }
</style>
