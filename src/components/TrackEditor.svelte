<script lang="ts">
  import { Plus, Trash2, RefreshCw, Mountain, Ruler, Wand2, ArrowUp, ArrowDown } from "lucide-svelte";
  import { CUSTOM_LIMITS, CONFIG_LIMITS, assertLoopShape } from "../physics/index.js";
  import { trackToSvg, metresGrid, type TrackSvgOk } from "../ui/track-svg";
  import type { SimulationConfig, TrackPoint } from "../lib/types";
  import { formatNumber } from "../ui/format";

  import "../styles/track-editor.css";

  let {
    config,
    onChange,
    onPatch
  }: {
    config: SimulationConfig;
    onChange: (points: TrackPoint[]) => void;
    onPatch: (patch: Partial<SimulationConfig>) => void;
  } = $props();

  /** Loop por defecto al agregarlo: lágrima con c = 0,5. */
  const DEFAULT_LOOP = { loopHeight: 12, loopTopRadius: 3 };
  const KEY_STEP_X = 0.01;
  const METRE = 1;

  const TEMPLATES: { id: string; label: string; build: (H: number) => TrackPoint[] }[] = [
    {
      id: "valley",
      label: "Valle",
      build: () => relative([[0, 1], [0.3, 0], [0.55, 0.45], [0.8, 0], [1, 0]])
    },
    {
      id: "double",
      label: "Doble colina",
      build: () => relative([[0, 1], [0.22, 0], [0.4, 0.5], [0.58, 0.05], [0.76, 0.35], [0.9, 0], [1, 0]])
    },
    {
      id: "loop",
      label: "Loop central",
      build: H => {
        const loopHeight = Math.min(CONFIG_LIMITS.loopHeight[1], Math.max(4, Math.round(H * 0.55)));
        const points = relative([[0, 1], [0.3, 0], [0.7, 0], [1, 0]]);
        return points.map((point, index) =>
          index === 1 ? { ...point, loopHeight, loopTopRadius: Math.round(loopHeight / 4 * 2) / 2 } : point
        );
      }
    }
  ];

  let selected = $state(1);
  let dragging = $state<number | null>(null);
  let frozen = $state<TrackSvgOk | null>(null);
  let lastValid = $state<TrackSvgOk | null>(null);
  let message = $state("");
  let trueScale = $state(false);
  let svgElement = $state<SVGSVGElement>();

  let points = $derived(config.customPoints);
  let H = $derived(config.initialHeight);
  let W = $derived(config.trackWidth);

  let result = $derived(
    trackToSvg(config, { padding: 6, minHeight: H, minWidth: W, verticalScale: trueScale ? 1 : "auto", maxVerticalScale: 3 })
  );

  $effect(() => {
    if (result.ok) lastValid = result;
  });

  let projection = $derived(frozen ?? (result.ok ? result : lastValid));
  let error = $derived(result.ok ? "" : result.error);
  let errorIndex = $derived(result.ok ? -1 : parseErrorIndex(result.error));
  let grid = $derived(projection ? metresGrid(projection) : null);

  let handles = $derived(
    projection
      ? points.map(point => {
          const position = projection.toSvg(point.x * W, point.y * H);
          return { left: (position.x / projection.width) * 100, top: (position.y / projection.height) * 100 };
        })
      : []
  );

  let guide = $derived(
    projection
      ? points.map(point => {
          const position = projection.toSvg(point.x * W, point.y * H);
          return `${position.x.toFixed(1)},${position.y.toFixed(1)}`;
        }).join(" ")
      : ""
  );

  let crests = $derived(
    projection
      ? projection.markers
          .filter(marker => marker.role === "crest")
          .map(marker => ({ ...marker, height: projection.fromSvg(marker.x, marker.y).y }))
      : []
  );

  let chosen = $derived(points[selected]);
  let fixed = $derived(selected === 0 || selected === points.length - 1);
  let loopCount = $derived(points.filter(point => point.loopHeight > 0).length);

  function relative(pairs: [number, number][]): TrackPoint[] {
    return pairs.map(([x, y]) => ({ x, y, loopHeight: 0, loopTopRadius: 0 }));
  }

  function parseErrorIndex(text: string): number {
    const match = /punto (\d+)/i.exec(text);
    return match ? Number(match[1]) - 1 : -1;
  }

  function copy(source: TrackPoint[]): TrackPoint[] {
    return source.map(point => ({ ...point }));
  }

  function move(index: number, x: number, y: number) {
    if (index <= 0 || index >= points.length - 1 || !Number.isFinite(x) || !Number.isFinite(y)) return;

    const next = copy(points);
    const spacing = CUSTOM_LIMITS.minSpacing;

    next[index] = {
      ...next[index],
      x: Math.round(Math.max(next[index - 1].x + spacing, Math.min(next[index + 1].x - spacing, x)) * 1000) / 1000,
      y: Math.round(Math.max(0, Math.min(1, y)) * 1000) / 1000
    };

    onChange(next);
  }

  function pointerToMetres(event: PointerEvent) {
    const base = frozen ?? projection;

    if (!svgElement || !base) return null;

    const matrix = svgElement.getScreenCTM();
    if (!matrix) return null;

    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return base.fromSvg(local.x, local.y);
  }

  function startDrag(event: PointerEvent, index: number) {
    selected = index;
    message = "";

    if (index === 0 || index === points.length - 1) return;

    dragging = index;
    frozen = projection;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent) {
    if (dragging === null) return;

    const metres = pointerToMetres(event);
    if (!metres) return;

    move(dragging, metres.x / W, metres.y / H);
  }

  function endDrag() {
    dragging = null;
    frozen = null;
  }

  function keyMove(event: KeyboardEvent, index: number) {
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP_X, 0],
      ArrowRight: [KEY_STEP_X, 0],
      ArrowUp: [0, METRE / H],
      ArrowDown: [0, -METRE / H]
    };

    const delta = deltas[event.key];
    if (!delta) return;

    event.preventDefault();
    selected = index;
    move(index, points[index].x + delta[0], points[index].y + delta[1]);
  }

  function changeLoop(loopHeight: number, loopTopRadius: number) {
    message = "";

    if (!chosen || fixed || !Number.isFinite(loopHeight) || !Number.isFinite(loopTopRadius)) return;

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
        index === selected ? { ...point, loopHeight: height, loopTopRadius: height > 0 ? topRadius : 0 } : { ...point }
      )
    );
  }

  function addPoint() {
    message = "";

    if (points.length >= CUSTOM_LIMITS.maxPoints) return;

    let widest = 0;

    for (let index = 1; index < points.length - 1; index++) {
      if (points[index + 1].x - points[index].x > points[widest + 1].x - points[widest].x) widest = index;
    }

    if (points[widest + 1].x - points[widest].x < 2 * CUSTOM_LIMITS.minSpacing) {
      message = "No hay separación suficiente para otro punto.";
      return;
    }

    const next = copy(points);
    next.splice(widest + 1, 0, {
      x: Math.round(((points[widest].x + points[widest + 1].x) / 2) * 1000) / 1000,
      y: Math.round(((points[widest].y + points[widest + 1].y) / 2) * 1000) / 1000,
      loopHeight: 0,
      loopTopRadius: 0
    });

    selected = widest + 1;
    onChange(next);
  }

  function removePoint() {
    message = "";

    if (points.length <= CUSTOM_LIMITS.minPoints || fixed) return;

    const next = copy(points).filter((_, index) => index !== selected);
    selected = Math.min(selected, next.length - 2);
    onChange(next);
  }

  function applyTemplate(id: string) {
    const template = TEMPLATES.find(item => item.id === id);
    if (!template) return;

    message = "";
    selected = 1;
    onChange(template.build(H));
  }

  function numberFrom(event: Event) {
    return (event.currentTarget as HTMLInputElement).valueAsNumber;
  }
</script>

<svelte:window onpointermove={pointerMove} onpointerup={endDrag} onpointercancel={endDrag} />

<section class="track-editor" aria-label="Editor de pista personalizada">
  <header class="editor-heading">
    <div>
      <span class="editor-eyebrow">
        {projection && projection.verticalScale > 1.05 ? `HORIZONTAL 1:1 · VERTICAL ×${projection.verticalScale.toFixed(1)}` : "ESCALA REAL 1:1"} · METROS
      </span>
      <h2>Diseñá el recorrido</h2>
      <p>Arrastrá los puntos sobre la vía, agregá loops y ajustá la altura y el ancho. La curva que ves es la que simula el motor.</p>
    </div>

    <div class="editor-templates" role="group" aria-label="Plantillas rápidas">
      <Wand2 size={15} aria-hidden="true" />
      {#each TEMPLATES as template}
        <button type="button" class="chip" onclick={() => applyTemplate(template.id)}>{template.label}</button>
      {/each}
      <button type="button" class="chip scale-toggle" aria-pressed={trueScale} onclick={() => (trueScale = !trueScale)} title="Alternar entre escala real y altura exagerada para editar con comodidad">
        <Ruler size={13} aria-hidden="true" /> {trueScale ? "1:1" : "Altura ×"}
      </button>
    </div>
  </header>

  <div class="editor-stage" class:invalid={Boolean(error)} class:dragging={dragging !== null}>
    {#if projection && grid}
      <svg bind:this={svgElement} viewBox={projection.viewBox} aria-hidden="true">
        <defs>
          <linearGradient id="editor-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#eee7fb" />
            <stop offset="1" stop-color="#ffffff" />
          </linearGradient>
        </defs>

        <rect width={projection.width} height={projection.height} rx="14" fill="url(#editor-sky)" />
        <rect x="0" y={projection.groundY} width={projection.width} height={projection.height - projection.groundY} fill="#dcecd9" />

        <g class="grid">
          {#each grid.vertical as line}
            <line x1={line.position} y1="0" x2={line.position} y2={projection.groundY} class:major={line.major} />
            {#if line.label}
              <text x={line.position} y={projection.height - 8} text-anchor="middle">{line.label}</text>
            {/if}
          {/each}
          {#each grid.horizontal as line}
            <line x1="0" y1={line.position} x2={projection.width} y2={line.position} class:major={line.major} />
            {#if line.label}
              <text x="6" y={line.position - 3}>{line.label}</text>
            {/if}
          {/each}
        </g>

        <rect class="station" x={projection.station.x} y={projection.station.y} width={projection.station.width} height={projection.station.height} rx="3" />
        <text class="station-label" x={projection.station.x + projection.station.width / 2} y={projection.station.y - 6} text-anchor="middle">Estación</text>
        <rect class="brake" x={projection.brake.x} y={projection.brake.y} width={projection.brake.width} height={projection.brake.height} />

        <polyline class="guide" points={guide} />
        <path class="rail-shadow" d={projection.path} />
        <path class="rail" d={projection.path} />

        {#each projection.loops as loop}
          <text class="loop-label" x={loop.topX} y={loop.topY - 10} text-anchor="middle">
            h_L {formatNumber(loop.height, 1)} m · R {formatNumber(loop.topRadius, 1)} m
          </text>
        {/each}

        {#each crests as crest}
          <text class="crest-label" x={crest.x} y={crest.y - 24} text-anchor="middle">{formatNumber(crest.height, 1)} m</text>
        {/each}

        {#each projection.markers as marker}
          {#if marker.role === "loop-top" || marker.role === "crest"}
            <g class="marker" transform={`translate(${marker.x + 30} ${marker.y - 2})`}>
              <circle r="9" />
              <text y="3.5" text-anchor="middle">{marker.label}</text>
            </g>
          {/if}
        {/each}
      </svg>

      {#each points as point, index}
        <button
          type="button"
          class="editor-point"
          class:selected={selected === index}
          class:fixed-point={index === 0 || index === points.length - 1}
          class:has-loop={point.loopHeight > 0}
          class:erroneous={errorIndex === index}
          style:left={`${handles[index]?.left ?? 0}%`}
          style:top={`${handles[index]?.top ?? 0}%`}
          aria-label={`Punto ${index + 1}: x ${formatNumber(point.x * W, 1)} m, altura ${formatNumber(point.y * H, 1)} m${index === 0 || index === points.length - 1 ? ", posición fija" : ", arrastrá o usá las flechas"}`}
          aria-pressed={selected === index}
          onclick={() => (selected = index)}
          onpointerdown={event => startDrag(event, index)}
          onkeydown={event => keyMove(event, index)}
        >
          {index === 0 ? "A" : index === points.length - 1 ? "F" : index + 1}
        </button>
      {/each}
    {/if}
  </div>

  {#if error}
    <p class="editor-error" role="alert">{error}</p>
  {/if}

  <div class="editor-scale">
    <label>
      <span><Ruler size={14} aria-hidden="true" /> Altura inicial H</span>
      <input type="range" min={CONFIG_LIMITS.initialHeight[0]} max={CONFIG_LIMITS.initialHeight[1]} step="0.5" value={H} oninput={event => onPatch({ initialHeight: numberFrom(event) })} />
      <strong>{formatNumber(H, 1)} m</strong>
    </label>

    <label>
      <span><Ruler size={14} aria-hidden="true" /> Ancho del trazado W</span>
      <input type="range" min={CONFIG_LIMITS.trackWidth[0]} max={CONFIG_LIMITS.trackWidth[1]} step="5" value={W} oninput={event => onPatch({ trackWidth: numberFrom(event) })} />
      <strong>{formatNumber(W, 0)} m</strong>
    </label>
  </div>

  <div class="editor-toolbar">
    <button type="button" class="tool primary" onclick={addPoint} disabled={points.length >= CUSTOM_LIMITS.maxPoints}>
      <Plus size={16} aria-hidden="true" /> Agregar punto
    </button>
    <button type="button" class="tool danger" onclick={removePoint} disabled={points.length <= CUSTOM_LIMITS.minPoints || fixed}>
      <Trash2 size={16} aria-hidden="true" /> Eliminar
    </button>
    <button type="button" class="tool" onclick={() => chosen && move(selected, chosen.x, chosen.y + METRE / H)} disabled={fixed}>
      <ArrowUp size={16} aria-hidden="true" /> +1 m
    </button>
    <button type="button" class="tool" onclick={() => chosen && move(selected, chosen.x, chosen.y - METRE / H)} disabled={fixed}>
      <ArrowDown size={16} aria-hidden="true" /> −1 m
    </button>
    <button type="button" class="tool" onclick={() => applyTemplate("valley")}>
      <RefreshCw size={16} aria-hidden="true" /> Reiniciar
    </button>

    <span class="counter">{points.length} / {CUSTOM_LIMITS.maxPoints} puntos · {loopCount} / {CUSTOM_LIMITS.maxLoops} loops</span>
  </div>

  {#if chosen}
    <div class="point-settings">
      <div class="point-settings-heading">
        <strong>{fixed ? (selected === 0 ? "Inicio A (fijo)" : "Estación F (fija)") : `Punto ${selected + 1}`}</strong>
        <span>x = {formatNumber(chosen.x * W, 1)} m · altura = {formatNumber(chosen.y * H, 1)} m</span>
      </div>

      {#if fixed}
        <p>El inicio permanece a la altura H y la estación al nivel del suelo. Seleccioná un punto interior para modificarlo.</p>
      {:else}
        <div class="point-fields">
          <label>
            Posición x (m)
            <input type="number" min={(points[selected - 1].x + CUSTOM_LIMITS.minSpacing) * W} max={(points[selected + 1].x - CUSTOM_LIMITS.minSpacing) * W} step="0.5" value={Number((chosen.x * W).toFixed(1))} onchange={event => move(selected, numberFrom(event) / W, chosen.y)} />
          </label>
          <label>
            Altura (m)
            <input type="number" min="0" max={H} step="0.5" value={Number((chosen.y * H).toFixed(1))} onchange={event => move(selected, chosen.x, numberFrom(event) / H)} />
          </label>
          <label>
            Altura del loop h_L (m)
            <input type="number" min="0" max={CONFIG_LIMITS.loopHeight[1]} step="0.5" value={chosen.loopHeight} onchange={event => changeLoop(numberFrom(event), chosen.loopTopRadius || numberFrom(event) / 4)} />
          </label>
          <label>
            Radio en la cima R (m)
            <input type="number" min="0" max={CONFIG_LIMITS.loopTopRadius[1]} step="0.25" disabled={!chosen.loopHeight} value={chosen.loopTopRadius} onchange={event => changeLoop(chosen.loopHeight, numberFrom(event))} />
          </label>
        </div>

        <div class="loop-tools">
          <button type="button" class="tool loop" class:remove-loop={chosen.loopHeight > 0} onclick={() => (chosen.loopHeight ? changeLoop(0, 0) : changeLoop(DEFAULT_LOOP.loopHeight, DEFAULT_LOOP.loopTopRadius))} disabled={!chosen.loopHeight && loopCount >= CUSTOM_LIMITS.maxLoops}>
            <Mountain size={16} aria-hidden="true" />
            {chosen.loopHeight ? "Quitar loop" : "Agregar loop aquí"}
          </button>

          {#if chosen.loopHeight > 0}
            <span>Lágrima: R_B = h_L − R = <strong>{formatNumber(chosen.loopHeight - chosen.loopTopRadius, 2)} m</strong> en la base · debe cumplirse h_L ≥ 2R.</span>
          {:else}
            <span>Un loop se ancla en este punto; se recomienda a nivel del suelo.</span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {#if message}
    <p class="editor-message" role="status">{message}</p>
  {/if}

  {#if projection}
    <dl class="editor-stats">
      <div><dt>Longitud total</dt><dd>{formatNumber(projection.track.totalLength, 1)} m</dd></div>
      <div><dt>Altura máxima</dt><dd>{formatNumber(projection.track.maxHeight, 1)} m</dd></div>
      <div><dt>Loops</dt><dd>{projection.track.loops.length}</dd></div>
      <div><dt>Puntos</dt><dd>{points.length}</dd></div>
      <div><dt>H · W</dt><dd>{formatNumber(H, 1)} m · {formatNumber(W, 0)} m</dd></div>
    </dl>
  {/if}
</section>
