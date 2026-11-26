<script lang="ts">
  import { untrack } from "svelte";
  import { X, TriangleAlert, LoaderCircle, Eye, Check } from "lucide-svelte";
  import { explainFailure } from "../../physics/index.js";
  import { fixTitle, changeText, changeReason, type FixOption } from "../../lib/fix-text";
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
      return explainFailure(result.final, result.config).explanation as string;
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
    <button type="button" class="close" aria-label="Cerrar" onclick={onClose}><X size={15} /></button>
  </header>

  <p class="detail">{issue.detail}</p>

  {#if explanation}
    <details>
      <summary>Por qué pasa</summary>
      <p>{explanation}</p>
    </details>
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
            <span class="ok"><Check size={12} /> aprueba</span>
          </div>
          <ul class="changes">
            {#each option.changes as change (change.key)}
              <li title={changeReason(change)}>{changeText(change)}</li>
            {/each}
          </ul>
          <small>Fuerza g máx. {formatNumber(option.maxLoad, 2)} g · se detiene a los {formatNumber(option.time, 1)} s</small>
          <div class="actions">
            <button type="button" class="see" aria-pressed={pinned === option} onclick={() => toggle(option)}>
              <Eye size={13} /> Ver
            </button>
            <button type="button" class="apply" onclick={() => onApply(option.config)}>Aplicar</button>
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
    color: #b7303f;
  }

  header strong {
    flex: 1;
    font-size: 14px;
    font-weight: 900;
  }

  .close {
    display: inline-flex;
    padding: 4px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .detail,
  details p,
  .progress,
  .empty,
  .note {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--text-soft);
  }

  details summary {
    font-size: 12px;
    font-weight: 800;
    color: var(--primary-strong);
    cursor: pointer;
  }

  details p {
    margin-top: 4px;
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
    border-color: #9fd8c0;
    background: #f3fbf7;
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

  .ok {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--success-soft);
    color: #1f7a57;
    font-size: 10.5px;
    font-weight: 800;
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

  .actions button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 12px;
    border-radius: 8px;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .see {
    border: 1px solid var(--border-strong);
    background: var(--surface);
    color: var(--text-soft);
  }

  .see[aria-pressed="true"] {
    border-color: #1f8a64;
    color: #1f7a57;
  }

  .apply {
    border: 0;
    background: var(--primary);
    color: white;
  }

  .apply:hover {
    background: var(--primary-strong);
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
