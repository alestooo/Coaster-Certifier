<script lang="ts">
  import {
    SCENARIOS,
    type PresetId
  } from "../game/scenarios";

  let {
    onPreset
  }: {
    onPreset: (id: PresetId) => void;
  } = $props();

  let dialog: HTMLDialogElement;

  function close() {
    dialog.close();
  }
</script>

<button
  class="guide-trigger"
  type="button"
  onclick={() => dialog.showModal()}
>
  ? Guía y pruebas
</button>

<dialog
  bind:this={dialog}
  class="guide-dialog"
  aria-labelledby="guide-title"
>
  <div class="guide-heading">
    <div>
      <span>COASTER-CERTIFIER</span>

      <h2 id="guide-title">
        Guía y pruebas rápidas
      </h2>
    </div>

    <button
      type="button"
      onclick={close}
      aria-label="Cerrar guía"
    >
      ✕
    </button>
  </div>

  <div class="guide-body">
    <ol>
      <li>
        Elegí un recorrido y prepará los pasajeros.
      </li>

      <li>
        Ajustá los valores y presioná
        «Aplicar y reiniciar».
      </li>

      <li>
        Iniciá; observá el tren, los indicadores
        y las gráficas.
      </li>
    </ol>

    <h3>Elegí cómo termina el recorrido</h3>

    <p>
      <strong>Estación:</strong>
      un freno independiente disipa energía hasta
      detener el tren. Si falta distancia,
      se rechaza la configuración.
    </p>

    <p>
      <strong>Resorte:</strong>
      almacena energía y puede devolverla,
      haciendo rebotar el tren.
    </p>

    <h3>Configuraciones comprobadas</h3>

    <p>
      Los botones cargan y reinician el caso,
      sin iniciarlo. Usan 425 kg por carrito y
      75 kg por persona: con una persona,
      la masa total es 500 kg.
    </p>

    {#each SCENARIOS as scenario}
      <article>
        <div>
          <h4>{scenario.title}</h4>
          <p>{scenario.description}</p>
          <small>{scenario.values}</small>
        </div>

        <button
          type="button"
          onclick={() => {
            onPreset(scenario.id);
            close();
          }}
        >
          Cargar prueba
        </button>
      </article>
    {/each}

    <h3>Qué podés comparar</h3>

    <p>
      Más altura aporta energía. Más masa aumenta
      fuerzas y energías; en la bajada ideal no
      aumenta la rapidez. Con resorte, más masa
      puede aumentar la compresión.
    </p>

    <p>
      La normal debe ser positiva.
      Las pruebas de loop con 8 g son exploratorias;
      el límite del proyecto sigue siendo +5 g.
      Su cumplimiento requiere otra geometría de loop.
    </p>

    <p>
      Modelo de masa concentrada, fricción μN,
      sin resistencia del aire. La carga mostrada
      es N/(mg); el dictamen final del anexo
      todavía no está completo.
    </p>
  </div>
</dialog>

<style>
  .guide-trigger {
    white-space: nowrap;
  }

  .guide-dialog {
    width: min(760px, calc(100vw - 32px));
    max-height: 85dvh;
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
    max-height: calc(85dvh - 105px);
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
    padding: 15px;
    margin: 10px 0;
    background: #f9f5fd;
    border: 1px solid #eee3f6;
    border-radius: 12px;
  }

  .guide-body article h4 {
    margin: 0 0 5px;
  }

  .guide-body article p {
    margin: 0 0 7px;
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