<script lang="ts">
  import { toCsv } from "../../physics/index.js";
  import type { SimulationConfig, SimulationState, Track, Verdict } from "../../lib/types";
  import type { Passenger } from "../../game/passengers";
  import { FIELD_GROUPS } from "../../lib/field-definitions";
  import { downloadText, downloadJson, stampedName } from "../../ui/export";
  import { formatNumber, formatSeconds, kmh } from "../../ui/format";

  let {
    verdict,
    config,
    track,
    history,
    passengers,
    mapName
  }: {
    verdict: Verdict | null;
    config: SimulationConfig;
    track: Track;
    history: SimulationState[];
    passengers: Passenger[];
    mapName: string;
  } = $props();

  let dialog: HTMLDialogElement;

  export function open() {
    dialog.showModal();
  }

  let generatedAt = $state(new Date());

  let parameterRows = $derived(
    FIELD_GROUPS.flatMap(group =>
      group.fields
        .filter(field => !field.visible || field.visible(config))
        .map(field => ({ symbol: field.symbol, label: field.label, value: `${formatNumber(config[field.key], field.step < 0.01 ? 4 : 2)} ${field.unit}`.trim() }))
    )
  );

  let summary = $derived(verdict?.summary ?? null);

  function exportCsv() {
    downloadText(stampedName(`coaster-${config.mapId}`, "csv"), toCsv(history), "text/csv");
  }

  function exportJson() {
    downloadJson(stampedName(`dictamen-${config.mapId}`, "json"), {
      generatedAt: generatedAt.toISOString(),
      map: mapName,
      config,
      verdict,
      track: { sections: track.sections, markers: track.markers }
    });
  }

  function print() {
    generatedAt = new Date();
    window.print();
  }
</script>

<dialog bind:this={dialog} class="report-dialog" aria-labelledby="report-title">
  <div class="report-actions no-print">
    <div>
      <span class="eyebrow">REPORTE DE CERTIFICACIÓN</span>
      <h2 id="report-title">Informe del recorrido</h2>
    </div>

    <div class="report-buttons">
      <button type="button" onclick={exportCsv} title="Serie temporal completa en CSV (mismas columnas que el script headless)">⤓ CSV</button>
      <button type="button" onclick={exportJson} title="Configuración y dictamen en JSON">⤓ JSON</button>
      <button type="button" onclick={print}>🖨 Imprimir / PDF</button>
      <button type="button" aria-label="Cerrar reporte" onclick={() => dialog.close()}>✕</button>
    </div>
  </div>

  {#if verdict && summary}
    <article class="report-sheet">
      <header class="sheet-head">
        <div>
          <h1>Coaster-Certifier · Dictamen del trazado</h1>
          <p>
            Recorrido: <strong>{mapName}</strong> · {passengers.length} {passengers.length === 1 ? "pasajero" : "pasajeros"} ·
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
          {#each verdict.reasons as reason}
            <li>{reason}</li>
          {/each}
        </ul>

        {#if verdict.violations.length}
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
        {/if}
      </section>

      <section>
        <h2>2. Puntos críticos</h2>
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
      </section>

      <section>
        <h2>3. Extremos del recorrido</h2>
        <table>
          <tbody>
            <tr><th>Rapidez máxima</th><td class="num">{formatNumber(summary.maxSpeed.value)} m/s ({formatNumber(kmh(summary.maxSpeed.value), 0)} km/h)</td><td>{summary.maxSpeed.section} · t = {formatNumber(summary.maxSpeed.time)} s</td></tr>
            <tr><th>Carga máxima</th><td class="num">{formatNumber(summary.maxLoad.value)} g</td><td>{summary.maxLoad.section} · s = {formatNumber(summary.maxLoad.distance)} m</td></tr>
            <tr><th>Carga mínima</th><td class="num">{formatNumber(summary.minLoad.value)} g</td><td>{summary.minLoad.section} · s = {formatNumber(summary.minLoad.distance)} m</td></tr>
            <tr><th>Fuerza normal mínima</th><td class="num">{formatNumber(summary.minNormal.value, 0)} N</td><td>{summary.minNormal.section}</td></tr>
            <tr><th>Fuerza normal máxima</th><td class="num">{formatNumber(summary.maxNormal.value, 0)} N</td><td>{summary.maxNormal.section}</td></tr>
            <tr><th>Aceleración tangencial máxima</th><td class="num">{formatNumber(summary.maxTangentialAcceleration.value)} m/s²</td><td>{summary.maxTangentialAcceleration.section}</td></tr>
            <tr><th>Aceleración normal máxima</th><td class="num">{formatNumber(summary.maxNormalAcceleration.value)} m/s²</td><td>{summary.maxNormalAcceleration.section}</td></tr>
            <tr><th>Energía inicial</th><td class="num">{formatNumber(summary.initialEnergy, 0)} J</td><td>m·g·H + ½·m·v₀²</td></tr>
            <tr><th>Energía disipada</th><td class="num">{formatNumber(summary.dissipatedEnergy, 0)} J</td><td>{formatNumber((100 * summary.dissipatedEnergy) / summary.initialEnergy, 1)} % de la inicial</td></tr>
            <tr><th>Error máximo de balance</th><td class="num">{summary.maxBalanceError.value.toExponential(2)} J</td><td>{((100 * summary.maxBalanceError.value) / summary.initialEnergy).toExponential(2)} % de la inicial</td></tr>
            <tr><th>Duración</th><td class="num">{formatSeconds(summary.duration)}</td><td>{summary.samples} muestras</td></tr>
          </tbody>
        </table>
      </section>

      {#if summary.braking.reached}
        <section>
          <h2>4. Frenado E → F</h2>
          <table>
            <tbody>
              <tr><th>Rapidez de entrada v_E</th><td class="num">{formatNumber(summary.braking.entrySpeed)} m/s</td></tr>
              <tr><th>Distancia de detención</th><td class="num">{summary.braking.stoppingDistance === null ? "no se detuvo" : `${formatNumber(summary.braking.stoppingDistance)} m de ${formatNumber(config.brakingLength)} m`}</td></tr>
              <tr><th>Tiempo de frenado</th><td class="num">{summary.braking.stoppingTime === null ? "—" : formatSeconds(summary.braking.stoppingTime)}</td></tr>
              <tr><th>Margen restante</th><td class="num">{summary.braking.remainingLength === null ? "—" : `${formatNumber(summary.braking.remainingLength)} m`}</td></tr>
              <tr><th>Fuerza de frenado</th><td class="num">{formatNumber(summary.braking.brakeForce, 0)} N</td></tr>
              <tr><th>Impulso (m·v_E)</th><td class="num">{formatNumber(summary.braking.impulse, 0)} N·s</td></tr>
              <tr><th>Energía por disipar (½·m·v_E²)</th><td class="num">{formatNumber(summary.braking.energyToDissipate, 0)} J</td></tr>
              {#if config.brakeMode === "spring"}
                <tr><th>Compresión máxima</th><td class="num">{formatNumber(summary.braking.maxCompression)} m de {formatNumber(config.maxCompression)} m</td></tr>
              {/if}
            </tbody>
          </table>
        </section>
      {/if}

      <section>
        <h2>5. Tramos</h2>
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
      </section>

      <section>
        <h2>6. Condiciones de diseño (conservación de la energía sin fricción)</h2>
        <table>
          <tbody>
            {#each verdict.designChecks as check}
              <tr class={check.ok ? "" : check.severity}>
                <td>{check.ok ? "✔" : check.severity === "error" ? "✘" : "⚠"}</td>
                <td>{check.name}</td>
                <td><code>{check.formula}</code></td>
                <td>{check.detail}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>

      <section>
        <h2>7. Parámetros de la simulación</h2>
        <table class="parameters">
          <tbody>
            <tr><th>Trazado</th><td>{mapName} ({config.mapId})</td><th>Frenado</th><td>{config.brakeMode === "station" ? "frenos de estación" : "resorte"}</td></tr>
            <tr><th>Contacto</th><td>{config.contactModel === "strict" ? "estricto (N > 0)" : "ruedas de seguridad"}</td><th>m</th><td>{formatNumber(config.mass, 1)} kg</td></tr>
            {#each Array.from({ length: Math.ceil(parameterRows.length / 2) }, (_, index) => parameterRows.slice(index * 2, index * 2 + 2)) as pair}
              <tr>
                {#each pair as row}
                  <th>{row.symbol} · {row.label}</th>
                  <td>{row.value}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </section>

      <footer class="sheet-foot">
        Modelo de partícula sobre vía rígida en un plano vertical, fricción efectiva μ·|N|, integración RK4 con paso ≤ {config.maxSubstep} s.
        Proyecto de Física I (FUN-18), Universidad CENFOTEC · Grupo A.
      </footer>
    </article>
  {:else}
    <p class="muted">El reporte se genera cuando la simulación se detiene.</p>
  {/if}
</dialog>

<style>
  .report-dialog {
    box-sizing: border-box;
    width: min(1040px, calc(100vw - 30px));
    max-height: 92dvh;
    padding: 0;
    border: 1px solid #e5d6ee;
    border-radius: 20px;
    background: white;
    color: #3d2c4e;
    box-shadow: 0 25px 90px #31184745;
    overflow: auto;
  }

  .report-dialog::backdrop {
    background: #30213c88;
    backdrop-filter: blur(4px);
  }

  .report-actions {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 16px 24px;
    border-bottom: 1px solid #eee4f5;
    background: white;
  }

  .report-actions h2 {
    margin: 4px 0 0;
    font-size: 20px;
  }

  .eyebrow {
    font-size: 9px;
    letter-spacing: 1.6px;
    color: #a18ab1;
  }

  .report-buttons {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .report-buttons button {
    padding: 8px 12px;
    border: 1px solid #dfd0ea;
    border-radius: 9px;
    background: #faf6fe;
    color: #76538f;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

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
    border-bottom: 2px solid #8050c8;
  }

  .sheet-head h1 {
    margin: 0 0 4px;
    font-size: 20px;
    color: #4b2d6a;
  }

  .sheet-head p {
    margin: 0;
    color: #7a6b89;
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
    background: #e3f5ec;
    color: #1f7a57;
  }

  .sheet-verdict.bad {
    background: #fde6ea;
    color: #b7303f;
  }

  .report-sheet section {
    margin-top: 18px;
    break-inside: avoid;
  }

  .report-sheet h2 {
    margin: 0 0 8px;
    font-size: 14px;
    color: #603497;
  }

  .report-sheet table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
  }

  .report-sheet th,
  .report-sheet td {
    padding: 5px 7px;
    border-bottom: 1px solid #efe7f6;
    text-align: left;
    vertical-align: top;
  }

  .report-sheet thead th {
    font-size: 10px;
    color: #a18ab1;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .report-sheet tbody th {
    width: 1%;
    white-space: nowrap;
    color: #5a4470;
    font-weight: 650;
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
    color: #a18ab1;
  }

  tr.error td {
    color: #9d2a39;
  }

  tr.warning td {
    color: #8a6420;
  }

  code {
    font-size: 11px;
    color: #603497;
  }

  .sheet-foot {
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px solid #efe7f6;
    font-size: 10.5px;
    color: #9b84aa;
  }

  @media print {
    .report-dialog {
      position: static;
      width: auto;
      max-height: none;
      border: 0;
      box-shadow: none;
      overflow: visible;
    }

    .no-print {
      display: none !important;
    }

    .report-sheet {
      padding: 0;
    }
  }
</style>
