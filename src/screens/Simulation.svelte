<script lang="ts">
  import { onMount, untrack } from "svelte";

  import MeasureIcon from "../components/MeasureIcon.svelte";
  import Guide from "../components/Guide.svelte";
  import FailureDialog from "../components/FailureDialog.svelte";

  import TrackEditor, {
    type TrackPoint
  } from "../components/TrackEditor.svelte";

  import {
    presetValues,
    type PresetId
  } from "../game/scenarios";

  import {
    CART_MASS,
    calculateCartCount,
    MIN_PASSENGER_MASS,
    MAX_PASSENGER_MASS,
    type Passenger
  } from "../game/passengers";

  import {
    DEFAULT_CONFIG,
    resolveConfig,
    getTrackInfo,
    createInitialState,
    step
  } from "../physics/index.js";

  import { renderSimulation } from "../ui/renderer.js";

  import {
    createPhysicsChart,
    updatePhysicsChart
  } from "../ui/charts.js";

  import "../styles/physics-lab.css";

  type Config = {
    -readonly [K in keyof typeof DEFAULT_CONFIG]:
      K extends "mapId" | "brakeMode"
        ? string
        : K extends "customPoints"
          ? TrackPoint[]
          : number;
  };

  let {
    config,
    passengers,
    onBack,
    onEditPassengers,
    onChangeMap
  }: {
    config: Config;
    passengers: Passenger[];
    onBack: () => void;
    onEditPassengers: () => void;
    onChangeMap: () => void;
  } = $props();

  const original = untrack(() =>
    passengers.map(passenger => ({ ...passenger }))
  );

  const count = calculateCartCount(original);

  let settings = $state<Config>({
    ...untrack(() => config),

    customPoints: untrack(() =>
      config.customPoints.map(point => ({ ...point }))
    )
  });

  let cartMass = $state(CART_MASS);
  let masses = $state(original.map(passenger => passenger.mass));

  let active = $state<Config>(
    untrack(() => ({ ...settings }))
  );

  let people = $state(
    original.map(passenger => ({ ...passenger }))
  );

  let physicalState = $state(
    untrack(() => createInitialState(active))
  );

  let running = $state(false);
  let error = $state("");

  let designConfirmed = $state(
    untrack(() => config.mapId !== "custom")
  );

  let cameraMode = $state<"full" | "follow">("full");
  let zoom = $state(1.5);
  let chartKind = $state("speed");

  let canvas: HTMLCanvasElement;
  let chartCanvas: HTMLCanvasElement;
  let editorDialog: HTMLDialogElement;

  let chart: ReturnType<typeof createPhysicsChart> | undefined;

  let history = untrack(() => [physicalState]);

  let previous: number | null = null;
  let accumulator = 0;
  let lastSample = 0;

  let signature = $state(
    untrack(() =>
      JSON.stringify({ settings, cartMass, masses })
    )
  );

  let dirty = $derived(
    JSON.stringify({ settings, cartMass, masses }) !== signature
  );

  const names: Record<string, string> = {
    slope: "Línea",
    valley: "Valle",
    loop: "Loop circular",
    custom: "Personalizado"
  };

  const labels: Record<string, string> = {
    running: "Listo / pausado",
    finished: "En la estación",
    stopped: "En reposo",
    stalled: "Detenido antes del frenado",
    rejected: "Límite excedido",
    "lost-contact": "Pérdida de contacto",
    timeout: "Fin de observación"
  };

  const fields = [
    {
      key: "initialHeight",
      label: "Altura inicial",
      unit: "m",
      min: 0.1,
      max: 80,
      icon: "height"
    },
    {
      key: "trackLength",
      label: "Ancho del trazado",
      unit: "m",
      min: 1,
      max: 500,
      icon: "length"
    },
    {
      key: "friction",
      label: "Fricción",
      unit: "",
      min: 0,
      max: 0.2,
      icon: "length"
    },
    {
      key: "loopRadius",
      label: "Radio del loop",
      unit: "m",
      min: 1,
      max: 30,
      icon: "height"
    },
    {
      key: "brakingLength",
      label: "Zona de frenado",
      unit: "m",
      min: 1,
      max: 100,
      icon: "length"
    },
    {
      key: "brakeDeceleration",
      label: "Desaceleración del freno",
      unit: "m/s²",
      min: 0.1,
      max: 9.81,
      icon: "length"
    },
    {
      key: "springConstant",
      label: "Rigidez del resorte",
      unit: "N/m",
      min: 100,
      max: 100000,
      icon: "length"
    },
    {
      key: "maxCompression",
      label: "Compresión máxima",
      unit: "m",
      min: 0.1,
      max: 50,
      icon: "length"
    }
  ] as const;

  function visible(key: string) {
    if (key === "loopRadius") {
      return settings.mapId === "loop";
    }

    if (
      key === "springConstant" ||
      key === "maxCompression"
    ) {
      return settings.brakeMode === "spring";
    }

    if (key === "brakeDeceleration") {
      return settings.brakeMode === "station";
    }

    return true;
  }

  function pause() {
    running = false;
    previous = null;
  }

  function draw() {
    if (!canvas) return;

    renderSimulation(
      canvas,
      physicalState,
      active,
      people,
      { mode: cameraMode, zoom }
    );
  }

  function refreshChart() {
    if (chart) {
      updatePhysicsChart(chart, history, chartKind);
    }
  }

  function restart() {
    pause();
    accumulator = 0;
    lastSample = 0;

    physicalState = createInitialState(active);
    history = [physicalState];

    refreshChart();
    draw();
  }

  function apply() {
    pause();
    error = "";

    try {
      if (
        !Number.isFinite(cartMass) ||
        cartMass < 1 ||
        cartMass > 10000 ||
        masses.some(
          mass =>
            !Number.isFinite(mass) ||
            mass < MIN_PASSENGER_MASS ||
            mass > MAX_PASSENGER_MASS
        )
      ) {
        throw new Error("Revisá los rangos de las masas.");
      }

      const next = resolveConfig({
        ...settings,

        mass:
          count * cartMass +
          masses.reduce((sum, mass) => sum + mass, 0)
      });

      getTrackInfo(next);

      const initial = createInitialState(next);

      active = next;
      physicalState = initial;

      people = original.map((passenger, index) => ({
        ...passenger,
        mass: masses[index]
      }));

      accumulator = 0;
      lastSample = 0;
      history = [initial];

      signature = JSON.stringify({
        settings,
        cartMass,
        masses
      });

      designConfirmed = true;

      refreshChart();
      draw();

      return true;
    } catch (problem) {
      error =
        problem instanceof Error
          ? problem.message
          : "Configuración inválida.";

      return false;
    }
  }

  function loadPreset(id: PresetId) {
    pause();

    settings = {
      ...settings,
      ...presetValues(id)
    };

    cartMass = 425;
    masses = original.map(() => 75);

    apply();
  }

  function applyRecommendation(next: Config) {
    pause();

    settings = {
      ...next,

      customPoints: next.customPoints.map(point => ({
        ...point
      }))
    };

    // Las recomendaciones conservan la masa actual.
    apply();
  }

  function setField(
    key: typeof fields[number]["key"],
    value: number
  ) {
    pause();
    settings = { ...settings, [key]: value };
  }

  onMount(() => {
    chart = createPhysicsChart(chartCanvas);
    refreshChart();

    let frame = 0;

    if (active.mapId === "custom") {
      editorDialog.showModal();
    }

    function animate(now: number) {
      const elapsed =
        previous === null
          ? 0
          : Math.min((now - previous) / 1000, 0.05);

      previous = now;

      if (running && !dirty) {
        accumulator += elapsed;

        while (accumulator >= active.timeStep) {
          physicalState = step(
            physicalState,
            active,
            active.timeStep
          );

          accumulator -= active.timeStep;

          if (
            physicalState.time - lastSample >= 0.05 ||
            physicalState.status !== "running"
          ) {
            history.push(physicalState);
            lastSample = physicalState.time;
            refreshChart();
          }

          if (physicalState.status !== "running") {
            pause();
            accumulator = 0;
            break;
          }
        }
      }

      draw();
      frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
  });
</script>

<main class="physics-lab">
  <header class="lab-heading">
    <div>
      <span class="lab-eyebrow">
        LABORATORIO DE MONTAÑAS RUSAS
      </span>

      <h1>{names[active.mapId]}</h1>
    </div>

    <div class="physics-toolbar">
      <span
        class="mode-badge"
        class:exploration={active.maxLoad > 5}
      >
        {active.maxLoad > 5
          ? "Exploración · 8 g"
          : "Límite · +5 g"}
      </span>

      {#if settings.mapId === "custom"}
        <button
          class="edit-track-button"
          type="button"
          onclick={() => {
            pause();
            editorDialog.showModal();
          }}
        >
          ✎ Editar pista
        </button>
      {/if}

      <Guide onPreset={loadPreset} />
    </div>
  </header>

  <div class="physics-layout">
    <aside class="physics-card settings">
      <form
        onsubmit={event => {
          event.preventDefault();
          apply();
        }}
        oninput={pause}
      >
        <h2>Ajustes físicos</h2>

        <label>
          Final del recorrido

          <select
            bind:value={settings.brakeMode}
            onchange={pause}
          >
            <option value="station">
              Sin resorte · frenos de estación
            </option>

            <option value="spring">
              Con resorte · permite rebote
            </option>
          </select>
        </label>

        {#each fields as field}
          {#if visible(field.key)}
            <label>
              <span>
                <MeasureIcon kind={field.icon} />
                {field.label}
              </span>

              <small>
                (mín. {field.min} · máx. {field.max}
                {field.unit})
              </small>

              <input
                type="number"
                min={field.min}
                max={field.max}
                step="any"
                required
                value={settings[field.key]}
                oninput={event =>
                  setField(
                    field.key,
                    event.currentTarget.valueAsNumber
                  )}
              />
            </label>
          {/if}
        {/each}

        <details class="mass-details">
          <summary>
            Masas · {count}
            {count === 1 ? "carrito" : "carritos"}
          </summary>

          <label>
            Carrito vacío (kg)
            <small>(1–10 000 kg)</small>

            <input
              type="number"
              min="1"
              max="10000"
              step="any"
              required
              bind:value={cartMass}
            />
          </label>

          {#each original as passenger, index}
            <label>
              Persona {passenger.id} (kg)

              <small>
                ({MIN_PASSENGER_MASS}–{MAX_PASSENGER_MASS} kg)
              </small>

              <input
                type="number"
                min={MIN_PASSENGER_MASS}
                max={MAX_PASSENGER_MASS}
                step="any"
                required
                bind:value={masses[index]}
              />
            </label>
          {/each}
        </details>

        <div class="apply-bar">
          <button class="primary" type="submit">
            Aplicar y reiniciar
          </button>

          {#if dirty}
            <small>Cambios pendientes</small>
          {/if}
        </div>

        {#if error}
          <p role="alert" class="physics-error">
            {error}
          </p>
        {/if}
      </form>
    </aside>

    <section
      class="physics-results"
      aria-label="Simulación y resultados"
    >
      <div class="physics-card stage-card">
        <div class="physics-toolbar stage-tools">
          <div class="run-buttons">
            <button
              class="primary"
              type="button"
              disabled={running ||
                dirty ||
                !designConfirmed ||
                physicalState.status !== "running"}
              onclick={() => {
                running = true;
                previous = null;
              }}
            >
              Iniciar
            </button>

            <button
              type="button"
              onclick={pause}
              disabled={!running}
            >
              Pausar
            </button>

            <button type="button" onclick={restart}>
              Reiniciar
            </button>
          </div>

          <select
            aria-label="Cámara"
            bind:value={cameraMode}
          >
            <option value="full">Recorrido completo</option>
            <option value="follow">Seguir al tren</option>
          </select>

          <label class="zoom-label">
            {zoom.toFixed(1)}×

            <input
              aria-label="Zoom"
              type="range"
              min="1"
              max="2.5"
              step=".1"
              bind:value={zoom}
              disabled={cameraMode === "full"}
            />
          </label>
        </div>

        <div class="track-frame">
          <canvas
            bind:this={canvas}
            width="1200"
            height="520"
            aria-label="Pista y tren"
          ></canvas>
        </div>

        <div class="stage-status">
          <strong>
            {!designConfirmed
              ? "Aplicá primero tu diseño"
              : running
                ? "En movimiento"
                : labels[physicalState.status] ??
                  physicalState.status}
          </strong>

          <span>
            {physicalState.section} ·
            {physicalState.time.toFixed(2)} s
          </span>
        </div>
      </div>

      <div class="physics-bottom">
        <div class="physics-card metrics-card">
          <h2>Resultados</h2>

          <dl class="physics-metrics">
            <div>
              <dt>Rapidez</dt>
              <dd>{physicalState.speed.toFixed(2)} m/s</dd>
            </div>

            <div>
              <dt>Masa total</dt>
              <dd>{active.mass.toFixed(1)} kg</dd>
            </div>

            <div>
              <dt>Normal</dt>
              <dd>{physicalState.forces.normal.toFixed(1)} N</dd>
            </div>

            <div>
              <dt>Carga normal</dt>
              <dd>{physicalState.load.toFixed(2)} g</dd>
            </div>

            <div>
              <dt>Compresión</dt>
              <dd>
                {physicalState.springCompression.toFixed(2)} m
              </dd>
            </div>

            <div>
              <dt>Resorte</dt>
              <dd>{physicalState.forces.spring.toFixed(1)} N</dd>
            </div>

            <div>
              <dt>E. mecánica</dt>
              <dd>
                {physicalState.energies.mechanical.toFixed(1)} J
              </dd>
            </div>

            <div>
              <dt>E. disipada</dt>
              <dd>
                {physicalState.energies.dissipated.toFixed(1)} J
              </dd>
            </div>

            <div>
              <dt>Error del balance</dt>
              <dd>
                {physicalState.energies.balanceError.toFixed(2)} J
              </dd>
            </div>
          </dl>
        </div>

        <div class="physics-card chart-card">
          <select
            aria-label="Gráfica"
            bind:value={chartKind}
            onchange={refreshChart}
          >
            <option value="speed">Rapidez</option>
            <option value="energy">Energías y pérdidas</option>
            <option value="normal">Fuerza normal</option>
            <option value="acceleration">Aceleraciones</option>
            <option value="load">Carga normal</option>
            <option value="spring">Energía elástica</option>
          </select>

          <div class="physics-chart">
            <canvas
              bind:this={chartCanvas}
              aria-label="Gráfica frente al tiempo"
            ></canvas>
          </div>
        </div>
      </div>

      {#if physicalState.events.length ||
        ["stalled", "timeout"].includes(physicalState.status)}
        <FailureDialog
          failedState={physicalState}
          config={active}
          onApply={applyRecommendation}
        />
      {/if}
    </section>
  </div>
</main>

<dialog
  bind:this={editorDialog}
  class="editor-modal"
  aria-labelledby="editor-title"
>
  <div class="editor-modal-heading">
    <h2 id="editor-title">Pista personalizada</h2>

    <button
      type="button"
      aria-label="Cerrar editor"
      onclick={() => editorDialog.close()}
    >
      ✕
    </button>
  </div>

  <TrackEditor
    points={settings.customPoints}
    onChange={points => {
      pause();

      settings = {
        ...settings,
        customPoints: points
      };
    }}
  />

  {#if error}
    <p role="alert" class="physics-error">
      {error}
    </p>
  {/if}

  <button
    class="primary"
    type="button"
    onclick={() => {
      if (apply()) {
        editorDialog.close();
      }
    }}
  >
    Aplicar diseño
  </button>
</dialog>