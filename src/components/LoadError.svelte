<script lang="ts">
  import { X } from "lucide-svelte";

  /** Aviso cuando una parte de la app no se pudo descargar, con un botón para reintentar. */
  interface Props {
    message: string;
    /** Qué hacer; por defecto, reintentar cuando vuelva la conexión. */
    hint?: string;
    actionLabel?: string;
    onRetry: () => void;
    /** Si se da, el aviso se puede cerrar. */
    onDismiss?: () => void;
    /** Aviso suelto sobre el lienzo (con sombra); quien lo muestra decide dónde va. */
    floating?: boolean;
  }

  let { message, hint = "Revisá la conexión y probá de nuevo.", actionLabel = "Reintentar", onRetry, onDismiss, floating = false }: Props = $props();
</script>

<div class="load-error" class:floating role="alert">
  <p>{message} {hint}</p>
  <div class="actions">
    <button type="button" onclick={onRetry}>{actionLabel}</button>
    {#if onDismiss}
      <button type="button" class="dismiss" aria-label="Cerrar aviso" title="Cerrar" onclick={onDismiss}><X size={14} /></button>
    {/if}
  </div>
</div>

<style>
  .load-error {
    display: grid;
    gap: 8px;
    padding: 10px;
    border-radius: 10px;
    background: var(--danger-soft);
    color: #9d2a39;
    font-size: 12.5px;
  }

  .floating {
    box-shadow: var(--shadow-lg);
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .dismiss {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    padding: 0;
  }

  p {
    margin: 0;
  }

  button {
    justify-self: start;
    height: 32px;
    padding: 0 12px;
    border: 1px solid #f5c3cc;
    border-radius: 9px;
    background: var(--surface);
    color: #9d2a39;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }
</style>
