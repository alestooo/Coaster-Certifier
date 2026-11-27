<script lang="ts">
  import { CheckCircle2, XCircle, Gauge, ShieldCheck, OctagonPause, Info } from "lucide-svelte";
  import Dialog from "./ui/Dialog.svelte";
  import Tabs from "./ui/Tabs.svelte";
  import TrackThumbnail from "./TrackThumbnail.svelte";
  import { SCENARIO_CARDS, type ScenarioId } from "../game/scenarios";

  let { onPreset }: { onPreset: (id: ScenarioId) => void } = $props();

  type Section = "scenarios" | "criteria" | "model";
  const SECTIONS: { id: Section; label: string }[] = [
    { id: "scenarios", label: "Escenarios" },
    { id: "criteria", label: "Criterios" },
    { id: "model", label: "Modelo" }
  ];

  let dialog: ReturnType<typeof Dialog>;
  let section = $state<Section>("scenarios");

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

<Dialog bind:this={dialog} class="guide" title="Guía" wide>
  <div class="guide-body">
    <Tabs label="Secciones de la guía" tabs={SECTIONS} active={section} onChange={id => (section = id as Section)}>
      {#snippet children(current)}
    {#if current === "scenarios"}
      <p class="lead">Cada escenario carga un diseño completo. Compará los que aprueban con los que no para ver qué causa cada rechazo.</p>

      <h3><CheckCircle2 size={15} /> Aprueban</h3>
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

      <h3><XCircle size={15} /> No aprueban (para comparar)</h3>
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
    {:else if current === "criteria"}
      <div class="criteria">
        <article>
          <ShieldCheck size={18} />
          <h4>Contacto con la vía</h4>
          <p>La vía debe empujar al tren: N = m·(g·cos θ + κ·v²) &gt; 0. Con «ruedas anti-levantamiento» puede ser negativa fuera del loop, pero la fuerza g no baja de n_mín.</p>
        </article>
        <article>
          <Gauge size={18} />
          <h4>Fuerza g sobre los pasajeros</h4>
          <p>Lo que siente el pasajero, n = N/(m·g): 1 g es estar sentado en reposo. Debe quedar entre n_mín y n_máx (el anexo fija −1 g y +5 g); la base del loop y las crestas son los puntos críticos.</p>
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
        <p>Tren como partícula (como el anexo) o, con más de un carro, como tren articulado: carros rígidos sobre la vía, cada uno con su peso, su normal y su fuerza g; los criterios miran el peor carro. Vía rígida en un plano vertical, gravedad uniforme, rodadura f = μ·|N| y aire ½·ρ·C_dA·v².</p>
        <p>Ecuaciones: m·dv/dt = −m·g·sin θ − f − F_aire − F_freno − F_ajuste + F_lanzador + F_resorte y N = m·(g·cos θ + κ·v²). Se integran con Runge–Kutta 4 en pasos ≤ 1 ms, localizando con bisección los puntos de retorno, la entrada al frenado y los bordes de los lanzadores y los frenos de ajuste. Si la fricción detiene al tren dentro de un paso, ese tramo se resuelve en forma cerrada.</p>
        <p>Lanzador LSM: F = min(m·a_máx, P/v). Frenos de ajuste por corrientes parásitas: F = −c·v (c por carro con el tren articulado). Subida por cadena con ángulo, eficiencia y rapidez de la cadena: no forma parte del recorrido (t = 0 en A), pero da la potencia del motor. Balance: E_m + E_disipada = E₀ + W_lanzadores (+ W_cadena con el tren articulado, mientras quedan carros en la subida).</p>
        <p>Loop en lágrima definido por su altura h_L y el radio R en la cima (R_B = h_L − R en la base). Colina definida por h_c y el radio de la cresta ρ_c. La masa no cambia la rapidez ni las cargas en g: solo escala fuerzas y energías.</p>
        <p>Validación: pruebas automáticas con soluciones cerradas (plano inclinado, energía, frenado con y sin aire, velocidad terminal, lanzador, frenos de ajuste, resorte, loop, cresta, Tabla 5 del anexo) y una prueba de equivalencia con el modelo anterior. El CSV del script headless permite auditar cada estado.</p>
      </div>
    {/if}
      {/snippet}
    </Tabs>
  </div>
</Dialog>

<style>
  .guide-body {
    padding: var(--space-4) var(--space-6) var(--space-6);
  }

  .guide-body :global(.panel) {
    margin-top: var(--space-4);
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
    .criteria {
      grid-template-columns: 1fr;
    }
  }
</style>
