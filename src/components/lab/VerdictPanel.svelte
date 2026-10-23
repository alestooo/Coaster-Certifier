<script lang="ts">
  import FailureDialog from "../FailureDialog.svelte";
  import type { SimulationConfig, SimulationState, Verdict } from "../../lib/types";
  import { formatNumber, formatSeconds } from "../../ui/format";

  let {
    verdict,
    running,
    started,
    state,
    config,
    onApplyRecommendation,
    onOpenReport
  }: {
    verdict: Verdict | null;
    running: boolean;
    started: boolean;
    state: SimulationState;
    config: SimulationConfig;
    onApplyRecommendation: (config: SimulationConfig) => void;
    onOpenReport: () => void;
  } = $props();

  let finished = $derived(state.status !== "running");

  let pill = $derived.by(() => {
    if (running) return { text: "EN CURSO", kind: "live" };
    if (!finished) return { text: started ? "PAUSADO" : "LISTO PARA SIMULAR", kind: "idle" };
    return verdict?.approved ? { text: "APROBADO", kind: "ok" } : { text: "RECHAZADO", kind: "bad" };
  });

  let violations = $derived(verdict?.violations ?? []);
  let failedChecks = $derived((verdict?.designChecks ?? []).filter(check => !check.ok));
</script>

<div class="verdict">
  <div class="verdict-head">
    <div>
      <span class="eyebrow">DICTAMEN DEL TRAZADO</span>
      <span class="pill {pill.kind}">{pill.text}</span>
    </div>

    <button type="button" onclick={onOpenReport} disabled={!verdict}>📄 Reporte completo</button>
  </div>

  {#if !finished}
    <p class="hint">
      El dictamen se emite cuando el tren se detiene en la estación o incumple un criterio.
      Criterios: contacto N &gt; 0, carga en [{config.minLoad}, {config.maxLoad}] g, detención dentro de la zona de frenado.
    </p>

    {#if failedChecks.length}
      <ul class="checks">
        {#each failedChecks as check}
          <li class={check.severity}>
            <strong>{check.severity === "error" ? "✘" : "⚠"} {check.name}</strong>
            <span>{check.formula} · {check.detail}</span>
          </li>
        {/each}
      </ul>
    {/if}
  {:else if verdict}
    <ul class="reasons">
      {#each verdict.reasons as reason}
        <li>{reason}</li>
      {/each}
    </ul>

    {#if violations.length}
      <table class="violations">
        <thead>
          <tr>
            <th>Condición</th>
            <th>Instante</th>
            <th>Tramo · posición</th>
            <th>Valor</th>
            <th>Límite</th>
          </tr>
        </thead>
        <tbody>
          {#each violations as violation}
            <tr>
              <td>{violation.condition}</td>
              <td>{formatSeconds(violation.time)}</td>
              <td>{violation.section} · s = {formatNumber(violation.position)} m</td>
              <td class="num">{formatNumber(violation.value, 3)} {violation.unit}</td>
              <td class="num">{violation.comparison} {formatNumber(violation.limit, 3)} {violation.unit}</td>
            </tr>
          {/each}
        </tbody>
      </table>

      <FailureDialog failedState={state} {config} onApply={onApplyRecommendation} />
    {/if}
  {/if}
</div>

<style>
  .verdict {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .verdict-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .verdict-head > div {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .eyebrow {
    font-size: 9px;
    letter-spacing: 1.6px;
    color: #a18ab1;
  }

  .pill {
    display: inline-block;
    padding: 7px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 1px;
    width: fit-content;
  }

  .pill.idle {
    background: #f0e9f7;
    color: #8b6b9f;
  }

  .pill.live {
    background: #e9f0ff;
    color: #3b63b8;
  }

  .pill.ok {
    background: #e3f5ec;
    color: #1f7a57;
  }

  .pill.bad {
    background: #fde6ea;
    color: #b7303f;
  }

  .hint {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.6;
    color: #8d75a0;
  }

  .reasons {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    line-height: 1.6;
    color: #5a4470;
  }

  .checks {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 6px;
  }

  .checks li {
    display: grid;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 11.5px;
    background: #fff6e5;
    color: #8a6420;
  }

  .checks li.error {
    background: #fde6ea;
    color: #9d2a39;
  }

  .violations {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  .violations th,
  .violations td {
    padding: 6px 7px;
    border-bottom: 1px solid #f0e8f6;
    text-align: left;
    vertical-align: top;
  }

  .violations th {
    font-size: 10px;
    color: #a18ab1;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .violations .num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
</style>
