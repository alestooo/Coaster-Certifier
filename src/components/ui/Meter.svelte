<script lang="ts">
  /** Indicador de solo lectura (no es un slider): valor dentro de un rango, con el tono del estado. */
  interface Props {
    label: string;
    value: number;
    min: number;
    max: number;
    tone: "ok" | "warn" | "over";
    valueText?: string;
  }

  let { label, value, min, max, tone, valueText }: Props = $props();

  let fraction = $derived(max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0);
</script>

<div class="meter {tone}" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} aria-valuetext={valueText}>
  <i style:width={`${fraction * 100}%`}></i>
</div>

<style>
  .meter {
    height: 6px;
    overflow: hidden;
    border-radius: var(--radius-pill);
    background: var(--surface-muted);
  }

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
  }

  .ok i {
    background: var(--success);
  }

  .warn i {
    background: var(--accent);
  }

  .over i {
    background: var(--danger);
  }
</style>
