<script lang="ts">
  import { SCENARIO_CARDS, type ScenarioId } from "../game/scenarios";

  let { onPreset }: { onPreset: (id: ScenarioId) => void } = $props();

  let dialog: HTMLDialogElement;

  let approvedScenarios = $derived(SCENARIO_CARDS.filter(card => card.approved));
  let rejectedScenarios = $derived(SCENARIO_CARDS.filter(card => !card.approved));

  function close() {
    dialog.close();
  }

  function choose(id: ScenarioId) {
    onPreset(id);
    close();
  }
</script>

<button class="guide-trigger" type="button" onclick={() => dialog.showModal()}>
  ? Guía y escenarios
</button>

<dialog bind:this={dialog} class="guide-dialog" aria-labelledby="guide-title">
  <div class="guide-heading">
    <div>
      <span>COASTER-CERTIFIER</span>
      <h2 id="guide-title">Guía y escenarios de referencia</h2>
    </div>

    <button type="button" onclick={close} aria-label="Cerrar guía">✕</button>
  </div>

  <div class="guide-body">
    <ol>
      <li>Ajustá los parámetros (símbolos del anexo) y presioná «Aplicar y reiniciar».</li>
      <li>Iniciá la animación, avanzá paso a paso o usá «Completar» para obtener el dictamen al instante.</li>
      <li>Revisá el dictamen, las gráficas y el reporte completo; exportá CSV, JSON o PDF.</li>
    </ol>

    <h3>Qué evalúa el dictamen</h3>

    <ul>
      <li><strong>Contacto:</strong> N = m·(g·cos θ + κ·v²) debe ser positiva. Con «ruedas de seguridad» la normal puede ser negativa fuera del loop, pero la carga no puede bajar de n_mín.</li>
      <li><strong>Carga sobre los pasajeros:</strong> n = N/(m·g) dentro de [n_mín, n_máx] (anexo: −1 g y +5 g).</li>
      <li><strong>Recorrido completo:</strong> el tren debe superar las subidas con v &gt; v_mín y llegar a la zona de frenado.</li>
      <li><strong>Frenado:</strong> detención antes del final de la zona (frenos) o compresión x ≤ x_máx sin rebote indefinido (resorte).</li>
    </ul>

    <h3>Cómo termina el recorrido</h3>

    <p>
      <strong>Frenos de estación:</strong> desaceleración constante a_f (≤ 1 g): d_det = v_E²/(2·a_f).
      <strong>Resorte:</strong> F = −k·x almacena energía y la devuelve; con amortiguamiento c la disipa y el tren queda en reposo.
    </p>

    <h3>Escenarios que aprueban</h3>

    {#each approvedScenarios as scenario}
      <article>
        <div>
          <h4>✔ {scenario.title}</h4>
          <p>{scenario.description}</p>
          <small>{scenario.summary}</small>
        </div>
        <button type="button" onclick={() => choose(scenario.id)}>Cargar</button>
      </article>
    {/each}

    <h3>Escenarios que se rechazan (didácticos)</h3>

    {#each rejectedScenarios as scenario}
      <article class="rejected">
        <div>
          <h4>✘ {scenario.title}</h4>
          <p>{scenario.description}</p>
          <small>{scenario.summary}</small>
        </div>
        <button type="button" onclick={() => choose(scenario.id)}>Cargar</button>
      </article>
    {/each}

    <h3>Supuestos del modelo</h3>

    <p>
      Tren como partícula sobre una vía rígida en un plano vertical, gravedad uniforme, fricción efectiva μ·|N|
      sin modelo separado de arrastre, ruedas sin energía de rotación. Los escenarios usan 425 kg por carrito y
      75 kg por persona; la masa no cambia la rapidez ni las cargas en g, solo escala fuerzas y energías.
    </p>
  </div>
</dialog>

<style>
  .guide-trigger {
    white-space: nowrap;
  }

  .guide-dialog {
    width: min(780px, calc(100vw - 32px));
    max-height: 88dvh;
    box-sizing: border-box;
    padding: 0;
    border: 1px solid #e4d6ee;
    border-radius: 20px;
    color: #674b7e;
    box-shadow: 0 25px 90px #31184745;
    background: white;
  }

  .guide-dialog::backdrop {
    background: #30213c88;
    backdrop-filter: blur(4px);
  }

  .guide-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid #eee4f5;
  }

  .guide-heading span {
    font-size: 10px;
    letter-spacing: 2px;
  }

  .guide-heading h2 {
    margin: 6px 0 0;
    font-size: 22px;
  }

  .guide-body {
    padding: 10px 24px 24px;
    overflow: auto;
    max-height: calc(88dvh - 105px);
  }

  .guide-body h3 {
    margin: 18px 0 8px;
    font-size: 14px;
  }

  .guide-body p,
  .guide-body li {
    font-size: 13px;
    line-height: 1.65;
  }

  .guide-body article {
    display: flex;
    gap: 15px;
    align-items: center;
    justify-content: space-between;
    padding: 13px 15px;
    margin: 8px 0;
    background: #f4faf6;
    border: 1px solid #dcefe4;
    border-radius: 12px;
  }

  .guide-body article.rejected {
    background: #fdf5f6;
    border-color: #f2dde1;
  }

  .guide-body article h4 {
    margin: 0 0 4px;
    font-size: 13px;
  }

  .guide-body article p {
    margin: 0 0 5px;
    font-size: 12px;
  }

  .guide-body small {
    font-size: 11px;
    color: #947aa5;
  }

  .guide-dialog button {
    border: 1px solid #ddcde9;
    border-radius: 9px;
    padding: 9px 12px;
    color: #785092;
    background: white;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }

  .guide-body article button {
    flex-shrink: 0;
  }

  @media (max-width: 550px) {
    .guide-body article {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
