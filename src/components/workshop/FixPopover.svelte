<script lang="ts">
  import { untrack } from "svelte";
  import { X, TriangleAlert, LoaderCircle, Eye } from "lucide-svelte";
  import Disclosure from "../ui/Disclosure.svelte";
  import Sym from "../ui/Sym.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import Button from "../ui/Button.svelte";
  import { explainFailure } from "../../physics/index.js";
  import { fixTitle, changeSymbol, changeLabel, changeValues, changeReason, type FixOption } from "../../lib/fix-text";
  import { formatNumber } from "../../ui/format";
  import type { FixSearch } from "../../lib/fix-search.svelte";
  import type { PlainIssue } from "../../lib/audit";
  import type { AuditResult } from "../../lib/live-audit.svelte";
  import type { SimulationConfig } from "../../lib/types";

  interface Props {
    issue: PlainIssue;
    result: AuditResult;
    fixes: FixSearch;
    /** Posición del popover dentro del lienzo (px). */
    left: number;
    top: number;
    maxHeight: number;
    ghost: SimulationConfig | null;
    onPreview: (config: SimulationConfig | null) => void;
    onApply: (config: SimulationConfig) => void;
    onClose: () => void;
  }

  let { issue, result, fixes, left, top, maxHeight, ghost, onPreview, onApply, onClose }: Props = $props();

  let element: HTMLDivElement;

  // Al abrirse recibe el foco: Esc lo cierra y el lector de pantalla lo anuncia.
  $effect(() => {
    element.focus();
  });

  /** Alternativa fijada con «Ver»: se mantiene aunque el cursor salga de la tarjeta. */
  let pinned = $state.raw<FixOption | null>(null);

  let explanation = $derived.by(() => {
    try {
      const violation = result.verdict.violations.find(candidate => candidate.code === issue.code);
      return explainFailure(result.final, result.config, violation).explanation as string;
    } catch {
      return "";
    }
  });

  $effect(() => {
    const config = result.config;
    untrack(() => fixes.start(config));
    return () => fixes.leave();
  });

  function hover(option: FixOption | null) {
    onPreview(option ? option.config : (pinned?.config ?? null));
  }

  function toggle(option: FixOption) {
    pinned = pinned === option ? null : option;
    onPreview(pinned?.config ?? null);
  }

  function keydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose();
  }
</script>

<div
  bind:this={element}
  class="popover"
  style:left={`${left}px`}
  style:top={`${top}px`}
  style:max-height={`${maxHeight}px`}
  role="dialog" aria-label={`Problema: ${issue.title}`} tabindex="-1" onkeydown={keydown}>
  <header>
    <TriangleAlert size={16} />
    <strong>{issue.title}</strong>
    <IconButton label="Cerrar problema" icon={X} size="sm" onclick={onClose} />
  </header>

  <p class="detail">{issue.detail}</p>

  {#if explanation}
    <Disclosure summary="Por qué pasa">
      <p class="why">{explanation}</p>
    </Disclosure>
  {/if}

  <h3>Correcciones verificadas</h3>

  {#if fixes.status === "searching"}
    <p class="progress" role="status">
      <span class="spin"><LoaderCircle size={14} /></span>
      Comprobando {fixes.tested}{fixes.total ? ` de ${fixes.total}` : ""} diseños…
    </p>
  {:else if fixes.status === "error" || (fixes.status === "done" && !fixes.options.length)}
    <p class="empty">{fixes.reason || "No se encontró una corrección que apruebe."}</p>
  {/if}

  {#if fixes.options.length}
    <ul>
      {#each fixes.options as option, index (index)}
        <li
          class:shown={ghost === option.config}
          onpointerenter={() => hover(option)}
          onpointerleave={() => hover(null)}
        >
          <div class="option-head">
            <strong>{fixTitle(option)}</strong>
          </div>
          <ul class="changes">
            {#each option.changes as change (change.key)}
              <li title={changeReason(change)}><Sym symbol={changeSymbol(change)} spoken={changeLabel(change)} />: {changeValues(change)}</li>
            {/each}
          </ul>
          <small>Máx. {formatNumber(option.maxLoad, 2)} g · se detiene a los {formatNumber(option.time, 1)} s</small>
          <div class="actions">
            <Button size="sm" variant="secondary" class="see" aria-pressed={pinned === option} onclick={() => toggle(option)}><Eye size={13} /> Mostrar en la pista</Button>
            <Button size="sm" variant="primary" onclick={() => onApply(option.config)}>Aplicar</Button>
          </div>
        </li>
      {/each}
    </ul>
    <p class="note">La pista corregida se ve punteada en verde. Aplicar se puede deshacer (Ctrl+Z).</p>
  {/if}
</div>

<style>
  .popover {
    position: absolute;
    z-index: 5;
    display: grid;
    gap: 8px;
    width: 340px;
    max-width: calc(100% - 24px);
    padding: 12px 14px 14px;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    color: var(--text);
    box-sizing: border-box;
    pointer-events: auto;
    animation: pop 0.15s ease-out;
  }

  header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--danger-text);
  }

  header strong {
    flex: 1;
    font-size: 14px;
    font-weight: 900;
  }

  .detail,
  .why,
  .progress,
  .empty,
  .note {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--text-soft);
  }

  .why {
    color: var(--muted);
  }

  h3 {
    margin: 4px 0 0;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .spin {
    display: inline-flex;
    animation: spin 1s linear infinite;
  }

  ul {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  ul > li {
    display: grid;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 12px;
    transition: border-color 0.15s, background 0.15s;
  }

  ul > li.shown,
  ul > li:hover {
    border-color: var(--success-border);
    background: var(--success-soft);
  }

  .option-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .option-head strong {
    font-size: 13px;
  }

  .changes {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .changes li {
    padding: 3px 8px;
    border: 0;
    border-radius: 7px;
    background: var(--primary-soft);
    color: var(--primary-strong);
    font-size: 11.5px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  small {
    font-size: 11px;
    color: var(--muted);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }

  /* «Ver» fijado: la pista corregida está a la vista. */
  .actions :global(.see[aria-pressed="true"]) {
    border-color: var(--success);
    color: var(--success-text);
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .popover,
    .spin {
      animation: none;
    }
  }
</style>
