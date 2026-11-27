<script lang="ts">
  import { CheckCircle2, XCircle, LoaderCircle, FileText, Download, Printer, AlertTriangle, Play, Sparkles } from "lucide-svelte";
  import type { AuditResult, AuditStatus } from "../../lib/live-audit.svelte";
  import CheckMark from "../ui/CheckMark.svelte";
  import Disclosure from "../ui/Disclosure.svelte";
  import Meter from "../ui/Meter.svelte";
  import Button from "../ui/Button.svelte";
  import type { SimulationConfig } from "../../lib/types";
  import { formatNumber, formatSeconds, formatSigned, formatSpeed } from "../../ui/format";
  import ActionMenu from "../ui/ActionMenu.svelte";
  import { designCheckText } from "../../lib/design-checks-text";
  import { brakingCard as brakingCardFor } from "../../lib/braking-card";

  let {
    result,
    status,
    onShowIssue,
    onOpenReport,
    onExportCsv,
    onExportJson,
    onWatch,
    onOptimize
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
    /** Abre el optimizador (objetivo, valores que se pueden cambiar, resultado verificado). */
    onOptimize: () => void;
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

  let brakingCard = $derived(report && result ? brakingCardFor(report.braking, result.final.status) : null);

  /** Descargas del dictamen: una sola entrada en lugar de tres botones. */
  const downloads = [
    { id: "csv", label: "Datos de cada instante (CSV)", icon: Download, onSelect: () => onExportCsv() },
    { id: "json", label: "Dictamen (JSON)", icon: Download, onSelect: () => onExportJson() },
    { id: "print", label: "Imprimir o guardar PDF", icon: Printer, onSelect: () => void printReport() }
  ];

  /** Tono del medidor según el del dato (fuera del límite = «over»). */
  function meterTone(tone: string): "ok" | "warn" | "over" {
    return tone === "bad" ? "over" : tone === "warn" ? "warn" : "ok";
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
        <Meter
          label="Fuerza g máxima respecto del límite"
          value={report.maxG.value}
          min={0}
          max={report.maxG.limit}
          tone={meterTone(report.maxG.tone)}
          valueText={`${formatNumber(report.maxG.value, 2)} g de ${formatNumber(report.maxG.limit, 1)} g`}
        />
        <small>límite {formatNumber(report.maxG.limit, 1)} g · en {report.maxG.section}</small>
      </li>
      <li class={report.minG.tone}>
        <span>Fuerza g mínima</span>
        <strong>{formatNumber(report.minG.value, 2)} g</strong>
        <small>
          {config.contactModel === "strict" ? "límite > 0 g (siempre apoyado)" : `límite ${formatSigned(report.minG.limit, 1)} g`}
          · en {report.minG.section}
        </small>
      </li>
      <li>
        <span>Rapidez máxima</span>
        <strong>{formatSpeed(report.maxSpeed.value).main}</strong>
        <small>{formatSpeed(report.maxSpeed.value).secondary} · en {report.maxSpeed.section}</small>
      </li>
      {#if brakingCard}
        <li class={brakingCard.tone}>
          <span>Distancia de frenado</span>
          <strong>{brakingCard.value}</strong>
          {#if report.braking.outcome !== "not-reached"}
            <Meter
              label="Zona de frenado usada"
              value={Math.min(1, brakingCard.fill)}
              min={0}
              max={1}
              tone={meterTone(brakingCard.tone)}
              valueText={`${formatNumber(100 * Math.min(1, brakingCard.fill), 0)} % de la zona`}
            />
          {/if}
          <small>{brakingCard.note}</small>
        </li>
      {/if}
    </ul>

    {#if report.issues.length}
      <ul class="issues" aria-label="Incumplimientos">
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
    {/if}

    <div class="tools">
      <Button variant="secondary" onclick={onWatch}><Play size={14} /> Reproducir desde A</Button>
      <Button variant="secondary" onclick={onOptimize} aria-label="Optimizar el diseño"><Sparkles size={14} /> Optimizar</Button>
    </div>

    <div class="checks">
      <Disclosure summary={`Condiciones de energía sin fricción · ${checks.filter(check => check.ok).length} de ${checks.length}`}>
      <ul>
        {#each checks as check}
          {@const text = designCheckText(check)}
          <li class:fail={!check.ok} class:warn={!check.ok && check.severity === "warning"}>
            <strong><CheckMark ok={check.ok} severity={check.severity} size={14} /> {text.name}</strong>
            <span><code>{check.formula}</code> · {text.detail}</span>
          </li>
        {/each}
      </ul>
      </Disclosure>
    </div>

    <div class="exports">
      <Button variant="primary" onclick={onOpenReport}><FileText size={15} /> Ver informe de certificación</Button>
      <ActionMenu label="Descargar" icon={Download} items={downloads} />
    </div>
  {:else}
    <div class="badge idle">
      <LoaderCircle size={26} class="spin" />
      <div>
        <strong>{status === "error" ? "SIN DICTAMEN" : "AUDITANDO"}</strong>
        <span>{status === "error" ? "No se pudo simular este diseño. Revisá los valores marcados en rojo." : "Simulando el recorrido completo para emitir el dictamen…"}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .verdict {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
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
    color: var(--success-text);
  }

  .badge.bad {
    background: var(--danger-soft);
    color: var(--danger-text);
  }

  .facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
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

  /* Sin mayúsculas forzadas: «g» es la unidad, «G» sería otra cosa. */
  .facts span {
    font-size: var(--text-11);
    font-weight: var(--weight-bold);
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
    border-color: var(--warn-border);
  }

  .facts li.warn strong {
    color: var(--warn-text);
  }

  .facts li.bad {
    border-color: var(--danger-border);
    background: var(--danger-soft);
  }

  .facts li.bad strong {
    color: var(--danger);
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
    color: var(--danger-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .issue:hover {
    border-color: var(--danger-border);
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
    color: var(--danger-text);
    font-variant-numeric: tabular-nums;
  }


  .watch:hover {
    background: var(--primary-soft);
  }

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
    color: var(--danger-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .issue:hover {
    border-color: var(--danger-border);
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
    color: var(--danger-text);
    font-variant-numeric: tabular-nums;
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
    border: 1px solid var(--warn-border);
    border-radius: 10px;
    background: var(--accent-soft);
    color: var(--warn-text);
    font: inherit;
    font-size: 12.5px;
    font-weight: 800;
    cursor: pointer;
  }

  .fixes:hover {
    border-color: var(--warn-border);
  }

  .checks ul {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .checks li {
    display: grid;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 9px;
    background: var(--success-soft);
    color: var(--success-text);
    font-size: 11px;
  }

  .checks li.fail {
    background: var(--danger-soft);
    color: var(--danger-text);
  }

  .checks li.warn {
    background: var(--accent-soft);
    color: var(--warn-text);
  }

  code {
    font-size: 10.5px;
  }

  /* Una acción por fila: el nombre completo del informe entra aun en el panel angosto. */
  .tools {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .exports {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
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
