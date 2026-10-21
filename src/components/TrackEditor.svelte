<script lang="ts">
  export type TrackPoint = {
    x: number;
    y: number;
    loopRadius: number;
  };

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
    points.filter(point => point.loopRadius > 0).length
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

  function changeRadius(radius: number) {
    message = "";

    if (
      !chosen ||
      fixed ||
      !Number.isFinite(radius)
    ) {
      return;
    }

    if (
      radius > 0 &&
      !chosen.loopRadius &&
      loopCount >= 3
    ) {
      message = "Ya hay tres loops.";
      return;
    }

    onChange(
      points.map((point, index) =>
        index === selected
          ? {
              ...point,

              loopRadius: Math.max(
                0,
                Math.min(15, radius)
              )
            }
          : { ...point }
      )
    );
  }

  function addPoint() {
    message = "";

    if (points.length >= 9) return;

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

      loopRadius: 0
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
      {points.length} / 9 puntos
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
        {#if point.loopRadius > 0}
          <circle
            cx={left + point.x * width}
            cy={top + (1 - point.y) * height - 23}
            r="23"
            fill="#f5bd4915"
            stroke="#d79a2c"
            stroke-width="4"
          />
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
      disabled={points.length >= 9}
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
      {loopCount} / 3 loops
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
            Radio del loop (m)

            <input
              type="number"
              min="0"
              max="15"
              step=".1"
              value={chosen.loopRadius}
              onchange={event =>
                changeRadius(
                  event.currentTarget.valueAsNumber
                )}
            />
          </label>
        </div>

        <div class="loop-tools">
          <button
            class="editor-button loop-button"
            class:remove-loop={chosen.loopRadius > 0}
            type="button"
            onclick={() =>
              changeRadius(
                chosen.loopRadius ? 0 : 2
              )}
            disabled={!chosen.loopRadius && loopCount >= 3}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 20h9a7 7 0 1 0-7-7 7 7 0 0 0 7 7h9"
              />
            </svg>

            {chosen.loopRadius
              ? "Quitar loop de este punto"
              : "Agregar loop aquí"}
          </button>

          <span>0 m significa sin loop.</span>
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
    Los círculos son símbolos; su radio real
    se calcula en metros.
  </p>
</section>

<style>
  .track-editor {
    padding: 20px;
    background: white;
    border: 1px solid #e6daef;
    border-radius: 18px;
    margin: 18px 0;
    color: #674b7e;
  }

  .editor-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 15px;
  }

  .editor-eyebrow {
    font-size: 9px;
    letter-spacing: 1.6px;
    color: #a487b8;
  }

  .editor-heading h2 {
    font-size: 23px;
    margin: 5px 0 6px;
  }

  .editor-heading p {
    margin: 0;
    font-size: 12px;
    color: #9982a9;
  }

  .editor-count,
  .loop-count {
    padding: 8px 11px;
    background: #f1e9f8;
    color: #80559c;
    border-radius: 9px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }

  .editor-surface {
    position: relative;
    touch-action: none;
  }

  .editor-surface > svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .track-editor button {
    box-sizing: border-box;
    font: inherit;
    cursor: pointer;
    transition:
      background 0.16s,
      box-shadow 0.16s,
      border-color 0.16s;
  }

  .track-editor button:focus-visible,
  .track-editor input:focus-visible {
    outline: 3px solid #c9a4e3;
    outline-offset: 3px;
  }

  .editor-surface .editor-point {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 34px;
    height: 34px;
    padding: 0;
    border: 3px solid white;
    border-radius: 50%;
    background: #aa86c3;
    color: white;
    font-weight: 750;
    font-size: 12px;
    box-shadow: 0 3px 10px #70418b22;
    touch-action: none;
    cursor: grab;
  }

  .editor-surface .editor-point.selected {
    background: #704095;
    box-shadow:
      0 0 0 5px #9e6dc52c,
      0 4px 14px #70418b22;
  }

  .editor-surface .editor-point:active {
    cursor: grabbing;
  }

  .editor-surface .editor-point.fixed-point {
    background: #b5a7bf;
    cursor: pointer;
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin: 18px 0 14px;
  }

  .track-editor .editor-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 15px;
    border-radius: 11px;
    border: 1px solid transparent;
    font-size: 12px;
    font-weight: 650;
    min-height: 42px;
  }

  .editor-button svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    flex-shrink: 0;
  }

  .track-editor .add-button {
    background: #7850a0;
    color: white;
    box-shadow: 0 4px 10px #7850a025;
  }

  .track-editor .add-button:hover {
    background: #62388b;
  }

  .track-editor .delete-button {
    background: #fff1f4;
    color: #b35e76;
    border-color: #f0d4dc;
  }

  .track-editor .delete-button:hover {
    background: #ffe5ec;
  }

  .track-editor .editor-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }

  .loop-count {
    margin-left: auto;
    background: #fff3dc;
    color: #ab7b2f;
  }

  .editor-point-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  .editor-point-tabs button {
    padding: 7px 10px;
    border: 1px solid #e7dcef;
    border-radius: 8px;
    background: white;
    color: #9a7eae;
    font-size: 11px;
  }

  .editor-point-tabs button.active {
    background: #f0e5f9;
    border-color: #cfaee4;
    color: #704095;
  }

  .point-settings {
    padding: 16px;
    border-radius: 13px;
    border: 1px solid #e9dff2;
    background: #fbf8fe;
  }

  .point-settings-heading {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .point-settings-heading strong {
    font-size: 13px;
  }

  .point-settings-heading span {
    font-size: 10px;
    color: #a18aaf;
  }

  .point-settings p {
    font-size: 12px;
    line-height: 1.6;
    margin: 0;
  }

  .point-fields {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .point-fields label {
    display: grid;
    gap: 7px;
    font-size: 11px;
    color: #8c6ba2;
  }

  .point-fields input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    border: 1px solid #dccce8;
    background: white;
    border-radius: 9px;
    padding: 10px 12px;
    color: #684a7e;
    font: inherit;
    font-size: 13px;
  }

  .loop-tools {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 14px;
  }

  .track-editor .loop-button {
    background: #f8e8c7;
    color: #936521;
    border-color: #efd29a;
  }

  .track-editor .loop-button:hover {
    background: #f3dba9;
  }

  .track-editor .loop-button.remove-loop {
    background: #fff1f4;
    color: #b35e76;
    border-color: #f0d4dc;
  }

  .loop-tools > span {
    font-size: 11px;
    color: #a18aaf;
  }

  .editor-message {
    padding: 10px;
    border-radius: 9px;
    background: #fff3dc;
    color: #9c7130;
    font-size: 12px;
  }

  .editor-footnote {
    font-size: 11px;
    line-height: 1.7;
    color: #a18aaf;
    margin: 14px 0 0;
  }

  @media (max-width: 600px) {
    .track-editor {
      padding: 14px;
    }

    .editor-heading {
      align-items: flex-start;
    }

    .editor-heading h2 {
      font-size: 20px;
    }

    .point-fields {
      grid-template-columns: 1fr;
    }

    .editor-surface .editor-point {
      width: 29px;
      height: 29px;
      font-size: 10px;
    }

    .loop-count {
      margin-left: 0;
    }
  }
</style>