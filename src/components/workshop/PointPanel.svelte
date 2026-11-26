<script lang="ts">
  import { tick, untrack } from "svelte";
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

  function numberOf(event: Event): number | null {
    const value = (event.currentTarget as HTMLInputElement).valueAsNumber;
    return Number.isFinite(value) ? value : null;
  }

  /**
   * Aplica la edición y, ya con el diseño nuevo, muestra en el campo el valor
   * vigente: si el recortado coincide con el anterior, el campo no se redibuja
   * solo y quedaría lo escrito.
   */
  async function apply(input: HTMLInputElement, edit: PointEdit | null, shown: () => string, note = "") {
    if (edit) onPoints(edit.points);
    reason = note || (edit?.reason ?? (edit?.limited ? "El valor se ajustó al límite permitido." : ""));
    await tick();
    input.value = shown();
  }

  function field(event: Event, edit: (value: number) => PointEdit | null, shown: () => string, note?: (value: number) => string) {
    const input = event.currentTarget as HTMLInputElement;
    const value = numberOf(event);
    if (value === null) {
      input.value = shown();
      return;
    }
    void apply(input, edit(value), shown, note?.(value) ?? "");
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
    <label>
      <span><i>x</i> Posición horizontal</span>
      <span class="value">
        <input type="number" step="any" aria-label="Posición horizontal x" value={x.toFixed(1)} onchange={event =>
          field(event, value => movePoint(config, index, value, y), () => x.toFixed(1))} />
        m
      </span>
    </label>
    <label>
      <span><i>y</i> Altura</span>
      <span class="value">
        <input type="number" step="any" aria-label="Altura y" value={y.toFixed(1)} onchange={event =>
          field(event, value => movePoint(config, index, x, value), () => y.toFixed(1))} />
        m
      </span>
    </label>

    {#if hasLoop}
      <label>
        <span><i>h_L</i> Altura del loop</span>
        <span class="value">
          <!-- h_L ≤ 0 quitaría el loop sin aviso: eso lo hace «Quitar loop». -->
          <input type="number" step="any" aria-label="Altura del loop h_L" value={point.loopHeight} onchange={event =>
            field(
              event,
              value => (value > 0 ? setPointLoop(config, index, value, point.loopTopRadius) : null),
              () => String(config.customPoints[index]?.loopHeight ?? ""),
              value => (value > 0 ? "" : REMOVE_LOOP_HINT)
            )} />
          m
        </span>
      </label>
      <label>
        <span><i>R</i> Radio en la cima</span>
        <span class="value">
          <input type="number" step="any" aria-label="Radio en la cima R" value={point.loopTopRadius} onchange={event =>
            field(event, value => setPointLoop(config, index, point.loopHeight, value), () => String(config.customPoints[index]?.loopTopRadius ?? ""))} />
          m
        </span>
      </label>
    {/if}
  </div>

  {#if reason}<p class="reason" role="status">{reason}</p>{/if}

{#if !hasLoop}
    <p class="tip">Para ponerle un loop o borrarlo, usá la barra que aparece sobre el punto en la pista.</p>
  {/if}
{/if}

<section class="templates">
  <h3>Empezar de una plantilla</h3>
  <div>
    {#each CUSTOM_TEMPLATES as template (template.id)}
      <button type="button" onclick={() => useTemplate(template)}>{template.label}</button>
    {/each}
  </div>
</section>

<style>
  .rows {
    display: grid;
  }

  label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 0;
    border-bottom: 1px dashed var(--border);
    font-size: 13px;
    font-weight: 800;
  }

  i {
    margin-right: 6px;
    padding: 2px 6px;
    border-radius: 6px;
    background: var(--primary-soft);
    color: var(--primary-strong);
    font-size: 11.5px;
    font-weight: 900;
  }

  .value {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    color: var(--muted);
  }

  input {
    width: 76px;
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    font: inherit;
    font-size: 13px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--text);
  }

  .reason {
    margin: 8px 0 0;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--accent-soft);
    color: #8a5a12;
    font-size: 12px;
    line-height: 1.45;
  }

  .tip {
    margin: 10px 0 0;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--muted);
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text-soft);
    font: inherit;
    font-size: 12.5px;
    font-weight: 800;
    cursor: pointer;
  }

  button:hover {
    background: var(--primary-soft);
    color: var(--primary-strong);
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
