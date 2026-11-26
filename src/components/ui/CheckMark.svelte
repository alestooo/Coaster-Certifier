<script lang="ts">
  import { CircleCheck, CircleX, TriangleAlert } from "lucide-svelte";

  /** Marca de una condición: cumple, no cumple (error) o aviso; con nombre accesible. */
  interface Props {
    ok: boolean;
    severity?: "error" | "warning";
    size?: number;
  }

  let { ok, severity = "error", size = 15 }: Props = $props();

  type Kind = "ok" | "error" | "warning";
  let kind: Kind = $derived(ok ? "ok" : severity === "error" ? "error" : "warning");
  const LABELS = { ok: "Cumple", error: "No cumple", warning: "Aviso" } as const;
  const ICONS = { ok: CircleCheck, error: CircleX, warning: TriangleAlert } as const;
  let Icon = $derived(ICONS[kind]);
</script>

<span class={`mark ${kind}`} role="img" aria-label={LABELS[kind]}><Icon {size} aria-hidden="true" /></span>

<style>
  .mark {
    display: inline-flex;
    flex: none;
    vertical-align: -3px;
  }

  .ok {
    color: var(--success);
  }

  .error {
    color: var(--danger);
  }

  .warning {
    color: var(--warn-text);
  }
</style>
