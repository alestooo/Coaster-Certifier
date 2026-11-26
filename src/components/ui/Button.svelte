<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  /** Botón de la app: una sola familia de estilos (primario, secundario, fantasma, peligro) y tres tamaños. */
  interface Props extends HTMLButtonAttributes {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
    children: Snippet;
  }

  let { variant = "secondary", size = "md", type = "button", class: className = "", children, ...rest }: Props = $props();
</script>

<button {type} class="button {variant} {size} {className}" {...rest}>{@render children()}</button>

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: 0 var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    font: inherit;
    font-weight: var(--weight-bold);
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .sm {
    height: var(--control-sm);
    font-size: var(--text-12);
  }

  .md {
    height: var(--control-md);
    font-size: var(--text-13);
  }

  .lg {
    height: var(--control-lg);
    padding: 0 var(--space-4);
    font-size: var(--text-14);
  }

  .primary {
    background: var(--primary);
    color: var(--on-primary);
  }

  .primary:hover:not(:disabled) {
    background: var(--primary-strong);
  }

  .secondary {
    border-color: var(--border-strong);
    background: var(--surface);
    color: var(--text-soft);
  }

  .secondary:hover:not(:disabled) {
    border-color: var(--primary);
    color: var(--primary-strong);
  }

  .ghost {
    background: transparent;
    color: var(--text-soft);
  }

  .ghost:hover:not(:disabled) {
    background: var(--surface-muted);
    color: var(--text);
  }

  .danger {
    border-color: var(--danger-border);
    background: var(--surface);
    color: var(--danger-text);
  }

  .danger:hover:not(:disabled) {
    background: var(--danger-soft);
  }

  .button:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
