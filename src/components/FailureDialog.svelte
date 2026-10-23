<script lang="ts">
  import { onDestroy } from "svelte";

  import { explainFailure } from "../physics/index.js";
  import type { SimulationConfig, SimulationState } from "../lib/types";

  type Config = SimulationConfig;

  type Change = {
    key: string;
    label: string;
    unit: string;
    before: number | null;
    after: number | null;
  };

  type Option = {
    config: Config;
    changes: Change[];
    time: number;
    maxLoad: number;
    minLoad: number;
    maxCompression: number;
    targeted?: boolean;
  };

  let {
    failedState,
    config,
    onApply
  }: {
    failedState: SimulationState;
    config: Config;
    onApply: (config: Config) => void;
  } = $props();

  let dialog: HTMLDialogElement;
  let worker: Worker | undefined;

  let busy = $state(false);
  let tested = $state(0);
  let total = $state(0);
  let reason = $state("");

  let options = $state<Option[]>([]);

  let detail = $derived(
    explainFailure(failedState, config)
  );

  function format(value: number) {
    return new Intl.NumberFormat("es-CR", {
      maximumFractionDigits: 3
    }).format(value);
  }

  function titleFor(option: Option) {
    if (option.changes.length > 1) {
      return "Combinar ajustes del recorrido";
    }

    const change = option.changes[0];

    if (change.key === "customPoints") {
      return "Suavizar las alturas interiores";
    }

    const action =
      Number(change.after) > Number(change.before)
        ? "Aumentar"
        : "Reducir";

    return `${action} ${change.label.toLowerCase()}`;
  }

  function why(change: Change) {
    const increasing =
      Number(change.after) > Number(change.before);

    switch (change.key) {
      case "initialHeight":
        return increasing
          ? "Aporta más energía para superar subidas y mantener el contacto."
          : "Reduce la energía inicial y la rapidez, lo que puede disminuir las cargas y la exigencia del frenado.";

      case "initialSpeed":
        return increasing
          ? "Aporta energía cinética inicial adicional al salir de la cadena."
          : "Reduce la energía con la que el tren inicia el descenso.";

      case "trackWidth":
        return increasing
          ? "Distribuye los cambios de altura sobre más distancia y suaviza las curvas del perfil."
          : "Acorta el trazado, modifica la pendiente y reduce la distancia expuesta a la fricción.";

      case "friction":
        return increasing
          ? "Disipa más energía durante el recorrido y reduce la energía de llegada."
          : "Conserva más energía para superar subidas y alcanzar la zona final.";

      case "loopHeight":
        return increasing
          ? "Un loop más alto exige más energía pero abre la base (R_B = h_L − R) y reduce la carga en B."
          : "Un loop más bajo necesita menos energía para mantener el contacto en la cima C.";

      case "loopTopRadius":
        return increasing
          ? "Un radio mayor en la cima reduce la carga en C, pero exige más energía (H ≥ h_L + R/2) y cierra la base."
          : "Un radio menor en la cima abre la base del loop en lágrima (menos g en B) y pide menos altura.";

      case "hillHeight":
        return increasing
          ? "Una colina más alta llega a la cresta con menos rapidez y aumenta la carga mínima."
          : "Una colina más baja se supera con menos energía.";

      case "hillCrestRadius":
        return increasing
          ? "Una cresta más abierta reduce la aceleración normal y evita la sensación de ingravidez (n_D = 1 − v²/(g·ρ_c))."
          : "Una cresta más cerrada aumenta el airtime; el motor comprobó que sigue dentro del límite.";

      case "brakingLength":
        return increasing
          ? "Da más espacio al tren para detenerse dentro de la estación."
          : "Ajusta el espacio de frenado; el motor comprobó que sigue siendo suficiente.";

      case "brakeDeceleration":
        return increasing
          ? "Aumenta la fuerza de los frenos y reduce la distancia de detención."
          : "Reduce la intensidad del frenado; el motor comprobó que alcanza la distancia disponible.";

      case "springConstant":
        return increasing
          ? "Un resorte más rígido necesita menos compresión para almacenar la misma energía."
          : "Un resorte menos rígido cambia la compresión y la respuesta del rebote.";

      case "springDamping":
        return "Un amortiguador viscoso disipa la energía almacenada en el resorte y evita el rebote indefinido.";

      case "maxCompression":
        return increasing
          ? "Permite mayor recorrido de compresión sin exceder el espacio de frenado."
          : "Ajusta el límite de compresión; el movimiento comprobado permanece dentro de él.";

      default:
        return (
          "Suaviza las alturas interiores y modifica las curvas " +
          "sin cambiar el inicio ni la estación."
        );
    }
  }

  function fundamentals(candidate: Config) {
    const values = [
      [
        "Altura inicial",
        `${format(candidate.initialHeight)} m`
      ],
      [
        "Ancho del trazado",
        `${format(candidate.trackWidth)} m`
      ],
      [
        "Rapidez inicial",
        `${format(candidate.initialSpeed)} m/s`
      ],
      [
        "Masa total",
        `${format(candidate.mass)} kg`
      ],
      [
        "Fricción",
        format(candidate.friction)
      ],
      [
        "Zona de frenado",
        `${format(candidate.brakingLength)} m`
      ]
    ];

    if (candidate.mapId === "loop" || candidate.mapId === "reference") {
      values.push([
        "Loop h_L · R",
        `${format(candidate.loopHeight)} m · ${format(candidate.loopTopRadius)} m`
      ]);
    }

    if (candidate.mapId === "valley" || candidate.mapId === "reference") {
      values.push([
        "Colina h_c · ρ_c",
        `${format(candidate.hillHeight)} m · ${format(candidate.hillCrestRadius)} m`
      ]);
    }

    if (candidate.mapId === "custom") {
      const loops = candidate.customPoints
        .filter(point => point.loopHeight > 0)
        .map(point => `${format(point.loopHeight)} m / R ${format(point.loopTopRadius)} m`);

      values.push([
        "Loops",
        loops.length
          ? loops.join(" · ")
          : "Sin loops"
      ]);
    }

    if (candidate.brakeMode === "spring") {
      values.push(
        [
          "Resorte k · c",
          `${format(candidate.springConstant)} N/m · ${format(candidate.springDamping)} N·s/m`
        ],
        [
          "Compresión permitida",
          `${format(candidate.maxCompression)} m`
        ]
      );
    } else {
      values.push([
        "Frenado",
        `${format(candidate.brakeDeceleration)} m/s²`
      ]);
    }

    return values;
  }

  function stop() {
    worker?.terminate();
    worker = undefined;
    busy = false;
  }

  function search() {
    stop();

    options = [];
    reason = "";
    tested = 0;
    total = 0;
    busy = true;

    worker = new Worker(
      new URL(
        "../ui/recommendation.worker.js",
        import.meta.url
      ),
      { type: "module" }
    );

    worker.onmessage = event => {
      const data = event.data;

      if (data.type === "progress") {
        tested = data.tested;
        total = data.total;
      }

      if (data.type === "done") {
        options = data.recommendations;
        reason = data.reason;
        tested = data.tested;

        stop();
      }

      if (data.type === "error") {
        reason = data.message;
        stop();
      }
    };

    worker.onerror = () => {
      reason =
        "No se pudo completar la búsqueda. Podés intentarlo de nuevo.";

      stop();
    };

    worker.postMessage(
      JSON.parse(JSON.stringify({ config }))
    );
  }

  function open() {
    dialog.showModal();
    search();
  }

  function close() {
    stop();
    dialog.close();
  }

  onDestroy(stop);
</script>

<button
  class="failure-banner"
  type="button"
  onclick={open}
  aria-haspopup="dialog"
>
  <span class="failure-symbol" aria-hidden="true">!</span>

  <span>
    <strong>{detail.title}</strong>

    <small>
      {failedState.time.toFixed(3)} s ·
      {failedState.section} ·
      tocá para ver causas y pruebas
    </small>
  </span>

  <span aria-hidden="true">↗</span>
</button>

<dialog
  bind:this={dialog}
  class="failure-dialog"
  aria-labelledby="failure-title"
  onclose={stop}
>
  <header>
    <div>
      <span>DIAGNÓSTICO DEL RECORRIDO</span>
      <h2 id="failure-title">{detail.title}</h2>
    </div>

    <button
      type="button"
      onclick={close}
      aria-label="Cerrar diagnóstico"
    >
      ✕
    </button>
  </header>

  <div class="failure-body">
    <p>{detail.explanation}</p>

    {#if detail.event}
      <dl>
        <div>
          <dt>Instante</dt>
          <dd>{detail.event.time.toFixed(3)} s</dd>
        </div>

        <div>
          <dt>Ubicación</dt>

          <dd>
            {detail.event.section} ·
            s={detail.event.position.toFixed(2)} m
          </dd>
        </div>

        <div>
          <dt>Valor calculado</dt>

          <dd>
            {detail.event.value.toFixed(6)}
            {detail.event.unit}
          </dd>
        </div>

        <div>
          <dt>Límite</dt>

          <dd>
            {detail.event.limit.toFixed(6)}
            {detail.event.unit}
          </dd>
        </div>
      </dl>

      <p class="fine-print">
        Se muestran más decimales para distinguir
        un exceso pequeño del valor límite.
      </p>
    {/if}

    <h3>Tres maneras de probar tu recorrido</h3>

    <p>
      Cada prueba conserva tu recorrido, masa y límites.
      Las alternativas marcadas «calculada» salen de la
      física del fallo (energía, curvatura o frenado); todas
      se comprueban simulando el movimiento completo antes
      de ofrecerlas.
    </p>

    {#if busy}
      <p class="search-state" role="status">
        Comprobando alternativas…
        {tested}{total ? ` / ${total}` : ""}
      </p>
    {/if}

    {#each options as option, index}
      <article class="trial-card">
        <div class="option-heading">
          <div>
            <span class="trial-number">
              PRUEBA {index + 1}
            </span>

            <h4>{titleFor(option)}</h4>
          </div>

          <span class="verified">
            ✓ Comprobada{option.targeted ? " · calculada" : ""}
          </span>
        </div>

        <div class="trial-changes">
          {#each option.changes as change}
            <p>
              <strong>{change.label}:</strong>

              {change.before === null
                ? "ajustar las alturas interiores"
                : `${format(change.before)} → ${format(Number(change.after))} ${change.unit}`}
            </p>
          {/each}
        </div>

        <dl class="trial-values">
          {#each fundamentals(option.config) as [label, value]}
            <div>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          {/each}
        </dl>

        <details class="trial-explanation">
          <summary>
            ¿Por qué funciona este cambio?
          </summary>

          {#each option.changes as change}
            <p>{why(change)}</p>
          {/each}

          <p>
            El motor volvió a simular el recorrido completo
            con estos valores y los mismos límites.
          </p>
        </details>

        <div class="trial-footer">
          <small>
            Llegada detenida: {option.time.toFixed(2)} s ·
            carga máxima: {option.maxLoad.toFixed(2)} g ·
            mínima: {option.minLoad.toFixed(2)} g ·
            límites: {option.config.minLoad} / +{option.config.maxLoad} g
          </small>

          <button
            class="apply-option"
            type="button"
            onclick={() => {
              onApply(option.config);
              close();
            }}
          >
            Cargar prueba {index + 1} →
          </button>
        </div>
      </article>
    {/each}

    {#if reason}
      <p class="search-state" role="status">
        {reason}
      </p>
    {/if}

    {#if !busy}
      <button type="button" onclick={search}>
        Volver a comprobar
      </button>
    {/if}

    <p class="fine-print">
      La comprobación corresponde al modelo simplificado
      implementado y exige error de balance energético
      menor al 1 %. No sustituye el dictamen completo
      del anexo ni una certificación real.
    </p>
  </div>
</dialog>

<style>
  .failure-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 11px 14px;
    border: 1px solid #efcfda;
    border-radius: 12px;
    background: #fff5f8;
    color: #a64f69;
    cursor: pointer;
    text-align: left;
    font: inherit;
  }

  .failure-banner > span:nth-child(2) {
    display: grid;
    gap: 4px;
    flex: 1;
  }

  .failure-banner strong {
    font-size: 12px;
  }

  .failure-banner small {
    font-size: 10px;
    color: #b48092;
  }

  .failure-symbol {
    display: grid;
    place-items: center;
    width: 25px;
    height: 25px;
    border-radius: 50%;
    background: #f5dce5;
    font-weight: 800;
  }

  .failure-banner:hover {
    background: #ffeaf1;
  }

  .failure-dialog {
    box-sizing: border-box;
    width: min(790px, calc(100vw - 30px));
    max-height: 88dvh;
    padding: 0;
    border: 1px solid #e5d6ee;
    border-radius: 20px;
    background: white;
    color: #674b7e;
    box-shadow: 0 25px 90px #31184745;
  }

  .failure-dialog::backdrop {
    background: #30213c88;
    backdrop-filter: blur(4px);
  }

  .failure-dialog header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    padding: 20px 24px;
    border-bottom: 1px solid #eee4f5;
  }

  .failure-dialog header span {
    font-size: 9px;
    letter-spacing: 1.5px;
    color: #a183b1;
  }

  .failure-dialog h2 {
    margin: 7px 0 0;
    font-size: 22px;
  }

  .failure-body {
    padding: 12px 24px 24px;
    max-height: calc(88dvh - 110px);
    overflow: auto;
  }

  .failure-body p {
    font-size: 13px;
    line-height: 1.7;
  }

  .failure-body dl {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .failure-body dl > div {
    padding: 12px;
    border-radius: 10px;
    background: #f9f4fc;
  }

  .failure-body dt {
    font-size: 10px;
    color: #a184b2;
  }

  .failure-body dd {
    font-size: 12px;
    margin: 5px 0 0;
    overflow-wrap: anywhere;
  }

  .failure-dialog button {
    padding: 10px 13px;
    border: 1px solid #e0d0eb;
    border-radius: 9px;
    color: #795292;
    background: #faf6fe;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .failure-dialog .apply-option {
    color: white;
    background: #287d68;
    border-color: #287d68;
  }

  .failure-dialog .apply-option:hover {
    background: #206552;
  }

  .failure-body article {
    padding: 16px;
    border: 1px solid #e4d8ed;
    border-radius: 13px;
    margin: 14px 0;
  }

  .trial-card {
    background: linear-gradient(
      145deg,
      #ffffff,
      #fcf9ff
    );
  }

  .option-heading {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }

  .trial-number {
    display: inline-block;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: #a17bb7;
  }

  .option-heading h4 {
    font-size: 17px;
    margin: 6px 0 12px;
  }

  .option-heading .verified {
    padding: 6px 8px;
    border-radius: 7px;
    background: #eaf7f0;
    color: #328269;
    font-size: 10px;
    white-space: nowrap;
    align-self: flex-start;
  }

  .trial-changes {
    border-left: 3px solid #b592ce;
    padding-left: 10px;
  }

  .trial-changes p {
    margin: 5px 0;
    font-size: 12px;
  }

  .failure-body .trial-values {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
    margin: 14px 0;
  }

  .failure-body .trial-values > div {
    padding: 10px;
  }

  .trial-explanation {
    font-size: 12px;
    color: #8d6b9f;
  }

  .trial-explanation summary {
    cursor: pointer;
    padding: 8px 0;
  }

  .trial-explanation p {
    font-size: 12px;
  }

  .trial-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 15px;
    padding-top: 12px;
    border-top: 1px solid #eee3f5;
  }

  .trial-footer small {
    font-size: 10px;
    line-height: 1.6;
    color: #9b83a9;
    max-width: 60%;
  }

  .trial-footer .apply-option {
    white-space: nowrap;
    font-weight: 650;
  }

  .failure-body .fine-print {
    font-size: 11px;
    color: #a185b2;
  }

  .search-state {
    padding: 12px;
    background: #f9f0de;
    border-radius: 10px;
    color: #93723c;
  }

  .failure-dialog button:focus-visible,
  .failure-banner:focus-visible {
    outline: 3px solid #cda4e7;
    outline-offset: 3px;
  }

  @media (max-width: 600px) {
    .failure-body .trial-values {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .trial-footer {
      align-items: stretch;
      flex-direction: column;
    }

    .trial-footer small {
      max-width: 100%;
    }

    .option-heading h4 {
      font-size: 15px;
    }
  }

  @media (max-width: 550px) {
    .failure-body dl {
      grid-template-columns: 1fr;
    }

    .failure-dialog h2 {
      font-size: 19px;
    }
  }
</style>