<script lang="ts">
  import type { TrackPoint } from "../lib/types";
  import { assertLoopShape, CUSTOM_LIMITS, CONFIG_LIMITS } from "../physics/index.js";
  import { formatNumber } from "../ui/format";

  import "../styles/track-editor.css";

  /** Loop por defecto al agregarlo: lágrima con c = 0,5. */
  const DEFAULT_LOOP = { loopHeight: 12, loopTopRadius: 3 };

  let {
    points,
    onChange
  }: {
    points: TrackPoint[];
    onChange: (points: TrackPoint[]) => void;
  } = $props();

  let selected = $state(1);
  let dragging = $state<number | null>(null);
  let message = $state("");

  let surface: HTMLDivElement;

  const left = 35;
  const top = 30;
  const width = 630;
  const height = 230;

  let chosen = $derived(points[selected]);

  let fixed = $derived(
    selected === 0 ||
    selected === points.length - 1
  );

  let loopCount = $derived(
    points.filter(point => point.loopHeight > 0).length
  );

  let loopBottomRadius = $derived(
    chosen && chosen.loopHeight > 0 ? chosen.loopHeight - chosen.loopTopRadius : 0
  );

  let path = $derived(
    points.map(
      (point, index) =>
        `${index ? "L" : "M"}${left + point.x * width},${top + (1 - point.y) * height}`
    ).join(" ")
  );

  function move(
    index: number,
    x: number,
    y: number
  ) {
    if (
      index === 0 ||
      index === points.length - 1 ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return;
    }

    const next = points.map(point => ({
      ...point
    }));

    next[index].x = Math.max(
      next[index - 1].x + 0.05,

      Math.min(
        next[index + 1].x - 0.05,
        x
      )
    );

    next[index].y = Math.max(
      0,
      Math.min(1, y)
    );

    onChange(next);
  }

  function pointerMove(event: PointerEvent) {
    if (dragging === null || !surface) return;

    const rectangle =
      surface.getBoundingClientRect();

    const x =
      (
        (event.clientX - rectangle.left) *
          700 / rectangle.width -
        left
      ) / width;

    const y =
      1 -
      (
        (event.clientY - rectangle.top) *
          300 / rectangle.height -
        top
      ) / height;

    move(dragging, x, y);
  }

  function changeLoop(loopHeight: number, loopTopRadius: number) {
    message = "";

    if (!chosen || fixed || !Number.isFinite(loopHeight) || !Number.isFinite(loopTopRadius)) {
      return;
    }

    const height = Math.max(0, Math.min(CONFIG_LIMITS.loopHeight[1], loopHeight));
    const topRadius = Math.max(0, Math.min(CONFIG_LIMITS.loopTopRadius[1], loopTopRadius));

    if (height > 0 && !chosen.loopHeight && loopCount >= CUSTOM_LIMITS.maxLoops) {
      message = `Ya hay ${CUSTOM_LIMITS.maxLoops} loops.`;
      return;
    }

    if (height > 0) {
      try {
        assertLoopShape(height, topRadius);
      } catch (problem) {
        message = problem instanceof Error ? problem.message : "Loop inválido.";
      }
    }

    onChange(
      points.map((point, index) =>
        index === selected
          ? { ...point, loopHeight: height, loopTopRadius: height > 0 ? topRadius : 0 }
          : { ...point }
      )
    );
  }

  function addPoint() {
    message = "";

    if (points.length >= CUSTOM_LIMITS.maxPoints) return;

    let index = 0;

    for (
      let candidate = 1;
      candidate < points.length - 1;
      candidate++
    ) {
      const available =
        points[candidate + 1].x -
        points[candidate].x;

      const current =
        points[index + 1].x -
        points[index].x;

      if (available > current) {
        index = candidate;
      }
    }

    if (
      points[index + 1].x -
      points[index].x <
      0.1
    ) {
      message =
        "No hay separación suficiente para otro punto.";

      return;
    }

    const next = points.map(point => ({
      ...point
    }));

    next.splice(index + 1, 0, {
      x:
        (
          points[index].x +
          points[index + 1].x
        ) / 2,

      y:
        (
          points[index].y +
          points[index + 1].y
        ) / 2,

      loopHeight: 0,
      loopTopRadius: 0
    });

    selected = index + 1;
    onChange(next);
  }

  function removePoint() {
    message = "";

    if (points.length <= 3 || fixed) return;

    const next = points
      .filter((_, index) => index !== selected)
      .map(point => ({ ...point }));

    selected = Math.min(
      selected,
      next.length - 2
    );

    onChange(next);
  }
</script>

<svelte:window
  onpointermove={pointerMove}
  onpointerup={() => (dragging = null)}
  onpointercancel={() => (dragging = null)}
/>

<section
  class="track-editor"
  aria-label="Editor de pista personalizada"
>
  <div class="editor-heading">
    <div>
      <span class="editor-eyebrow">
        TU PISTA, A TU MANERA
      </span>

      <h2>Diseñá el recorrido</h2>

      <p>
        Arrastrá un punto o ajustalo con
        los controles de abajo.
      </p>
    </div>

    <span class="editor-count">
      {points.length} / {CUSTOM_LIMITS.maxPoints} puntos
    </span>
  </div>

  <div
    class="editor-surface"
    bind:this={surface}
  >
    <svg
      viewBox="0 0 700 300"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="editor-grid"
          width="35"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M35 0H0V30"
            fill="none"
            stroke="#e7def0"
          />
        </pattern>
      </defs>

      <rect
        width="700"
        height="300"
        rx="16"
        fill="#f9f5ff"
      />

      <rect
        width="700"
        height="300"
        fill="url(#editor-grid)"
      />

      <path
        d={path}
        fill="none"
        stroke="#8353ae"
        stroke-width="5"
        stroke-linejoin="round"
      />

      {#each points as point}
        {#if point.loopHeight > 0}
          <circle
            cx={left + point.x * width}
            cy={top + (1 - point.y) * height - 23}
            r="23"
            fill="#f5bd4915"
            stroke="#d79a2c"
            stroke-width="4"
          />
          <text
            x={left + point.x * width}
            y={top + (1 - point.y) * height - 20}
            text-anchor="middle"
            fill="#a8741a"
            font-size="10"
            font-weight="700"
          >
            {point.loopHeight} m
          </text>
        {/if}
      {/each}

      <text
        x="35"
        y="287"
        fill="#9176a4"
        font-size="12"
      >
        Inicio y estación fijos · los puntos interiores se pueden mover
      </text>
    </svg>

    {#each points as point, index}
      <button
        type="button"
        class="editor-point"
        class:selected={selected === index}
        class:fixed-point={index === 0 || index === points.length - 1}
        style:left={`${(left + point.x * width) / 7}%`}
        style:top={`${(top + (1 - point.y) * height) / 3}%`}
        aria-label={`Punto ${index + 1}${
          index === 0 || index === points.length - 1
            ? ", posición fija"
            : ", arrastrá o usá las flechas"
        }`}
        aria-pressed={selected === index}
        onclick={() => (selected = index)}
        onpointerdown={event => {
          selected = index;

          dragging =
            index === 0 ||
            index === points.length - 1
              ? null
              : index;

          event.currentTarget.setPointerCapture(
            event.pointerId
          );
        }}
        onkeydown={event => {
          if (
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown"
            ].includes(event.key)
          ) {
            event.preventDefault();
            selected = index;

            move(
              index,

              point.x +
                (
                  event.key === "ArrowRight"
                    ? 0.01
                    : event.key === "ArrowLeft"
                      ? -0.01
                      : 0
                ),

              point.y +
                (
                  event.key === "ArrowUp"
                    ? 0.02
                    : event.key === "ArrowDown"
                      ? -0.02
                      : 0
                )
            );
          }
        }}
      >
        {index + 1}
      </button>
    {/each}
  </div>

  <div class="editor-toolbar">
    <button
      class="editor-button add-button"
      type="button"
      onclick={addPoint}
      disabled={points.length >= CUSTOM_LIMITS.maxPoints}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>

      Agregar punto
    </button>

    <button
      class="editor-button delete-button"
      type="button"
      onclick={removePoint}
      disabled={points.length <= 3 || fixed}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"
        />
      </svg>

      Eliminar punto
    </button>

    <span class="loop-count">
      {loopCount} / {CUSTOM_LIMITS.maxLoops} loops
    </span>
  </div>

  <div
    class="editor-point-tabs"
    role="group"
    aria-label="Seleccionar punto"
  >
    {#each points as point, index}
      <button
        type="button"
        class:active={selected === index}
        aria-pressed={selected === index}
        onclick={() => (selected = index)}
      >
        {index === 0
          ? "Inicio"
          : index === points.length - 1
            ? "Estación"
            : `Punto ${index + 1}`}
      </button>
    {/each}
  </div>

  {#if chosen}
    <div class="point-settings">
      <div class="point-settings-heading">
        <strong>
          {fixed
            ? "Posición fija"
            : `Editando punto ${selected + 1}`}
        </strong>

        <span>
          {fixed
            ? "No se puede mover"
            : "Los cambios quedan pendientes hasta aplicar"}
        </span>
      </div>

      {#if fixed}
        <p>
          El inicio permanece arriba y la estación
          al nivel del suelo. Seleccioná un punto
          interior para modificar el recorrido.
        </p>
      {:else}
        <div class="point-fields">
          <label>
            Posición horizontal (%)

            <input
              type="number"
              min={(points[selected - 1].x + 0.05) * 100}
              max={(points[selected + 1].x - 0.05) * 100}
              step=".1"
              value={Number((chosen.x * 100).toFixed(1))}
              onchange={event =>
                move(
                  selected,
                  event.currentTarget.valueAsNumber / 100,
                  chosen.y
                )}
            />
          </label>

          <label>
            Altura relativa (%)

            <input
              type="number"
              min="0"
              max="100"
              step=".1"
              value={Number((chosen.y * 100).toFixed(1))}
              onchange={event =>
                move(
                  selected,
                  chosen.x,
                  event.currentTarget.valueAsNumber / 100
                )}
            />
          </label>

          <label>
            Altura del loop h_L (m)

            <input
              type="number"
              min="0"
              max={CONFIG_LIMITS.loopHeight[1]}
              step=".5"
              value={chosen.loopHeight}
              onchange={event =>
                changeLoop(
                  event.currentTarget.valueAsNumber,
                  chosen.loopTopRadius || event.currentTarget.valueAsNumber / 4
                )}
            />
          </label>

          <label>
            Radio en la cima R (m)

            <input
              type="number"
              min="0"
              max={CONFIG_LIMITS.loopTopRadius[1]}
              step=".25"
              disabled={!chosen.loopHeight}
              value={chosen.loopTopRadius}
              onchange={event =>
                changeLoop(
                  chosen.loopHeight,
                  event.currentTarget.valueAsNumber
                )}
            />
          </label>
        </div>

        {#if chosen.loopHeight > 0}
          <p class="loop-derived">
            Lágrima: radio en la base R_B = h_L − R = {formatNumber(loopBottomRadius, 2)} m ·
            {Math.abs(chosen.loopTopRadius - chosen.loopHeight / 2) < 1e-9 ? "circular" : `forma c = ${formatNumber(1 - (2 * chosen.loopTopRadius) / chosen.loopHeight, 2)}`} ·
            debe cumplirse h_L ≥ 2R.
          </p>
        {/if}

        <div class="loop-tools">
          <button
            class="editor-button loop-button"
            class:remove-loop={chosen.loopHeight > 0}
            type="button"
            onclick={() =>
              chosen.loopHeight
                ? changeLoop(0, 0)
                : changeLoop(DEFAULT_LOOP.loopHeight, DEFAULT_LOOP.loopTopRadius)}
            disabled={!chosen.loopHeight && loopCount >= CUSTOM_LIMITS.maxLoops}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 20h9a7 7 0 1 0-7-7 7 7 0 0 0 7 7h9"
              />
            </svg>

            {chosen.loopHeight
              ? "Quitar loop de este punto"
              : "Agregar loop aquí"}
          </button>

          <span>Altura 0 m significa sin loop.</span>
        </div>
      {/if}
    </div>
  {/if}

  {#if message}
    <p class="editor-message" role="status">
      {message}
    </p>
  {/if}

  <p class="editor-footnote">
    La línea es una guía entre puntos.
    La curva física se actualiza con «Aplicar diseño».
    Los círculos son símbolos; la altura y los
    radios reales se calculan en metros.
  </p>
</section>
