<script lang="ts">
  import { tick, untrack } from "svelte";
  import { CircleDot, CircleOff, Plus, Trash2 } from "lucide-svelte";
  import { proposePointHandle, toggleLoop, removePoint, insertAfter, setPointLoop, type PointHandle, type PointEdit, type PointDragStart } from "../../lib/custom-points";
  import { loopHandleLayout, type ScreenPoint } from "../../lib/loop-handle-layout";
  import { toolbarPlacement } from "../../lib/toolbar-placement";
  import { formatNumber } from "../../ui/format";
  import { onPointerRelease } from "../../lib/pointer-release";
  import type { Camera } from "../../ui/renderer/camera.js";
  import type { SimulationConfig, TrackPoint } from "../../lib/types";

  interface Props {
    camera: Camera;
    handles: PointHandle[];
    config: SimulationConfig;
    selectedPoint: number | null;
    hidden: boolean;
    onDragState: (dragging: boolean) => void;
    onPoints: (points: TrackPoint[]) => void;
    onSelectPoint: (index: number | null) => void;
  }

  let { camera, handles, config, selectedPoint, hidden, onDragState, onPoints, onSelectPoint }: Props = $props();

  /** Paso del teclado en metros (Shift: ×10). */
  const KEY_STEP_M = 1;
  const BIG_STEP = 10;
  const KEY_MOVES: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  /** Paso del teclado en las manijas del loop (m): h_L de a 0,5 y R de a 0,25 (Shift: ×10). */
  const LOOP_KEY_STEP_M = { loopTop: 0.5, loopRadius: 0.25 } as const;
  /** Como en cualquier slider: arriba o a la derecha sube; abajo o a la izquierda baja. */
  const LOOP_KEY_DIRECTION: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };
  /** Altura mínima que se pide con el teclado: 0 significaría quitar el loop. */
  const KEY_MIN_LOOP_HEIGHT_M = 0.01;

  let layer: HTMLDivElement;
  let active = $state<string | null>(null);
  let edit = $state.raw<(PointEdit & { id: string; index: number }) | null>(null);
  let toolbarWidth = $state(0);
  let toolbarHeight = $state(0);


  let points = $derived(hidden ? [] : handles.filter(handle => handle.kind === "point"));
  let loopTops = $derived(hidden ? [] : handles.filter(handle => handle.kind === "loopTop"));
  let loopRadius = $derived(hidden ? null : (handles.find(handle => handle.kind === "loopRadius" && handle.index === selectedPoint) ?? null));
  let selected = $derived(points.find(handle => handle.index === selectedPoint) ?? null);
  let selectedHasLoop = $derived(selectedPoint !== null && (config.customPoints[selectedPoint]?.loopHeight ?? 0) > 0);
  let labelled = $derived(handles.find(handle => handle.id === active) ?? null);
  /** El motivo de un recorte solo se muestra para el punto al que corresponde. */
  let reason = $derived(edit && edit.index === selectedPoint ? edit.reason : null);
  /** Dónde se dibujan la cima y el radio de cada loop (apartados de su base si el loop se ve chico). */
  let loopLayouts = $derived.by(() => {
    const layouts = new Map<number, { top: ScreenPoint; radius: ScreenPoint }>();

    for (const top of loopTops) {
      const base = points.find(handle => handle.index === top.index);
      const radius = config.customPoints[top.index]?.loopTopRadius ?? 0;
      if (!base) continue;
      layouts.set(
        top.index,
        loopHandleLayout({ x: camera.toX(base.x), y: camera.toY(base.y) }, { x: camera.toX(top.x), y: camera.toY(top.y) }, radius * camera.scale)
      );
    }

    return layouts;
  });
  /** Cima del loop del punto elegido, en pantalla: la mini barra va por encima para no tapar su manija. */
  let selectedLoopTopY = $derived(selectedHasLoop && selectedPoint !== null ? (loopLayouts.get(selectedPoint)?.top.y ?? null) : null);
  /** La mini barra: arriba del loop si entra, si no debajo del punto (ver `toolbarPlacement`). */
  let toolbarAt = $derived.by(() => {
    if (!selected) return null;

    const pointY = camera.toY(selected.y);
    const topY = selectedLoopTopY !== null ? Math.min(pointY, selectedLoopTopY) : pointY;
    return toolbarPlacement(
      { x: camera.toX(selected.x), pointY, topY },
      { width: toolbarWidth, height: toolbarHeight },
      { width: camera.width, height: camera.height }
    );
  });

  // Elegir otro punto descarta el motivo del anterior.
  $effect(() => {
    const current = selectedPoint;
    untrack(() => {
      if (edit && edit.index !== current) edit = null;
    });
  });

  function place(x: number, y: number) {
    return `${camera.toX(x)}px ${camera.toY(y)}px`;
  }

  function placeLoopHandle(handle: PointHandle) {
    const layout = loopLayouts.get(handle.index);
    if (!layout) return place(handle.x, handle.y);

    const at = handle.kind === "loopTop" ? layout.top : layout.radius;
    return `${at.x}px ${at.y}px`;
  }

  function pointName(handle: PointHandle) {
    return `Punto ${handle.index + 1}: x ${formatNumber(handle.x, 1)} m, altura ${formatNumber(handle.y, 1)} m`;
  }

  function world(event: PointerEvent) {
    const rect = layer.getBoundingClientRect();
    return { x: camera.fromX(event.clientX - rect.left), y: camera.fromY(event.clientY - rect.top) };
  }

  function apply(id: string, next: PointEdit) {
    const index = handles.find(handle => handle.id === id)?.index ?? selectedPoint ?? -1;
    edit = { ...next, id, index };
    onPoints(next.points);
  }

  /** Manija y puntero al empezar el arrastre (referencia del radio del loop). */
  let dragStart: PointDragStart | null = null;
  /** Deja de escuchar en la ventana el fin del gesto (ver `onPointerRelease`). */
  let stopRelease: (() => void) | null = null;

  function proposal(handle: PointHandle, target: { x: number; y: number }): PointEdit {
    return proposePointHandle(config, handle, target, dragStart ?? undefined);
  }

  function start(event: PointerEvent, handle: PointHandle) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    (event.currentTarget as HTMLElement).focus();
    active = handle.id;
    dragStart = { handle, point: world(event) };
    edit = null;
    // Si la manija desaparece en pleno gesto (deshacer, reproducir), soltar en cualquier lado lo termina igual.
    stopRelease = onPointerRelease(window, () => end(handle.id));
    onDragState(true);
  }

  function move(event: PointerEvent, id: string) {
    if (active !== id) return;
    const handle = handles.find(candidate => candidate.id === id);
    if (handle) apply(id, proposal(handle, world(event)));
  }

  function end(id: string) {
    if (active !== id) return;
    const handle = handles.find(candidate => candidate.id === id);
    stopRelease?.();
    stopRelease = null;
    active = null;
    dragStart = null;
    onDragState(false);
    if (handle) onSelectPoint(handle.index);
  }

  async function refocus(index: number) {
    await tick();
    layer.querySelector<HTMLElement>(`[data-point="${index}"]`)?.focus();
  }

  function key(event: KeyboardEvent, handle: PointHandle) {
    if (event.key === "Enter") {
      event.preventDefault();
      onSelectPoint(handle.index);
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      remove(handle.index);
      return;
    }

    const delta = KEY_MOVES[event.key];
    if (!delta) return;

    event.preventDefault();
    const step = KEY_STEP_M * (event.shiftKey ? BIG_STEP : 1);
    apply(handle.id, proposal(handle, { x: handle.x + delta[0] * step, y: handle.y + delta[1] * step }));
    onSelectPoint(handle.index);
    refocus(handle.index);
  }

  function loopKey(event: KeyboardEvent, handle: PointHandle) {
    const direction = LOOP_KEY_DIRECTION[event.key];
    const point = config.customPoints[handle.index];
    if (!direction || !point || handle.kind === "point") return;

    event.preventDefault();
    const step = LOOP_KEY_STEP_M[handle.kind] * (event.shiftKey ? BIG_STEP : 1) * direction;
    const next =
      handle.kind === "loopTop"
        ? setPointLoop(config, handle.index, Math.max(KEY_MIN_LOOP_HEIGHT_M, point.loopHeight + step), point.loopTopRadius)
        : setPointLoop(config, handle.index, point.loopHeight, point.loopTopRadius + step);
    apply(handle.id, next);
    onSelectPoint(handle.index);
  }

  /** «Agregar punto»: el camino sin doble clic (teclado y tacto). */
  function addPoint() {
    if (selectedPoint === null) return;

    const result = insertAfter(config, selectedPoint);
    if ("error" in result) {
      edit = { points: config.customPoints, limited: true, reason: result.error, id: `point-${selectedPoint}`, index: selectedPoint };
      return;
    }

    onPoints(result.points);
    onSelectPoint(result.index);
  }

  function switchLoop() {
    if (selectedPoint === null) return;
    apply(`point-${selectedPoint}`, toggleLoop(config, selectedPoint));
  }

  function remove(index: number) {
    const next = removePoint(config, index);
    if (!next) return;
    onPoints(next);
    onSelectPoint(null);
  }
</script>

<div class="points" bind:this={layer}>
  {#if selected && loopRadius}
    {@const top = loopTops.find(handle => handle.index === selected.index)}
    {#if top}
      <svg class="guides" aria-hidden="true">
        <circle
          cx={camera.toX(top.x)}
          cy={camera.toY(top.y - config.customPoints[selected.index].loopTopRadius)}
          r={config.customPoints[selected.index].loopTopRadius * camera.scale}
        />
      </svg>
    {/if}
  {/if}

  {#each points as handle (handle.id)}
    <button
      type="button"
      class="point"
      class:selected={handle.index === selectedPoint}
      class:active={active === handle.id}
      data-point={handle.index}
      style:translate={place(handle.x, handle.y)}
      aria-label={pointName(handle)}
      aria-pressed={handle.index === selectedPoint}
      title="Arrastrá para mover · flechas: 1 m · Supr: borrar"
      onpointerdown={event => start(event, handle)}
      onpointermove={event => move(event, handle.id)}
      onpointerup={() => end(handle.id)}
      onpointercancel={() => end(handle.id)}
      onlostpointercapture={() => end(handle.id)}
      onkeydown={event => key(event, handle)}
    ></button>
  {/each}

  {#each [...loopTops, ...(loopRadius ? [loopRadius] : [])] as handle (handle.id)}
    {@const point = config.customPoints[handle.index]}
    <button
      type="button"
      class="loop-handle {handle.kind}"
      class:editing={handle.index === selectedPoint}
      class:active={active === handle.id}
      style:translate={placeLoopHandle(handle)}
      role="slider"
      aria-label={handle.kind === "loopTop" ? `Cima del loop del punto ${handle.index + 1}: altura h_L` : `Radio en la cima del loop del punto ${handle.index + 1}`}
      aria-valuenow={handle.kind === "loopTop" ? point.loopHeight : point.loopTopRadius}
      aria-valuetext={handle.kind === "loopTop" ? `h_L = ${formatNumber(point.loopHeight, 1)} m` : `R = ${formatNumber(point.loopTopRadius, 2)} m`}
      onpointerdown={event => start(event, handle)}
      onpointermove={event => move(event, handle.id)}
      onpointerup={() => end(handle.id)}
      onpointercancel={() => end(handle.id)}
      onlostpointercapture={() => end(handle.id)}
      onkeydown={event => loopKey(event, handle)}
    ></button>
  {/each}

  {#if selected && toolbarAt && !active}
    <div
      class="toolbar"
      class:below={toolbarAt.below}
      style:translate={`${toolbarAt.x}px ${toolbarAt.y}px`}
      bind:offsetWidth={toolbarWidth}
      bind:offsetHeight={toolbarHeight}
      role="toolbar"
      aria-label={`Punto ${selected.index + 1}`}
    >
      <button type="button" onclick={addPoint}><Plus size={14} /> Agregar punto</button>
      <button type="button" onclick={switchLoop}>
        {#if selectedHasLoop}<CircleOff size={14} /> Quitar loop{:else}<CircleDot size={14} /> Agregar loop{/if}
      </button>
      <button type="button" class="danger" disabled={!removePoint(config, selected.index)} onclick={() => remove(selected.index)}>
        <Trash2 size={14} /> Borrar punto
      </button>
      {#if reason}<em role="status">{reason}</em>{/if}
    </div>
  {/if}

  {#if labelled}
    {@const point = config.customPoints[labelled.index]}
    <div class="label" style:translate={place(labelled.x, labelled.y)}>
      {#if labelled.kind === "point"}
        <strong>x {formatNumber(labelled.x, 1)} m · altura {formatNumber(labelled.y, 1)} m</strong>
      {:else}
        <strong>h_L = {formatNumber(point.loopHeight, 1)} m · R = {formatNumber(point.loopTopRadius, 2)} m</strong>
      {/if}
      {#if edit?.id === labelled.id && edit.reason}<em>{edit.reason}</em>{/if}
    </div>
  {/if}
</div>

<style>
  .points {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .guides {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .guides circle {
    fill: none;
    stroke: #d9822b;
    stroke-width: 1.4;
    stroke-dasharray: 5 4;
  }

  .point,
  .loop-handle,
  .toolbar,
  .label {
    position: absolute;
    top: 0;
    left: 0;
  }

  .point {
    width: 18px;
    height: 18px;
    margin: -9px 0 0 -9px;
    padding: 0;
    border: 3px solid var(--primary);
    border-radius: 50%;
    background: white;
    cursor: move;
    pointer-events: auto;
    touch-action: none;
    box-shadow: 0 2px 6px rgb(40 20 70 / 25%);
    transition: scale 0.12s, background 0.12s;
  }

  .point::before,
  .loop-handle::before {
    content: "";
    position: absolute;
    inset: -10px;
    border-radius: 50%;
  }

  .point:hover,
  .point:focus-visible {
    scale: 1.2;
    outline: none;
    box-shadow: 0 0 0 4px rgb(122 75 198 / 22%), 0 2px 6px rgb(40 20 70 / 25%);
  }

  .point.selected {
    background: var(--primary-soft);
  }

  .point.active {
    scale: 1.25;
    background: var(--primary);
  }

  .loop-handle {
    width: 13px;
    height: 13px;
    margin: -6.5px 0 0 -6.5px;
    padding: 0;
    border: 2.5px solid #d9822b;
    border-radius: 3px;
    background: white;
    rotate: 45deg;
    pointer-events: auto;
    touch-action: none;
    box-shadow: 0 2px 6px rgb(40 20 70 / 25%);
  }

  .loop-handle.loopTop {
    cursor: ns-resize;
  }

  .loop-handle.loopRadius {
    cursor: ew-resize;
  }

  .loop-handle.active,
  .loop-handle:focus-visible {
    background: #d9822b;
    outline: none;
  }

  /* El punto elegido y su loop quedan sobre los pines: son lo que se está editando. */
  .point.selected,
  .loop-handle.editing {
    z-index: 3;
  }

  /* Por encima de los pines y de la sonda: es la herramienta que se está usando. */
  .toolbar {
    z-index: 4;
    display: flex;
    flex-wrap: wrap;
    max-width: min(400px, calc(100% - 16px));
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow);
    translate: 0 0;
    transform: translate(-50%, calc(-100% - 18px));
    pointer-events: auto;
    white-space: nowrap;
  }

  .toolbar.below {
    transform: translate(-50%, 18px);
  }

  .toolbar em {
    flex-basis: 100%;
    padding: 4px 6px 2px;
    font-size: 11.5px;
    font-style: normal;
    font-weight: 700;
    line-height: 1.4;
    color: #8a5a12;
    white-space: normal;
  }

  .toolbar button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: var(--surface-soft);
    color: var(--text-soft);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .toolbar button:hover:not(:disabled) {
    background: var(--primary-soft);
    color: var(--primary-strong);
  }

  .toolbar button.danger:hover:not(:disabled) {
    background: var(--danger-soft);
    color: #b7303f;
  }

  .toolbar button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .label {
    z-index: 4;
    display: grid;
    gap: 1px;
    width: max-content;
    max-width: 260px;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgb(45 33 64 / 92%);
    color: white;
    font-size: 12px;
    transform: translate(-50%, calc(-100% - 20px));
    pointer-events: none;
  }

  .label em {
    font-style: normal;
    font-weight: 800;
    color: #ffd18a;
  }

  @media (prefers-reduced-motion: reduce) {
    .point {
      transition: none;
    }
  }
</style>
