<script lang="ts">
  import { RollerCoaster, Users, Undo2, Redo2, SlidersHorizontal, BookOpen, ShieldCheck, ShieldAlert, LoaderCircle, TriangleAlert } from "lucide-svelte";
  import TemplatePicker from "./TemplatePicker.svelte";
  import type { AuditReport } from "../../lib/audit";
  import type { AuditStatus } from "../../lib/live-audit.svelte";
  import type { MapId } from "../../game/maps";
  import type { ScenarioId } from "../../game/scenarios";
  import type { PanelMode } from "./panel";

  interface Props {
    mapId: MapId;
    passengerSummary: string;
    canUndo: boolean;
    canRedo: boolean;
    report: AuditReport | null;
    status: AuditStatus;
    invalid: boolean;
    panel: PanelMode | null;
    onHome: () => void;
    onTemplate: (mapId: MapId) => void;
    onScenario: (id: ScenarioId) => void;
    onPanel: (mode: Exclude<PanelMode, "selection">) => void;
    onGuide: () => void;
    onUndo: () => void;
    onRedo: () => void;
  }

  let { mapId, passengerSummary, canUndo, canRedo, report, status, invalid, panel, onHome, onTemplate, onScenario, onPanel, onGuide, onUndo, onRedo }: Props = $props();

  let verdict = $derived.by(() => {
    if (invalid) return { kind: "warn", icon: TriangleAlert, short: "Valor inválido", text: "Valor fuera de rango: el dictamen es del último diseño válido" };
    if (status === "error") return { kind: "warn", icon: TriangleAlert, short: "Sin dictamen", text: "No se pudo auditar el diseño" };
    if (!report || status === "working") return { kind: "idle", icon: LoaderCircle, short: "Auditando…", text: "Auditando…" };
    return report.approved
      ? { kind: "ok", icon: ShieldCheck, short: "Aprobado", text: "Aprobado" }
      : { kind: "bad", icon: ShieldAlert, short: "Rechazado", text: report.title };
  });
</script>

<header class="bar">
  <button type="button" class="home" aria-label="Volver al menú" title="Volver al menú" onclick={onHome}>
    <RollerCoaster size={20} />
  </button>

  <TemplatePicker {mapId} {onTemplate} {onScenario} {onGuide} />

  <button
    type="button"
    class="chip"
    class:active={panel === "passengers"}
    aria-pressed={panel === "passengers"}
    aria-label={`Tren y pasajeros: ${passengerSummary.replace(" · ", ", ")} en total`}
    title="Tren y pasajeros"
    onclick={() => onPanel("passengers")}
  >
    <Users size={15} /> <span>{passengerSummary}</span>
  </button>

  <span class="spacer"></span>

  <div class="group" role="group" aria-label="Historial">
    <button type="button" class="icon" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={!canUndo} onclick={onUndo}><Undo2 size={16} /></button>
    <button type="button" class="icon" aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)" disabled={!canRedo} onclick={onRedo}><Redo2 size={16} /></button>
  </div>

  <button type="button" class="icon labelled" class:active={panel === "rules"} aria-pressed={panel === "rules"} title="Reglas de certificación y precisión" onclick={() => onPanel("rules")}>
    <SlidersHorizontal size={16} /> <span>Reglas</span>
  </button>

  <button type="button" class="icon guide" aria-label="Guía" title="Guía: escenarios, criterios y modelo" onclick={onGuide}><BookOpen size={16} /></button>

  <button
    type="button"
    class="verdict {verdict.kind}"
    class:active={panel === "verdict"}
    aria-pressed={panel === "verdict"}
    title="Ver el dictamen"
    onclick={() => onPanel("verdict")}
  >
    <span class="verdict-icon" class:spin={verdict.kind === "idle"}><verdict.icon size={16} /></span>
    <span class="verdict-text" role="status" aria-live="polite">
      <span class="long">{verdict.text}</span><span class="short">{verdict.short}</span>
    </span>
  </button>
</header>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 52px;
    padding: 0 10px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    box-sizing: border-box;
    min-width: 0;
  }

  .spacer {
    flex: 1;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 36px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: var(--text-soft);
    font: inherit;
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  button:hover:not(:disabled) {
    background: var(--surface-soft);
  }

  button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  button.active {
    border-color: var(--border-strong);
    background: var(--primary-soft);
    color: var(--primary-strong);
  }

  .home {
    justify-content: center;
    width: 36px;
    color: var(--primary);
  }

  .chip {
    padding: 0 10px;
    border-color: var(--border);
  }

  .icon {
    justify-content: center;
    min-width: 36px;
    padding: 0 8px;
  }

  .group {
    display: flex;
    gap: 2px;
  }

  .verdict {
    max-width: min(420px, 38vw);
    padding: 0 12px;
    border-radius: 999px;
    border-color: var(--border);
    background: var(--surface-soft);
  }

  .verdict-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .verdict .short {
    display: none;
  }

  .verdict.ok {
    border-color: var(--success-border);
    background: var(--success-soft);
    color: var(--success-text);
  }

  .verdict.bad {
    border-color: var(--danger-border);
    background: var(--danger-soft);
    color: var(--danger-text);
  }

  .verdict.warn {
    border-color: var(--warn-border);
    background: var(--accent-soft);
    color: var(--warn-text);
  }

  .verdict.active {
    box-shadow: 0 0 0 2px var(--primary-soft), 0 0 0 3px var(--border-strong);
  }

  .verdict-icon {
    display: inline-flex;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spin {
      animation: none;
    }
  }

  @media (max-width: 860px) {
    .labelled span,
    .chip span {
      display: none;
    }

    .verdict .long {
      display: none;
    }

    .verdict .short {
      display: inline;
    }
  }

  @media (max-width: 520px) {
    .bar {
      gap: 2px;
      padding: 0 6px;
    }

    .bar > :global(.trigger) {
      flex: 1;
      font-size: 13.5px;
    }

    .spacer,
    .guide,
    .group .icon:last-child {
      display: none;
    }
  }
</style>
