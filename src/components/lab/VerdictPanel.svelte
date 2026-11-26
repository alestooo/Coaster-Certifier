<script lang="ts">
  import { CheckCircle2, XCircle, LoaderCircle, FileText, Download, Printer, AlertTriangle, ChevronRight, Play, Wrench } from "lucide-svelte";
  import type { AuditResult, AuditStatus } from "../../lib/live-audit.svelte";
  import type { SimulationConfig } from "../../lib/types";
  import { formatNumber, formatSeconds, kmh } from "../../ui/format";

  let {
    result,
    status,
    onShowIssue,
    onOpenReport,
    onExportCsv,
    onExportJson,
    onWatch
  }: {
    result: AuditResult | null;
    status: AuditStatus;
    /** Muestra el problema sobre la pista, con sus correcciones verificadas. */
    onShowIssue: (index: number) => void;
    /** Abre el informe (puede tener que descargarse); la promesa dice si quedó abierto. */
    onOpenReport: () => Promise<boolean>;
    onExportCsv: () => void;
    onExportJson: () => void;
    onWatch: () => void;
  } = $props();

  /** Duración de la espera antes de abrir el diálogo de impresión (ms). */
  const PRINT_DELAY_MS = 300;

  /** Imprime el informe recién cuando está abierto; si no se pudo abrir, no imprime una página vacía. */
  async function printReport() {
    if (await onOpenReport()) setTimeout(() => window.print(), PRINT_DELAY_MS);
  }

  let report = $derived(result?.report ?? null);
  let config = $derived(result?.config ?? null);
  let checks = $derived(result?.verdict.designChecks ?? []);

  let brakingCard = $derived.by(() => {
    if (!report) return null;
    const braking = report.braking;

    switch (braking.outcome) {
      case "stopped":
        return {
          value: `${formatNumber(braking.stoppingDistance, 1)} m`,
          note: `de ${formatNumber(braking.available, 0)} m disponibles`,
          fill: (braking.stoppingDistance ?? 0) / braking.available,
          tone: braking.tone
        };
      case "overrun":
        return {
          value: "Se pasa",
          note:
            braking.requiredDistance === null
              ? "el resorte no alcanza a detenerlo"
              : `necesita ${formatNumber(braking.requiredDistance, 0)} m de ${formatNumber(braking.available, 0)} m`,
          fill: 1,
          tone: "bad"
        };
      case "no-stop":
        return { value: "No se detiene", note: "rebota sin quedar quieto", fill: 1, tone: "bad" };
      default:
        return { value: "No llega", note: "el tren no alcanza la zona de frenado", fill: 0, tone: "info" };
    }
  });

  function fraction(value: number, limit: number) {
    return Math.max(0, Math.min(1, limit > 0 ? value / limit : 0));
  }
</script>

<div class="verdict">
  {#if report && config}
    {#key report.approved}
      <div class="badge {report.approved ? 'ok' : 'bad'}">
        {#if report.approved}<CheckCircle2 size={28} />{:else}<XCircle size={28} />{/if}
        <div>
          <strong>{report.approved ? "APROBADO" : "RECHAZADO"}</strong>
          <span>{report.headline}</span>
        </div>
      </div>
    {/key}

    <ul class="facts">
      <li class={report.maxG.tone}>
        <span>Fuerza g máxima</span>
        <strong>{formatNumber(report.maxG.value, 2)} g</strong>
        <i class="meter"><b style:width={`${100 * fraction(report.maxG.value, report.maxG.limit)}%`}></b></i>
        <small>límite {formatNumber(report.maxG.limit, 1)} g · en {report.maxG.section}</small>
      </li>
      <li class={report.minG.tone}>
        <span>Fuerza g mínima</span>
        <strong>{formatNumber(report.minG.value, 2)} g</strong>
        <small>
          {config.contactModel === "strict" ? "debe ser mayor que 0 g (siempre apoyado)" : `no puede bajar de ${formatNumber(report.minG.limit, 1)} g`}
          · en {report.minG.section}
        </small>
      </li>
      <li>
        <span>Rapidez máxima</span>
        <strong>{formatNumber(kmh(report.maxSpeed.value), 0)} km/h</strong>
        <small>{formatNumber(report.maxSpeed.value, 1)} m/s · en {report.maxSpeed.section}</small>
      </li>
      {#if brakingCard}
        <li class={brakingCard.tone}>
          <span>Distancia de frenado</span>
          <strong>{brakingCard.value}</strong>
          {#if report.braking.outcome !== "not-reached"}
            <i class="meter"><b style:width={`${100 * Math.min(1, brakingCard.fill)}%`}></b></i>
          {/if}
          <small>{brakingCard.note}</small>
        </li>
      {/if}
    </ul>

    {#if report.issues.length}
      <ul class="issues">
        {#each report.issues as issue, index}
          {@const violation = result?.verdict.violations[index]}
          <li>
            <button type="button" class="issue" onclick={() => onShowIssue(index)} title="Ver en la pista y cómo corregirlo">
              <AlertTriangle size={15} />
              <span class="issue-text">
                <strong>{issue.title}</strong>
                <span>{issue.detail}</span>
                {#if violation}
                  <small>{violation.condition} · t = {formatSeconds(violation.time)} · s = {formatNumber(violation.position, 1)} m</small>
                {/if}
              </span>
            </button>
          </li>
        {/each}
      </ul>

      <button type="button" class="fixes" onclick={() => onShowIssue(0)}>
        <Wrench size={15} /> Ver dónde falla y cómo corregirlo
      </button>
    {/if}

    <button type="button" class="watch" onclick={onWatch}><Play size={14} /> Ver el recorrido desde el inicio</button>

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
      <button type="button" onclick={onExportCsv} title="Serie temporal del recorrido completo (CSV)"><Download size={14} /> CSV</button>
      <button type="button" onclick={onExportJson} title="Configuración y dictamen (JSON)"><Download size={14} /> JSON</button>
      <button type="button" onclick={printReport} title="Imprimir o guardar como PDF"><Printer size={14} /> PDF</button>
    </div>
  {:else}
    <div class="badge idle">
      <LoaderCircle size={26} class="spin" />
      <div>
        <strong>{status === "error" ? "SIN DICTAMEN" : "AUDITANDO"}</strong>
        <span>{status === "error" ? "No se pudo simular este diseño. Revisá los valores del panel Diseño." : "Simulando el recorrido completo para emitir el dictamen…"}</span>
      </div>
    </div>
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
    animation: badge-in 0.35s ease-out;
  }

  .badge div {
    display: grid;
    gap: 3px;
  }

  .badge strong {
    font-size: 17px;
    font-weight: 900;
    letter-spacing: 1.5px;
  }

  .badge span {
    font-size: 11.5px;
    line-height: 1.5;
  }

  .badge.ok {
    background: var(--success-soft);
    color: #1f7a57;
  }

  .badge.bad {
    background: var(--danger-soft);
    color: #b7303f;
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
    align-content: start;
    gap: 3px;
    padding: 9px 10px;
    border: 1px solid transparent;
    border-radius: 11px;
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
    font-size: 16px;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  .facts small {
    font-size: 10.5px;
    line-height: 1.4;
    color: var(--muted);
  }

  .facts li.warn {
    border-color: #f3d9a6;
  }

  .facts li.warn strong {
    color: #8a5a12;
  }

  .facts li.bad {
    border-color: #f5c3cb;
    background: var(--danger-soft);
  }

  .facts li.bad strong {
    color: var(--danger);
  }

  .meter {
    display: block;
    height: 5px;
    border-radius: 999px;
    background: var(--surface-muted);
    overflow: hidden;
  }

  .meter b {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--success);
    transition: width 0.35s ease-out;
  }

  .warn .meter b {
    background: var(--accent);
  }

  .bad .meter b {
    background: var(--danger);
  }

  .issues,
  .checks ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .issues li {
    display: block;
  }

  .issue {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px;
    width: 100%;
    padding: 10px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: var(--danger-soft);
    color: #9d2a39;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .issue:hover {
    border-color: #f5c3cc;
  }

  .issue-text {
    display: grid;
    gap: 3px;
  }

  .issues strong {
    font-size: 12.5px;
  }

  .issues span {
    font-size: 11.5px;
    line-height: 1.45;
  }

  .issues small {
    font-size: 10px;
    color: #b45d69;
    font-variant-numeric: tabular-nums;
  }

  .watch {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 38px;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    background: var(--surface);
    color: var(--primary-strong);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .watch:hover {
    background: var(--primary-soft);
  }

  .fixes {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 40px;
    border: 1px solid #efd29a;
    border-radius: 10px;
    background: var(--accent-soft);
    color: #8a5a12;
    font: inherit;
    font-size: 12.5px;
    font-weight: 800;
    cursor: pointer;
  }

  .fixes:hover {
    border-color: #e3b860;
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

  @keyframes badge-in {
    from {
      opacity: 0;
      transform: scale(0.98);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .badge {
      animation: none;
    }
  }
</style>
