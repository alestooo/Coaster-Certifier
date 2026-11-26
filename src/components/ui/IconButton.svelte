<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import type { IconComponent } from "../../lib/ui/icon";

  /** Botón de solo ícono: el nombre es obligatorio (aria-label y tooltip). */
  interface Props extends HTMLButtonAttributes {
    label: string;
    icon: IconComponent;
    size?: "sm" | "md" | "lg";
    variant?: "ghost" | "secondary";
    pressed?: boolean;
  }

  let { label, icon: Icon, size = "md", variant = "ghost", pressed, type = "button", class: className = "", ...rest }: Props = $props();

  const ICON_SIZE = { sm: 14, md: 16, lg: 18 } as const;
</script>

<button {type} class="icon-button {variant} {size} {className}" aria-label={label} title={label} aria-pressed={pressed} {...rest}>
  <Icon size={ICON_SIZE[size]} />
</button>

<style>
  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--text-soft);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .sm {
    width: var(--control-sm);
    height: var(--control-sm);
  }

  .md {
    width: var(--control-md);
    height: var(--control-md);
  }

  .lg {
    width: var(--control-lg);
    height: var(--control-lg);
  }

  .ghost {
    background: transparent;
  }

  .secondary {
    border-color: var(--border-strong);
    background: var(--surface);
  }

  .icon-button:hover:not(:disabled),
  .icon-button[aria-pressed="true"] {
    background: var(--surface-muted);
    color: var(--primary-strong);
  }

  .icon-button:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .icon-button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
