<script lang="ts">
  import { X } from "lucide-svelte";
  import Button from "./ui/Button.svelte";
  import IconButton from "./ui/IconButton.svelte";

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
    <Button size="sm" variant="secondary" onclick={onRetry}>{actionLabel}</Button>
    {#if onDismiss}
      <IconButton label="Cerrar aviso" icon={X} size="sm" onclick={onDismiss} />
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
    color: var(--danger-text);
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

  p {
    margin: 0;
  }
</style>
