<script lang="ts">
  import { CheckCircle2, XCircle, Hourglass, Clock3, FileText, Download, Printer, Lightbulb, AlertTriangle, ChevronRight } from "lucide-svelte";
  import FailureDialog from "../FailureDialog.svelte";
  import type { SimulationConfig, SimulationState, Verdict } from "../../lib/types";
  import { formatNumber, formatSeconds } from "../../ui/format";

  let {
    verdict,
    running,
    state,
    config,
    onApplyRecommendation,
    onOpenReport,
    onExportCsv,
    onExportJson
  }: {
    verdict: Verdict | null;
    running: boolean;
    state: SimulationState;
    config: SimulationConfig;
    onApplyRecommendation: (config: SimulationConfig) => void;
    onOpenReport: () => void;
    onExportCsv: () => void;
    onExportJson: () => void;
  } = $props();

  let finished = $derived(state.status !== "running");

  let badge = $derived.by(() => {
    if (running) return { text: "EN CURSO", kind: "live", icon: Clock3, hint: "El dictamen se emite cuando el tren se detiene o incumple un criterio." };
    if (!finished) return { text: "SIN DICTAMEN", kind: "idle", icon: Hourglass, hint: "Presioná Certificar para simular el recorrido completo, o Reproducir para verlo." };
    return verdict?.approved
      ? { text: "APROBADO", kind: "ok", icon: CheckCircle2, hint: "El trazado cumple todos los criterios del anexo." }
      : { text: "RECHAZADO", kind: "bad", icon: XCircle, hint: "Se detectó al menos un incumplimiento." };
  });

  let violations = $derived(verdict?.violations ?? []);
  let checks = $derived(verdict?.designChecks ?? []);
  let failedChecks = $derived(checks.filter(check => !check.ok));
  let summary = $derived(verdict?.summary ?? null);
</script>

<div class="verdict">
  <div class="badge {badge.kind}">
    <badge.icon size={26} />
    <div>
      <strong>{badge.text}</strong>
      <span>{badge.hint}</span>
    </div>
  </div>

  {#if finished && verdict && summary}
    <ul class="facts">
      <li><span>Carga máxima</span><strong class:bad={summary.maxLoad.value > config.maxLoad}>{formatNumber(summary.maxLoad.value, 2)} g</strong><small>{summary.maxLoad.section}</small></li>
      <li><span>Carga mínima</span><strong class:bad={summary.minLoad.value < (config.contactModel === "strict" ? 0 : config.minLoad)}>{formatNumber(summary.minLoad.value, 2)} g</strong><small>{summary.minLoad.section}</small></li>
      <li><span>Rapidez máxima</span><strong>{formatNumber(summary.maxSpeed.value * 3.6, 0)} km/h</strong><small>{summary.maxSpeed.section}</small></li>
      <li><span>Detención</span><strong>{summary.braking.stoppingDistance === null || summary.braking.stoppingDistance === undefined ? "—" : `${formatNumber(summary.braking.stoppingDistance, 1)} m`}</strong><small>de {formatNumber(config.brakingLength, 0)} m disponibles</small></li>
    </ul>

    {#if violations.length}
      <ul class="violations">
        {#each violations as violation}
          <li>
            <AlertTriangle size={15} />
            <div>
              <strong>{violation.condition}</strong>
              <span>
                {formatNumber(violation.value, 3)} {violation.unit} frente a {violation.comparison} {formatNumber(violation.limit, 3)} {violation.unit}
                · {violation.section} · s = {formatNumber(violation.position, 1)} m · t = {formatSeconds(violation.time)}
              </span>
            </div>
          </li>
        {/each}
      </ul>

      <FailureDialog failedState={state} {config} onApply={onApplyRecommendation} />
    {/if}

    <details class="checks">
      <summary><ChevronRight size={14} class="chev" /> Condiciones de diseño por energía · {checks.filter(check => check.ok).length}/{checks.length} cumplidas</summary>
      <ul>
        {#each checks as check}
          <li class:fail={!check.ok} class:warn={!check.ok && check.severity === "warning"}>
            <strong>{check.ok ? "✔" : check.severity === "error" ? "✘" : "⚠"} {check.name}</strong>
            <span><code>{check.formula}</code> · {check.detail}</span>
          </li>
        {/each}
      </ul>
    </details>

    <div class="exports">
      <button type="button" class="primary" onclick={onOpenReport}><FileText size={15} /> Informe completo</button>
      <button type="button" onclick={onExportCsv} title="Serie temporal (CSV)"><Download size={14} /> CSV</button>
      <button type="button" onclick={onExportJson} title="Configuración y dictamen (JSON)"><Download size={14} /> JSON</button>
      <button type="button" onclick={() => { onOpenReport(); setTimeout(() => window.print(), 300); }} title="Imprimir o guardar como PDF"><Printer size={14} /> PDF</button>
    </div>
  {:else}
    {#if failedChecks.length}
      <ul class="pre-checks">
        {#each failedChecks as check}
          <li class={check.severity}>
            <Lightbulb size={15} />
            <div>
              <strong>{check.name}</strong>
              <span><code>{check.formula}</code> · {check.detail}</span>
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">Criterios evaluados: contacto con la vía, carga en [{config.minLoad}, +{config.maxLoad}] g, recorrido completo y detención dentro de la zona de frenado.</p>
    {/if}
  {/if}
</div>

<style>
  .verdict {
    display: grid;
    gap: 12px;
  }

  .badge {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: 14px;
    background: var(--surface-soft);
    color: var(--muted);
  }

  .badge div {
    display: grid;
    gap: 2px;
  }

  .badge strong {
    font-size: 17px;
    font-weight: 900;
    letter-spacing: 1.5px;
  }

  .badge span {
    font-size: 11.5px;
    line-height: 1.45;
  }

  .badge.ok {
    background: var(--success-soft);
    color: #1f7a57;
  }

  .badge.bad {
    background: var(--danger-soft);
    color: #b7303f;
  }

  .badge.live {
    background: var(--info-soft);
    color: var(--info);
  }

  .facts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .facts li {
    display: grid;
    gap: 1px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--surface-soft);
  }

  .facts span {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .facts strong {
    font-size: 15px;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  .facts strong.bad {
    color: var(--danger);
  }

  .facts small {
    font-size: 10.5px;
    color: var(--faint);
  }

  .violations,
  .pre-checks,
  .checks ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .violations li,
  .pre-checks li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px;
    padding: 10px;
    border-radius: 10px;
    background: var(--danger-soft);
    color: #9d2a39;
  }

  .pre-checks li.warning {
    background: var(--accent-soft);
    color: #8a5a12;
  }

  .violations li div,
  .pre-checks li div {
    display: grid;
    gap: 2px;
  }

  .violations strong,
  .pre-checks strong {
    font-size: 12px;
  }

  .violations span,
  .pre-checks span {
    font-size: 11px;
    line-height: 1.45;
  }

  .checks summary {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 800;
    color: var(--text-soft);
    cursor: pointer;
    list-style: none;
  }

  .checks summary::-webkit-details-marker {
    display: none;
  }

  .checks[open] summary :global(.chev) {
    transform: rotate(90deg);
  }

  .checks ul {
    margin-top: 8px;
  }

  .checks li {
    display: grid;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 9px;
    background: var(--success-soft);
    color: #1f7a57;
    font-size: 11px;
  }

  .checks li.fail {
    background: var(--danger-soft);
    color: #9d2a39;
  }

  .checks li.warn {
    background: var(--accent-soft);
    color: #8a5a12;
  }

  code {
    font-size: 10.5px;
  }

  .exports {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    gap: 6px;
  }

  .exports button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 38px;
    padding: 0 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text-soft);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .exports .primary {
    border-color: var(--primary);
    background: var(--primary);
    color: white;
  }

  .muted {
    margin: 0;
    font-size: 12px;
    line-height: 1.55;
    color: var(--muted);
  }
</style>
