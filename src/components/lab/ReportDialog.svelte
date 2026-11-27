<script lang="ts">
  import type { SimulationConfig, SimulationState, Verdict } from "../../lib/types";
  import type { Passenger } from "../../game/passengers";
  import { visibleFields } from "../../lib/field-definitions";
  import { formatNumber, formatScientific, formatSeconds, kmh } from "../../ui/format";
  import { resultLines, elementRows, liftText, energyRows } from "../../lib/report-text";
  import { Printer } from "lucide-svelte";
  import { designCheckText } from "../../lib/design-checks-text";
  import Dialog from "../ui/Dialog.svelte";
  import Button from "../ui/Button.svelte";
  import CheckMark from "../ui/CheckMark.svelte";
  import Sym from "../ui/Sym.svelte";

  let {
    verdict,
    config,
    history,
    passengers,
    mapName
  }: {
    verdict: Verdict | null;
    config: SimulationConfig;
    history: SimulationState[];
    passengers: Passenger[];
    mapName: string;
  } = $props();

  let dialog: ReturnType<typeof Dialog>;

  export function open() {
    dialog.showModal();
  }

  let generatedAt = $state(new Date());

  let parameterRows = $derived(
    visibleFields(config).map(field => ({
      symbol: field.symbol,
      label: field.label,
      value: `${formatNumber(config[field.key], field.step < 0.01 ? 4 : 2)} ${field.unit}`.trim()
    }))
  );

  let elements = $derived(elementRows(config));
  let summary = $derived(verdict?.summary ?? null);

  function print() {
    generatedAt = new Date();
    window.print();
  }
</script>

<Dialog bind:this={dialog} class="report-dialog" title={`Informe de certificación · ${mapName}`} wide>
  {#snippet actions()}
    <Button size="sm" variant="secondary" onclick={print}><Printer size={14} /> Imprimir o guardar PDF</Button>
  {/snippet}

  {#if verdict && summary}
    <article class="report-sheet">
      <header class="sheet-head">
        <div>
          <!-- En pantalla el título lo pone el diálogo; en papel, este. -->
          <h1 class="print-only">Informe de certificación · {mapName}</h1>
          <p>
            Coaster-Certifier · {passengers.length} {passengers.length === 1 ? "pasajero" : "pasajeros"} ·
            masa total {formatNumber(config.mass, 1)} kg · generado el {generatedAt.toLocaleString("es-CR")}
          </p>
        </div>
        <span class="sheet-verdict" class:ok={verdict.approved} class:bad={!verdict.approved}>
          {verdict.approved ? "APROBADO" : "RECHAZADO"}
        </span>
      </header>

      <section>
        <h2>1. Resultado</h2>
        <ul>
          {#each resultLines(verdict, history.at(-1)?.distance ?? 0, config) as line}
            <li>{line}</li>
          {/each}
        </ul>

        {#if verdict.violations.length}
          <div class="table-scroll">
          <table>
            <thead>
              <tr><th>Condición evaluada</th><th>Instante</th><th>Tramo</th><th>Posición s</th><th>Valor</th><th>Límite</th></tr>
            </thead>
            <tbody>
              {#each verdict.violations as violation}
                <tr>
                  <td>{violation.condition}</td>
                  <td>{formatSeconds(violation.time)}</td>
                  <td>{violation.section}</td>
                  <td class="num">{formatNumber(violation.position)} m</td>
                  <td class="num">{formatNumber(violation.value, 3)} {violation.unit}</td>
                  <td class="num">{violation.comparison} {formatNumber(violation.limit, 3)} {violation.unit}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {/if}
      </section>

      <section>
        <h2>2. Puntos críticos</h2>
        <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Punto</th><th>Descripción</th><th>s (m)</th><th>t (s)</th><th>v (m/s)</th><th>v (km/h)</th><th>n (g)</th><th>N (N)</th><th>y (m)</th></tr>
          </thead>
          <tbody>
            {#each summary.criticalPoints as point}
              <tr>
                <td><strong>{point.label}</strong></td>
                <td>{point.name}</td>
                <td class="num">{formatNumber(point.distance)}</td>
                {#if point.reached}
                  <td class="num">{formatNumber(point.time, 3)}</td>
                  <td class="num">{formatNumber(point.speed)}</td>
                  <td class="num">{formatNumber(kmh(point.speed ?? 0), 0)}</td>
                  <td class="num">{formatNumber(point.load)}</td>
                  <td class="num">{formatNumber(point.normal, 0)}</td>
                  <td class="num">{formatNumber(point.height)}</td>
                {:else}
                  <td colspan="6" class="muted">{point.role === "end" ? "No alcanzado (el tren se detuvo antes)" : "No alcanzado"}</td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
        </div>
      </section>

      <section>
        <h2>3. Extremos del recorrido</h2>
        <div class="table-scroll">
        <table>
          <tbody>
            <tr><th>Rapidez máxima</th><td class="num">{formatNumber(summary.maxSpeed.value)} m/s ({formatNumber(kmh(summary.maxSpeed.value), 0)} km/h)</td><td>{summary.maxSpeed.section} · t = {formatNumber(summary.maxSpeed.time)} s</td></tr>
            <tr><th>Fuerza g máxima</th><td class="num">{formatNumber(summary.maxLoad.value)} g</td><td>{summary.maxLoad.section} · s = {formatNumber(summary.maxLoad.distance)} m</td></tr>
            <tr><th>Fuerza g mínima</th><td class="num">{formatNumber(summary.minLoad.value)} g</td><td>{summary.minLoad.section} · s = {formatNumber(summary.minLoad.distance)} m</td></tr>
            <tr><th>Fuerza normal mínima</th><td class="num">{formatNumber(summary.minNormal.value, 0)} N</td><td>{summary.minNormal.section}</td></tr>
            <tr><th>Fuerza normal máxima</th><td class="num">{formatNumber(summary.maxNormal.value, 0)} N</td><td>{summary.maxNormal.section}</td></tr>
            <tr><th>Aceleración tangencial máxima</th><td class="num">{formatNumber(summary.maxTangentialAcceleration.value)} m/s²</td><td>{summary.maxTangentialAcceleration.section}</td></tr>
            <tr><th>Aceleración normal máxima</th><td class="num">{formatNumber(summary.maxNormalAcceleration.value)} m/s²</td><td>{summary.maxNormalAcceleration.section}</td></tr>
            {#each energyRows(summary, config.trainCars) as row (row.label)}
              <tr><th>{row.label}</th><td class="num">{row.value}</td><td>{row.detail}</td></tr>
            {/each}
            <tr><th>Error máximo de balance</th><td class="num">{formatScientific(summary.maxBalanceError.value, 2)} J</td><td>{formatScientific((100 * summary.maxBalanceError.value) / (summary.initialEnergy + Math.max(0, summary.inputEnergy ?? 0) + (summary.chainEnergy ?? 0)), 2)} % de la energía disponible</td></tr>
            <tr><th>Duración</th><td class="num">{formatSeconds(summary.duration)}</td><td>{formatNumber(summary.samples, 0)} muestras</td></tr>
          </tbody>
        </table>
        </div>
      </section>

      {#if summary.braking.reached}
        <section>
          <h2>4. Frenado (de E a F)</h2>
          <div class="table-scroll">
          <table>
            <tbody>
              <tr><th>Rapidez de entrada <Sym symbol="v_E" /></th><td class="num">{formatNumber(summary.braking.entrySpeed)} m/s</td></tr>
              <tr><th>Distancia de detención</th><td class="num">{summary.braking.stoppingDistance === null ? "no se detuvo dentro de la zona" : `${formatNumber(summary.braking.stoppingDistance)} m de ${formatNumber(config.brakingLength)} m`}</td></tr>
              <tr><th>Tiempo de frenado</th><td class="num">{summary.braking.stoppingTime === null ? "—" : formatSeconds(summary.braking.stoppingTime)}</td></tr>
              <tr><th>Margen restante</th><td class="num">{summary.braking.remainingLength === null ? "—" : `${formatNumber(summary.braking.remainingLength)} m`}</td></tr>
              <tr><th>Fuerza de frenado</th><td class="num">{formatNumber(summary.braking.brakeForce, 0)} N</td></tr>
              <tr><th>Impulso (m·v<sub>E</sub>)</th><td class="num">{formatNumber(summary.braking.impulse, 0)} N·s</td></tr>
              <tr><th>Energía por disipar (½·m·v<sub>E</sub>²)</th><td class="num">{formatNumber(summary.braking.energyToDissipate, 0)} J</td></tr>
              {#if config.brakeMode === "spring"}
                <tr><th>Compresión máxima</th><td class="num">{formatNumber(summary.braking.maxCompression)} m de {formatNumber(config.maxCompression)} m</td></tr>
              {/if}
            </tbody>
          </table>
        </div>
        </section>
      {/if}

      <section>
        <h2>5. Tramos</h2>
        <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Tramo</th><th>Inicio (m)</th><th>Longitud (m)</th><th>v entrada</th><th>v salida</th><th>n máx</th><th>n mín</th><th>N mín</th><th>Duración</th><th>Disipada</th></tr>
          </thead>
          <tbody>
            {#each summary.sections as section}
              <tr>
                <td>{section.name}</td>
                <td class="num">{formatNumber(section.start, 1)}</td>
                <td class="num">{formatNumber(section.length, 1)}</td>
                {#if section.reached}
                  <td class="num">{formatNumber(section.entrySpeed)} m/s</td>
                  <td class="num">{formatNumber(section.exitSpeed)} m/s</td>
                  <td class="num">{formatNumber(section.maxLoad)} g</td>
                  <td class="num">{formatNumber(section.minLoad)} g</td>
                  <td class="num">{formatNumber(section.minNormal, 0)} N</td>
                  <td class="num">{formatNumber(section.duration)} s</td>
                  <td class="num">{formatNumber(section.dissipated, 0)} J</td>
                {:else}
                  <td colspan="7" class="muted">No alcanzado</td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
        </div>
      </section>

      <section>
        <h2>6. Condiciones de energía sin fricción</h2>
        <div class="table-scroll">
        <table>
          <tbody>
            {#each verdict.designChecks as check}
              <tr class={check.ok ? "" : check.severity}>
                <td><CheckMark ok={check.ok} severity={check.severity} /></td>
                <td>{designCheckText(check).name}</td>
                <td><code>{check.formula}</code></td>
                <td>{designCheckText(check).detail}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        </div>
      </section>

      <section>
        <h2>7. Parámetros de la simulación</h2>
        <div class="table-scroll">
        <table class="parameters">
          <tbody>
            <tr><th>Trazado</th><td>{mapName} · {config.track.length} elementos</td><th>Frenado</th><td>{config.brakeMode === "station" ? "frenos en la recta final" : "resorte de tope"}</td></tr>
            <tr><th>Contacto</th><td>{config.contactModel === "strict" ? "siempre apoyado (N > 0)" : "ruedas anti-levantamiento"}</td><th>m</th><td>{formatNumber(config.mass, 1)} kg</td></tr>
            <tr><th><Sym symbol="W" /> · Ancho del trazado (derivado: x del final)</th><td>{formatNumber(config.trackWidth, 1)} m</td><th></th><td></td></tr>
            <tr><th>Subida por cadena</th><td colspan="3">{liftText(config)}</td></tr>
            <tr>
              <th>Tren</th>
              <td colspan="3">
                {config.trainCars > 1
                  ? `${config.trainCars} carros · criterios sobre el peor carro · ${formatNumber(config.carSpacing, 2)} m entre carros`
                  : "1 carro (partícula, como el anexo)"}
              </td>
            </tr>
            {#each Array.from({ length: Math.ceil(parameterRows.length / 2) }, (_, index) => parameterRows.slice(index * 2, index * 2 + 2)) as pair}
              <tr>
                {#each pair as row}
                  <th><Sym symbol={row.symbol} /> · {row.label}</th>
                  <td>{row.value}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
        </div>

        <h3>Elementos del trazado</h3>
        <div class="table-scroll">
        <table class="elements">
          <thead>
            <tr><th>Elemento</th><th>x</th><th>Altura</th><th>Loop o colina</th></tr>
          </thead>
          <tbody>
            {#each elements as row, index (index)}
              <tr><td>{index + 1}. {row.type}</td><td>{row.x}</td><td>{row.height}</td><td>{row.detail || "—"}</td></tr>
            {/each}
          </tbody>
        </table>
        </div>
      </section>

      <footer class="sheet-foot">
        {config.trainCars > 1 ? `Tren articulado de ${config.trainCars} carros` : "Modelo de partícula"} sobre vía rígida en un plano vertical, fricción efectiva μ·|N|, integración RK4 con paso ≤ {formatNumber(config.maxSubstep * 1000, 2)} ms.
        Proyecto de Física I (FUN-18), Universidad CENFOTEC · Grupo A.
      </footer>
    </article>
  {:else}
    <p class="muted">El informe aparece cuando termina la auditoría.</p>
  {/if}
</Dialog>

<style>
  .report-sheet {
    padding: 20px 28px 28px;
    font-size: 12px;
    line-height: 1.55;
  }

  .sheet-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--primary);
  }

  .sheet-head h1 {
    margin: 0 0 4px;
    font-size: 20px;
    color: var(--text);
  }

  .sheet-head p {
    margin: 0;
    color: var(--muted);
  }

  .sheet-verdict {
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 1.5px;
    white-space: nowrap;
  }

  .sheet-verdict.ok {
    background: var(--success-soft);
    color: var(--success-text);
  }

  .sheet-verdict.bad {
    background: var(--danger-soft);
    color: var(--danger-text);
  }

  .report-sheet section {
    margin-top: 18px;
    break-inside: avoid;
  }

  .report-sheet h2 {
    margin: 0 0 8px;
    font-size: 14px;
    color: var(--primary-strong);
  }

  .report-sheet h3 {
    margin: 14px 0 6px;
    font-size: 12.5px;
    color: var(--text-soft);
  }

  /* En el teléfono la tabla se desplaza dentro de su caja; la página no se desborda. */
  .table-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .report-sheet table {
    width: 100%;
    min-width: 36rem;
    border-collapse: collapse;
    font-size: 11.5px;
  }

  .report-sheet th,
  .report-sheet td {
    padding: 5px 7px;
    border-bottom: 1px solid var(--border);
    text-align: left;
    vertical-align: top;
  }

  /* Sin mayúsculas: los encabezados llevan símbolos (v, n, N, s). */
  .report-sheet thead th {
    font-size: var(--text-11);
    color: var(--muted);
  }

  .report-sheet tbody th {
    width: 1%;
    white-space: nowrap;
    color: var(--text-soft);
    font-weight: 650;
  }

  .report-sheet table.parameters {
    min-width: 0;
  }

  .parameters th {
    white-space: normal;
  }

  .num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .muted {
    color: var(--muted);
  }

  tr.error td {
    color: var(--danger-text);
  }

  tr.warning td {
    color: var(--warn-text);
  }

  code {
    font-size: 11px;
    color: var(--primary-strong);
  }

  .sheet-foot {
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
    font-size: 10.5px;
    color: var(--muted);
  }

  .print-only {
    display: none;
  }

  @media print {
    .print-only {
      display: block;
    }

    :global(.report-dialog),
    :global(.report-dialog .body),
    .table-scroll {
      max-height: none;
      overflow: visible;
    }

    .report-sheet table {
      min-width: 0;
    }

    .report-sheet {
      padding: 0;
    }
  }
</style>
