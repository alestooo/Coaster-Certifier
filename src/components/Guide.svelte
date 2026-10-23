<script lang="ts">
  import { BookOpen, CheckCircle2, XCircle, Gauge, ShieldCheck, OctagonPause, Info, X } from "lucide-svelte";
  import TrackThumbnail from "./TrackThumbnail.svelte";
  import { SCENARIO_CARDS, type ScenarioId } from "../game/scenarios";

  let { onPreset }: { onPreset: (id: ScenarioId) => void } = $props();

  let dialog: HTMLDialogElement;
  let section = $state<"scenarios" | "criteria" | "model">("scenarios");

  export function open() {
    dialog.showModal();
  }

  let approvedScenarios = $derived(SCENARIO_CARDS.filter(card => card.approved));
  let rejectedScenarios = $derived(SCENARIO_CARDS.filter(card => !card.approved));

  function choose(id: ScenarioId) {
    onPreset(id);
    dialog.close();
  }
</script>

<dialog bind:this={dialog} class="guide" aria-labelledby="guide-title">
  <header class="guide-head">
    <div>
      <span class="eyebrow"><BookOpen size={13} /> Guía</span>
      <h2 id="guide-title">Escenarios y criterios</h2>
    </div>

    <nav class="guide-tabs" aria-label="Secciones de la guía">
      <button type="button" class:active={section === "scenarios"} onclick={() => (section = "scenarios")}>Escenarios</button>
      <button type="button" class:active={section === "criteria"} onclick={() => (section = "criteria")}>Criterios</button>
      <button type="button" class:active={section === "model"} onclick={() => (section = "model")}>Modelo</button>
    </nav>

    <button type="button" class="close" aria-label="Cerrar guía" onclick={() => dialog.close()}><X size={16} /></button>
  </header>

  <div class="guide-body">
    {#if section === "scenarios"}
      <p class="lead">Cada escenario carga una configuración completa y reinicia la simulación. Los que aprueban y los que no sirven para comparar causas.</p>

      <h3><CheckCircle2 size={15} /> Aprueban el dictamen</h3>
      <div class="cards">
        {#each approvedScenarios as scenario}
          <button type="button" class="scenario ok" onclick={() => choose(scenario.id)}>
            <TrackThumbnail config={scenario.config} />
            <strong>{scenario.title}</strong>
            <span>{scenario.description}</span>
            <small>{scenario.summary}</small>
          </button>
        {/each}
      </div>

      <h3><XCircle size={15} /> Se rechazan (didácticos)</h3>
      <div class="cards">
        {#each rejectedScenarios as scenario}
          <button type="button" class="scenario bad" onclick={() => choose(scenario.id)}>
            <TrackThumbnail config={scenario.config} />
            <strong>{scenario.title}</strong>
            <span>{scenario.description}</span>
            <small>{scenario.summary}</small>
          </button>
        {/each}
      </div>
    {:else if section === "criteria"}
      <div class="criteria">
        <article>
          <ShieldCheck size={18} />
          <h4>Contacto con la vía</h4>
          <p>N = m·(g·cos θ + κ·v²) debe ser positiva. Con «ruedas de seguridad» puede ser negativa fuera del loop, pero la carga no baja de n_mín.</p>
        </article>
        <article>
          <Gauge size={18} />
          <h4>Carga sobre los pasajeros</h4>
          <p>n = N/(m·g) dentro de [n_mín, n_máx]. El anexo fija −1 g y +5 g; la base del loop y las crestas son los puntos críticos.</p>
        </article>
        <article>
          <Info size={18} />
          <h4>Recorrido completo</h4>
          <p>El tren debe superar las subidas con v &gt; v_mín y llegar a la zona de frenado sin retroceder hasta A.</p>
        </article>
        <article>
          <OctagonPause size={18} />
          <h4>Frenado</h4>
          <p>Frenos: detención antes de F con d_det = v_E²/(2·a_f) y a_f ≤ 1 g. Resorte: x ≤ x_máx y sin rebote indefinido (un resorte ideal nunca detiene al tren).</p>
        </article>
      </div>
    {:else}
      <div class="model">
        <p>Tren como partícula sobre una vía rígida en un plano vertical, con gravedad uniforme y fricción efectiva f = μ·|N| que agrupa rodadura y aire. La subida por cadena queda fuera del recorrido: el tren parte de A con rapidez v₀.</p>
        <p>Ecuaciones: m·dv/dt = −m·g·sin θ − f − F_freno + F_resorte y N = m·(g·cos θ + κ·v²). Se integran con Runge–Kutta 4 en pasos ≤ 1 ms, localizando con bisección los puntos de retorno y la entrada al frenado.</p>
        <p>Loop en lágrima definido por su altura h_L y el radio R en la cima (R_B = h_L − R en la base). Colina definida por h_c y el radio de la cresta ρ_c. La masa no cambia la rapidez ni las cargas en g: solo escala fuerzas y energías.</p>
        <p>Validación: 71 pruebas con soluciones cerradas (plano inclinado, conservación de la energía, MRUA de frenado, resorte, cima y base del loop, cresta, Tabla 5 del anexo). El CSV del script headless permite auditar cada estado.</p>
      </div>
    {/if}
  </div>
</dialog>

<style>
  .guide {
    box-sizing: border-box;
    width: min(980px, calc(100vw - 30px));
    max-height: 90dvh;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  .guide::backdrop {
    background: rgb(45 33 64 / 55%);
    backdrop-filter: blur(5px);
  }

  .guide-head {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 14px;
    padding: 18px 22px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-soft);
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .guide-head h2 {
    margin: 2px 0 0;
    font-size: 22px;
    font-weight: 900;
  }

  .guide-tabs {
    display: inline-flex;
    padding: 3px;
    border: 1px solid var(--border);
    border-radius: 11px;
    background: var(--surface);
  }

  .guide-tabs button {
    height: 32px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 12.5px;
    font-weight: 800;
    cursor: pointer;
  }

  .guide-tabs button.active {
    background: var(--primary-soft);
    color: var(--primary-strong);
  }

  .close {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text-soft);
    cursor: pointer;
  }

  .guide-body {
    max-height: calc(90dvh - 84px);
    overflow: auto;
    padding: 18px 22px 24px;
  }

  .lead {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--muted);
  }

  .guide-body h3 {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin: 14px 0 10px;
    font-size: 13px;
    font-weight: 900;
    color: var(--text-soft);
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 10px;
  }

  .scenario {
    display: grid;
    gap: 5px;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
    text-align: left;
    font: inherit;
    color: var(--text);
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
  }

  .scenario:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow);
    border-color: var(--primary);
  }

  .scenario :global(svg) {
    width: 100%;
    height: auto;
    border-radius: 9px;
  }

  .scenario.ok :global(svg) {
    background: var(--success-soft);
  }

  .scenario.bad :global(svg) {
    background: var(--danger-soft);
  }

  .scenario strong {
    font-size: 12.5px;
    line-height: 1.3;
  }

  .scenario span {
    font-size: 11px;
    line-height: 1.45;
    color: var(--muted);
  }

  .scenario small {
    font-size: 10px;
    color: var(--faint);
  }

  .criteria {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .criteria article {
    display: grid;
    gap: 6px;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface-soft);
    color: var(--primary-strong);
  }

  .criteria h4 {
    margin: 0;
    font-size: 13.5px;
    color: var(--text);
  }

  .criteria p,
  .model p {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--text-soft);
  }

  .model {
    display: grid;
    gap: 10px;
  }

  @media (max-width: 700px) {
    .guide-head {
      grid-template-columns: 1fr auto;
    }

    .guide-tabs {
      grid-column: 1 / -1;
    }

    .criteria {
      grid-template-columns: 1fr;
    }
  }
</style>
