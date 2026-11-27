<script lang="ts">
  import { untrack } from "svelte";
  import { Sparkles, Square, Check, X } from "lucide-svelte";
  import Button from "../ui/Button.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Meter from "../ui/Meter.svelte";
  import Sym from "../ui/Sym.svelte";
  import { optimizationVariables, defaultVariables, OBJECTIVES, OPTIMIZATION_BUDGET } from "../../physics/index.js";
  import { OptimizerJob, type ObjectiveId } from "../../lib/optimizer.svelte";
  import { formatNumber } from "../../ui/format";
  import type { AuditResult } from "../../lib/live-audit.svelte";
  import type { SimulationConfig } from "../../lib/types";

  /**
   * Optimizador: elige un objetivo y qué valores se pueden cambiar, busca en
   * segundo plano y muestra el resultado verificado como pista fantasma.
   * «Aplicar» pasa por el historial del diseño (se deshace con Ctrl+Z).
   */
  interface Props {
    /** Diseño auditado (configuración y dictamen). */
    result: AuditResult | null;
    /** Borrador del diseño: si cambia (aunque todavía no se audite), el resultado ya no vale. */
    draftKey: string;
    /** Muestra (o quita, con null) la pista fantasma del resultado. */
    onPreview: (config: SimulationConfig | null) => void;
    onApply: (config: SimulationConfig) => void;
  }

  let { result, draftKey, onPreview, onApply }: Props = $props();

  const OBJECTIVE_OPTIONS: { value: ObjectiveId; label: string; ariaLabel: string }[] = [
    { value: "maxLoad", label: "Fuerza g", ariaLabel: OBJECTIVES.maxLoad.label },
    { value: "margin", label: "Margen", ariaLabel: OBJECTIVES.margin.label },
    { value: "height", label: "Altura", ariaLabel: OBJECTIVES.height.label },
    { value: "length", label: "Largo", ariaLabel: OBJECTIVES.length.label }
  ];

  const PHASES = { feasibility: "Buscando un diseño que apruebe", improve: "Mejorando", verify: "Verificando con la simulación completa" } as const;

  const job = new OptimizerJob();
  let objective = $state<ObjectiveId>("maxLoad");
  let annexRanges = $state(true);
  let chosen = $state<string[]>([]);
  /** Diseño que se aplicó: el aviso «Aplicado» se ve mientras el diseño sea ese. */
  let appliedKey = $state("");

  let config = $derived(result?.config ?? null);
  let catalog = $derived(config ? optimizationVariables(config, { annexRanges }) : []);
  let unit = $derived(OBJECTIVES[objective].unit);
  let outcome = $derived(job.result);

  /** Valores por defecto: los del elemento crítico del objetivo, más H. */
  function resetChoice() {
    chosen = result ? defaultVariables(result.config, { verdict: result.verdict }, objective) : [];
  }

  // Otro objetivo u otro diseño: los valores por defecto cambian y el resultado anterior ya no vale.
  let designKey = $derived(config ? JSON.stringify(config) : "");
  let applied = $derived(appliedKey !== "" && appliedKey === designKey);
  $effect(() => {
    void objective;
    void designKey;
    void draftKey;
    untrack(() => {
      job.reset();
      onPreview(null);
      resetChoice();
    });
  });

  $effect(() => () => {
    job.reset();
    onPreview(null);
  });

  // El resultado se ve sobre la pista mientras está en pantalla.
  $effect(() => {
    const next = outcome?.ok && outcome.applicable ? outcome.config : null;
    untrack(() => onPreview(next ?? null));
  });

  function toggle(id: string) {
    chosen = chosen.includes(id) ? chosen.filter(item => item !== id) : [...chosen, id];
  }

  function search() {
    if (!config) return;
    appliedKey = "";
    job.start(config, { objective, variables: chosen, annexRanges, budget: OPTIMIZATION_BUDGET });
  }

  function apply() {
    if (!outcome?.config) return;
    appliedKey = JSON.stringify(outcome.config);
    onApply(outcome.config);
  }

  function discard() {
    job.reset();
    onPreview(null);
  }

  /** Valor del objetivo con su unidad. */
  const shown = (value: number | undefined) => (value === undefined ? "—" : `${formatNumber(value, unit === "g" ? 2 : 1)} ${unit}`);
  const changeValue = (value: number | null, changeUnit: string) => (value === null ? "—" : `${formatNumber(value, 2)}${changeUnit ? ` ${changeUnit}` : ""}`);
</script>

{#if !result}
  <p class="note">El dictamen todavía se está calculando.</p>
{:else}
  <section class="group" aria-label="Objetivo">
    <h3>Objetivo</h3>
    <Segmented label="Objetivo de la optimización" block size="sm" value={objective} options={OBJECTIVE_OPTIONS} onChange={value => (objective = value)} />
    <p class="note">{OBJECTIVES[objective].label}, sin dejar de aprobar con los mismos márgenes que las correcciones.</p>
  </section>

  <section class="group" aria-label="Valores que se pueden cambiar">
    <h3>Valores que se pueden cambiar</h3>
    <div class="chips">
      {#each catalog as variable (variable.id)}
        {@const on = chosen.includes(variable.id)}
        <button
          type="button"
          class="chip"
          class:on
          aria-pressed={on}
          aria-label={variable.label}
          title={`${variable.label}: de ${formatNumber(variable.range[0] / variable.scale, 2)} a ${formatNumber(variable.range[1] / variable.scale, 2)} ${variable.unit}`}
          onclick={() => toggle(variable.id)}
        >
          {#if on}<Check size={12} aria-hidden="true" />{/if}
          <Sym symbol={variable.symbol} />
          <span>{variable.label}</span>
        </button>
      {/each}
    </div>
    <label class="annex">
      <input type="checkbox" bind:checked={annexRanges} />
      <span>Respetar los rangos del anexo (Tabla 2)</span>
    </label>
  </section>

  <section class="group" aria-label="Búsqueda">
    {#if job.status === "running"}
      {@const progress = job.progress}
      <p class="status" role="status">
        {progress ? PHASES[progress.phase] : "Preparando"} · simulación {progress?.tested ?? 0} de {OPTIMIZATION_BUDGET}
        {#if progress?.best !== null && progress?.best !== undefined} · mejor: {shown(progress.best)}{/if}
      </p>
      <Meter label="Simulaciones de la optimización" value={progress?.tested ?? 0} min={0} max={OPTIMIZATION_BUDGET} tone="ok" />
      <div class="actions">
        <Button variant="secondary" onclick={() => job.stop()}><Square size={13} /> Detener</Button>
      </div>
    {:else}
      <div class="actions">
        <Button variant="primary" onclick={search} disabled={chosen.length === 0} aria-label="Buscar una mejora"><Sparkles size={15} /> Buscar una mejora</Button>
      </div>
      {#if chosen.length === 0}<p class="note">Elegí al menos un valor para cambiar.</p>{/if}
      {#if applied && !outcome}<p class="note" role="status">Aplicado. Ctrl+Z lo deshace.</p>{/if}
    {/if}

    {#if job.status === "error"}<p class="warning" role="alert">{job.error}</p>{/if}
  </section>

  {#if outcome}
    <section class="group result" aria-label="Resultado de la optimización">
      {#if !outcome.ok}
        <p class="warning" role="status">{outcome.reason}</p>
      {:else}
        <h3>Resultado</h3>
        {#if outcome.corrected}
          <p class="note">
            {outcome.startReason === "margin" ? "El diseño aprobaba sin el margen de 0,02 g que exigen las correcciones" : "El diseño no aprobaba"}:
            primero se corrigió ({shown(outcome.start)}){outcome.improved ? " y después se mejoró" : "; con esos valores no se encontró una mejora mayor"}.
          </p>
        {/if}
        <dl>
          <dt>{OBJECTIVES[objective].label}</dt>
          <dd class="strong">
            {shown(outcome.corrected ? outcome.start : outcome.before)} → {shown(outcome.after)}
            {#if outcome.improved && outcome.improvement !== undefined}<small>({formatNumber(Math.abs(outcome.improvement) * 100, 1)} % mejor)</small>{/if}
          </dd>
          {#each outcome.changes ?? [] as change (`${change.key}${change.element ?? ""}`)}
            <dt>{change.label}</dt>
            <dd>{changeValue(change.before, change.unit)} → {changeValue(change.after, change.unit)}</dd>
          {/each}
        </dl>
        {#if outcome.reason}<p class="note">{outcome.reason}</p>{/if}
        {#if outcome.limiting}
          <p class="limit"><strong>Qué limita la mejora:</strong> {outcome.limiting.text}.</p>
        {/if}
        <p class="note">Verificado con la simulación completa (dt 0,01 s) · {outcome.tested} simulaciones.</p>
        {#if outcome.applicable}
          <div class="actions">
            <Button variant="primary" onclick={apply}><Check size={15} /> Aplicar</Button>
            <Button variant="ghost" onclick={discard}><X size={14} /> Descartar</Button>
          </div>
        {/if}
      {/if}
    </section>
  {/if}
{/if}

<style>
  .group {
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--border);
  }

  .group:last-child {
    border-bottom: 0;
  }

  h3 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-12);
    font-weight: var(--weight-bold);
    color: var(--primary-strong);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: var(--control-sm);
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-pill);
    background: var(--surface);
    color: var(--text-soft);
    font: inherit;
    font-size: var(--text-12);
    cursor: pointer;
  }

  .chip.on {
    border-color: var(--primary);
    background: var(--primary-soft);
    color: var(--primary-strong);
    font-weight: var(--weight-bold);
  }

  .chip:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .annex {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-3);
    font-size: var(--text-12);
    color: var(--text-soft);
  }

  .annex input {
    width: 16px;
    height: 16px;
    accent-color: var(--primary);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .status {
    margin: 0 0 var(--space-2);
    font-size: var(--text-12);
    color: var(--text-soft);
    font-variant-numeric: tabular-nums;
  }

  dl {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px var(--space-3);
    margin: 0;
    font-size: var(--text-12);
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: var(--weight-bold);
    color: var(--text);
  }

  dd.strong {
    color: var(--primary-strong);
  }

  dd small {
    display: block;
    font-weight: var(--weight-regular);
    color: var(--success-text);
  }

  .limit {
    margin: var(--space-3) 0 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-soft);
    font-size: var(--text-12);
    line-height: 1.45;
    color: var(--text-soft);
  }

  .warning {
    margin: var(--space-2) 0 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--accent-soft);
    color: var(--warn-text);
    font-size: var(--text-12);
    line-height: 1.45;
  }

  .note {
    margin: var(--space-2) 0 0;
    font-size: var(--text-12);
    line-height: 1.45;
    color: var(--muted);
  }
</style>
