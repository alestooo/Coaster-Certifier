<script lang="ts">
  import { untrack } from "svelte";
  import NumberField from "../ui/NumberField.svelte";
  import Button from "../ui/Button.svelte";
  import Sym from "../ui/Sym.svelte";
  import { movePoint, setPointLoop, templateProblem, CUSTOM_TEMPLATES, type PointEdit } from "../../lib/custom-points";
  import type { SimulationConfig, TrackPoint } from "../../lib/types";

  interface Props {
    index: number;
    config: SimulationConfig;
    onPoints: (points: TrackPoint[]) => void;
    onSelectPoint: (index: number | null) => void;
  }

  let { index, config, onPoints, onSelectPoint }: Props = $props();

  const REMOVE_LOOP_HINT = "Para quitar el loop, usá «Quitar loop» en la barra sobre el punto.";

  let reason = $state("");
  let point = $derived(config.customPoints[index]);
  let x = $derived(point ? point.x * config.trackWidth : 0);
  let y = $derived(point ? point.y * config.initialHeight : 0);
  let hasLoop = $derived((point?.loopHeight ?? 0) > 0);

  // El motivo de un recorte es del punto que lo produjo.
  $effect(() => {
    void index;
    untrack(() => (reason = ""));
  });

  /** Aplica la edición; el campo vuelve solo a mostrar el valor vigente (aunque el recorte lo deje igual). */
  function apply(edit: PointEdit | null, note = "") {
    if (edit) onPoints(edit.points);
    reason = note || (edit?.reason ?? (edit?.limited ? "Se ajustó al límite permitido." : ""));
  }

  function useTemplate(template: (typeof CUSTOM_TEMPLATES)[number]) {
    const problem = templateProblem(config, template);
    if (problem) {
      reason = `«${template.label}» no entra con este ancho y esta altura: ${problem}`;
      return;
    }

    onPoints(template.build(config.initialHeight));
    onSelectPoint(null);
  }
</script>

{#if point}
  <div class="rows">
    <div class="row">
      <span class="name"><Sym symbol="x" /> Posición horizontal</span>
      <NumberField value={x} step={0.1} unit="m" label="Posición horizontal x" onCommit={value => apply(movePoint(config, index, value, y))} />
    </div>
    <div class="row">
      <span class="name"><Sym symbol="y" /> Altura</span>
      <NumberField value={y} step={0.1} unit="m" label="Altura y" onCommit={value => apply(movePoint(config, index, x, value))} />
    </div>

    {#if hasLoop}
      <div class="row">
        <span class="name"><Sym symbol="h_L" /> Altura del loop</span>
        <!-- h_L ≤ 0 quitaría el loop sin aviso: eso lo hace «Quitar loop». -->
        <NumberField
          value={point.loopHeight}
          step={0.5}
          unit="m"
          label="Altura del loop"
          onCommit={value => (value > 0 ? apply(setPointLoop(config, index, value, point.loopTopRadius)) : apply(null, REMOVE_LOOP_HINT))}
        />
      </div>
      <div class="row">
        <span class="name"><Sym symbol="R" /> Radio en la cima</span>
        <NumberField value={point.loopTopRadius} step={0.25} unit="m" label="Radio en la cima" onCommit={value => apply(setPointLoop(config, index, point.loopHeight, value))} />
      </div>
    {/if}
  </div>

  {#if reason}<p class="reason" role="status">{reason}</p>{/if}

{#if !hasLoop}
    <p class="tip">El loop y el borrado del punto están en la barra que aparece sobre él, en la pista.</p>
  {/if}
{/if}

<section class="templates">
  <h3>Empezar de una plantilla</h3>
  <div>
    {#each CUSTOM_TEMPLATES as template (template.id)}
      <Button size="sm" variant="secondary" onclick={() => useTemplate(template)}>{template.label}</Button>
    {/each}
  </div>
</section>

<style>
  .rows {
    display: grid;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border);
  }

  .name {
    font-size: var(--text-13);
    font-weight: var(--weight-bold);
  }

  .name :global(.sym) {
    display: inline-block;
    min-width: 1.6em;
    margin-right: var(--space-1);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
    background: var(--primary-soft);
    color: var(--primary-strong);
    font-size: var(--text-12);
    text-align: center;
  }

  .reason {
    margin: 8px 0 0;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--accent-soft);
    color: var(--warn-text);
    font-size: 12px;
    line-height: 1.45;
  }

  .tip {
    margin: 10px 0 0;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--muted);
  }

  .templates {
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  h3 {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .templates div {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
</style>
