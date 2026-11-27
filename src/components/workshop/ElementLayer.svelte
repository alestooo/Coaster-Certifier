<script lang="ts">
  import { tick, untrack } from "svelte";
  import { CircleDot, CircleOff, Mountain, Plus, Trash2 } from "lucide-svelte";
  import {
    proposeElementHandle,
    moveElement,
    setPointLoop,
    setHill,
    toggleLoop,
    removeElement,
    insertAfter,
    type ElementHandle,
    type ElementDragStart,
    type TrackEdit
  } from "../../lib/track-edit";
  import { loopHandleLayout, type ScreenPoint } from "../../lib/loop-handle-layout";
  import { toolbarPlacement } from "../../lib/toolbar-placement";
  import { onPointerRelease } from "../../lib/pointer-release";
  import { formatNumber } from "../../ui/format";
  import { letterName } from "../../lib/point-legend";
  import Sym from "../ui/Sym.svelte";
  import type { Camera } from "../../ui/renderer/camera.js";
  import type { SimulationConfig, TrackElement } from "../../lib/types";

  /**
   * Manijas de los elementos del trazado sobre el lienzo, en cualquier
   * trazado: puntos y crestas en 2D, cima y radio del loop, radio de la
   * cresta y E (solo la recta final). Con un elemento elegido aparece su
   * mini barra: agregar punto o colina, poner o quitar el loop, borrar.
   */
  interface Props {
    camera: Camera;
    handles: ElementHandle[];
    config: SimulationConfig;
    selected: number | null;
    hidden: boolean;
    onDragState: (dragging: boolean) => void;
    /** `step`: una acción discreta (agregar, borrar, loop) que es un paso de deshacer propio. */
    onTrack: (track: TrackElement[], step?: boolean) => void;
    onSelect: (index: number | null) => void;
  }

  let { camera, handles, config, selected, hidden, onDragState, onTrack, onSelect }: Props = $props();

  /** Paso del teclado en metros (Shift: ×10). */
  const KEY_STEP_M = 1;
  const BIG_STEP = 10;
  const KEY_MOVES: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  /** Pasos de las manijas de un eje: h_L de a 0,5 m, R de a 0,25 m, ρ_c de a 1 m y E de a 1 m. */
  const AXIS_STEP = { loopTop: 0.5, loopRadius: 0.25, hillRadius: 1, end: 1 } as const;
  /** Como en cualquier slider: arriba o a la derecha sube; abajo o a la izquierda baja. */
  const AXIS_DIRECTION: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };
  /** Altura mínima que se pide con el teclado: 0 significaría quitar el loop. */
  const KEY_MIN_LOOP_HEIGHT_M = 0.01;

  let layer: HTMLDivElement;
  let active = $state<string | null>(null);
  let edit = $state.raw<(TrackEdit & { id: string; index: number }) | null>(null);
  let toolbarWidth = $state(0);
  let toolbarHeight = $state(0);

  let shown = $derived(hidden ? [] : handles);
  /** Manijas que se arrastran en 2D: puntos y crestas de colina. */
  let free = $derived(shown.filter(handle => handle.kind === "point" || handle.kind === "hillCrest"));
  let loopTops = $derived(shown.filter(handle => handle.kind === "loopTop"));
  let ends = $derived(shown.filter(handle => handle.kind === "end"));
  /** El radio del loop y el de la cresta aparecen con su elemento elegido. */
  let secondary = $derived(shown.filter(handle => (handle.kind === "loopRadius" || handle.kind === "hillRadius") && handle.index === selected));
  let selectedElement = $derived(selected === null ? null : (config.track[selected] ?? null));
  let anchor = $derived(shown.find(handle => handle.index === selected && (handle.kind === "point" || handle.kind === "hillCrest" || handle.kind === "end")) ?? null);
  let selectedLoop = $derived(selectedElement?.type === "point" ? (selectedElement.loop ?? null) : null);
  let labelled = $derived(handles.find(handle => handle.id === active) ?? null);
  /** El motivo de un recorte solo se muestra para el elemento al que corresponde. */
  let reason = $derived(edit && edit.index === selected ? edit.reason : null);
  /** Dónde se dibujan la cima y el radio de cada loop (apartados de su base si el loop se ve chico). */
  let loopLayouts = $derived.by(() => {
    const layouts = new Map<number, { top: ScreenPoint; radius: ScreenPoint }>();

    for (const top of loopTops) {
      const base = free.find(handle => handle.kind === "point" && handle.index === top.index);
      const element = config.track[top.index];
      const radius = element?.type === "point" ? (element.loop?.topRadius ?? 0) : 0;
      if (!base) continue;
      layouts.set(top.index, loopHandleLayout({ x: camera.toX(base.x), y: camera.toY(base.y) }, { x: camera.toX(top.x), y: camera.toY(top.y) }, radius * camera.scale));
    }

    return layouts;
  });
  /** La mini barra: arriba del elemento (y de su loop) si entra, si no debajo (ver `toolbarPlacement`). */
  let toolbarAt = $derived.by(() => {
    if (!anchor) return null;

    const pointY = camera.toY(anchor.y);
    const loopTopY = selectedLoop && selected !== null ? (loopLayouts.get(selected)?.top.y ?? null) : null;
    const topY = loopTopY !== null ? Math.min(pointY, loopTopY) : pointY;
    return toolbarPlacement({ x: camera.toX(anchor.x), pointY, topY }, { width: toolbarWidth, height: toolbarHeight }, { width: camera.width, height: camera.height });
  });
  let toolbarName = $derived.by(() => {
    if (!selectedElement || selected === null) return "";
    if (selectedElement.type === "hill") return `Colina ${config.track.slice(0, selected + 1).filter(element => element.type === "hill").length}`;
    if (selectedElement.type === "end") return "Final del trazado";
    return `Punto ${selected + 1}`;
  });

  // Elegir otro elemento descarta el motivo del anterior.
  $effect(() => {
    const current = selected;
    untrack(() => {
      if (edit && edit.index !== current) edit = null;
    });
  });

  function place(x: number, y: number) {
    return `${camera.toX(x)}px ${camera.toY(y)}px`;
  }

  function placeHandle(handle: ElementHandle) {
    if (handle.kind !== "loopTop" && handle.kind !== "loopRadius") return place(handle.x, handle.y);
    const layout = loopLayouts.get(handle.index);
    if (!layout) return place(handle.x, handle.y);
    const at = handle.kind === "loopTop" ? layout.top : layout.radius;
    return `${at.x}px ${at.y}px`;
  }

  function world(event: PointerEvent) {
    const rect = layer.getBoundingClientRect();
    return { x: camera.fromX(event.clientX - rect.left), y: camera.fromY(event.clientY - rect.top) };
  }

  function apply(id: string, index: number, next: TrackEdit, step = false) {
    edit = { ...next, id, index };
    onTrack(next.track, step);
  }

  /** Manija y puntero al empezar el arrastre (referencia de los radios). */
  let dragStart: ElementDragStart | null = null;
  /** Deja de escuchar en la ventana el fin del gesto (ver `onPointerRelease`). */
  let stopRelease: (() => void) | null = null;

  function start(event: PointerEvent, handle: ElementHandle) {
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
    if (handle) apply(id, handle.index, proposeElementHandle(config, handle, world(event), dragStart ?? undefined));
  }

  function end(id: string) {
    if (active !== id) return;
    const handle = handles.find(candidate => candidate.id === id);
    stopRelease?.();
    stopRelease = null;
    active = null;
    dragStart = null;
    onDragState(false);
    if (handle) onSelect(handle.index);
  }

  async function refocus(id: string) {
    await tick();
    layer.querySelector<HTMLElement>(`[data-handle="${id}"]`)?.focus();
  }

  /** Teclado de las manijas 2D: flechas mueven 1 m (Shift: 10 m), Enter elige, Supr borra. */
  function freeKey(event: KeyboardEvent, handle: ElementHandle) {
    if (event.key === "Enter") {
      event.preventDefault();
      onSelect(handle.index);
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
    apply(handle.id, handle.index, proposeElementHandle(config, handle, { x: handle.x + delta[0] * step, y: handle.y + delta[1] * step }));
    onSelect(handle.index);
    refocus(handle.id);
  }

  /** Valor y texto hablado de una manija de un eje. */
  function axisValue(handle: ElementHandle): { value: number; text: string } {
    const element = config.track[handle.index];
    if (handle.kind === "end") return { value: handle.x, text: `E en x = ${formatNumber(handle.x, 1)} m` };
    if (element?.type === "hill") return { value: element.crestRadius, text: `Radio de la cresta: ${formatNumber(element.crestRadius, 1)} m` };
    const loop = element?.type === "point" ? element.loop : undefined;
    if (handle.kind === "loopTop") return { value: loop?.height ?? 0, text: `Altura del loop: ${formatNumber(loop?.height ?? 0, 1)} m` };
    return { value: loop?.topRadius ?? 0, text: `Radio en la cima: ${formatNumber(loop?.topRadius ?? 0, 2)} m` };
  }

  /** Teclado de las manijas de un eje: como un slider. */
  function axisKey(event: KeyboardEvent, handle: ElementHandle) {
    const direction = AXIS_DIRECTION[event.key];
    const element = config.track[handle.index];
    if (!direction || !element || handle.kind === "point" || handle.kind === "hillCrest") return;

    event.preventDefault();
    const step = AXIS_STEP[handle.kind] * (event.shiftKey ? BIG_STEP : 1) * direction;
    let next: TrackEdit;

    if (handle.kind === "end" && element.type === "end") next = moveElement(config, handle.index, element.x + step);
    else if (handle.kind === "hillRadius" && element.type === "hill") next = setHill(config, handle.index, { crestRadius: element.crestRadius + step });
    else if (element.type === "point" && element.loop) {
      next =
        handle.kind === "loopTop"
          ? setPointLoop(config, handle.index, Math.max(KEY_MIN_LOOP_HEIGHT_M, element.loop.height + step), element.loop.topRadius)
          : setPointLoop(config, handle.index, element.loop.height, element.loop.topRadius + step);
    } else return;

    apply(handle.id, handle.index, next);
    onSelect(handle.index);
  }

  function addAfter(kind: "point" | "hill") {
    if (selected === null) return;

    const result = insertAfter(config, selected, kind);
    if ("error" in result) {
      edit = { track: config.track, limited: true, reason: result.error, id: `toolbar-${selected}`, index: selected };
      return;
    }

    onTrack(result.track, true);
    onSelect(result.index);
  }

  function switchLoop() {
    if (selected === null) return;
    apply(`point-${selected}`, selected, toggleLoop(config, selected), true);
  }

  function remove(index: number) {
    const result = removeElement(config, index);
    if (!result) return;

    // Si sin él el trazado no se construye, queda elegido y su barra explica por qué.
    if ("error" in result) {
      edit = { track: config.track, limited: true, reason: result.error, id: `toolbar-${index}`, index };
      onSelect(index);
      return;
    }

    onTrack(result.track, true);
    onSelect(null);
  }
</script>

<div class="elements" bind:this={layer}>
  {#if selectedElement && selected !== null}
    <svg class="guides" aria-hidden="true">
      {#if selectedLoop}
        {@const top = loopTops.find(handle => handle.index === selected)}
        {#if top}
          <circle cx={camera.toX(top.x)} cy={camera.toY(top.y - selectedLoop.topRadius)} r={selectedLoop.topRadius * camera.scale} />
        {/if}
      {/if}
      {#if selectedElement.type === "hill"}
        {@const radius = secondary.find(handle => handle.kind === "hillRadius")}
        {#if radius?.anchor}
          {@const y = camera.toY(0) + 10}
          <line x1={camera.toX(radius.anchor.x)} y1={y} x2={camera.toX(radius.x)} y2={y} />
          <line x1={camera.toX(radius.anchor.x)} y1={y - 5} x2={camera.toX(radius.anchor.x)} y2={y + 5} />
          <line x1={camera.toX(radius.x)} y1={y - 5} x2={camera.toX(radius.x)} y2={y + 5} />
        {/if}
      {/if}
    </svg>
  {/if}

  {#each free as handle (handle.id)}
    <button
      type="button"
      class="point"
      class:crest={handle.kind === "hillCrest"}
      class:selected={handle.index === selected}
      class:active={active === handle.id}
      data-handle={handle.id}
      style:translate={place(handle.x, handle.y)}
      aria-label={handle.name}
      aria-pressed={handle.index === selected}
      title={`${handle.letter ? `${handle.letter}: ${letterName(handle.letter)} · ` : ""}arrastrá para mover · flechas: 1 m · Supr: borrar`}
      onpointerdown={event => start(event, handle)}
      onpointermove={event => move(event, handle.id)}
      onpointerup={() => end(handle.id)}
      onpointercancel={() => end(handle.id)}
      onlostpointercapture={() => end(handle.id)}
      onkeydown={event => freeKey(event, handle)}
    >
      {#if handle.letter}<span aria-hidden="true">{handle.letter}</span>{/if}
    </button>
  {/each}

  {#each [...loopTops, ...secondary, ...ends] as handle (handle.id)}
    {@const value = axisValue(handle)}
    <button
      type="button"
      class="axis-handle {handle.kind}"
      class:editing={handle.index === selected}
      class:active={active === handle.id}
      data-handle={handle.id}
      style:translate={placeHandle(handle)}
      role="slider"
      aria-label={handle.name}
      aria-valuenow={value.value}
      aria-valuetext={value.text}
      aria-orientation={handle.kind === "loopTop" ? "vertical" : "horizontal"}
      title={handle.letter ? `${handle.letter}: ${letterName(handle.letter)}` : undefined}
      onpointerdown={event => start(event, handle)}
      onpointermove={event => move(event, handle.id)}
      onpointerup={() => end(handle.id)}
      onpointercancel={() => end(handle.id)}
      onlostpointercapture={() => end(handle.id)}
      onkeydown={event => axisKey(event, handle)}
    >
      {#if handle.letter}<span aria-hidden="true">{handle.letter}</span>{/if}
    </button>
  {/each}

  {#if selectedElement && anchor && toolbarAt && !active}
    <div
      class="toolbar"
      class:below={toolbarAt.below}
      style:translate={`${toolbarAt.x}px ${toolbarAt.y}px`}
      bind:offsetWidth={toolbarWidth}
      bind:offsetHeight={toolbarHeight}
      role="toolbar"
      aria-label={toolbarName}
    >
      <button type="button" onclick={() => addAfter("point")}><Plus size={14} /> Agregar punto</button>
      <button type="button" onclick={() => addAfter("hill")}><Mountain size={14} /> Agregar colina</button>
      {#if selectedElement.type === "point"}
        <button type="button" onclick={switchLoop}>
          {#if selectedLoop}<CircleOff size={14} /> Quitar loop{:else}<CircleDot size={14} /> Agregar loop{/if}
        </button>
      {/if}
      {#if selectedElement.type === "point" || selectedElement.type === "hill"}
        <button type="button" class="danger" onclick={() => selected !== null && remove(selected)}>
          <Trash2 size={14} /> {selectedElement.type === "hill" ? "Borrar colina" : "Borrar punto"}
        </button>
      {/if}
      {#if reason}<em role="status">{reason}</em>{/if}
    </div>
  {/if}

  {#if labelled}
    {@const element = config.track[labelled.index]}
    <div class="label" style:translate={place(labelled.x, labelled.y)}>
      <strong>
        {#if labelled.kind === "point"}
          x {formatNumber(labelled.x, 1)} m · altura {formatNumber(labelled.y, 1)} m
        {:else if labelled.kind === "hillCrest" && element?.type === "hill"}
          x {formatNumber(element.x, 1)} m · <Sym symbol="h_c" /> = {formatNumber(element.height, 1)} m
        {:else if labelled.kind === "hillRadius" && element?.type === "hill"}
          <Sym symbol="ρ_c" /> = {formatNumber(element.crestRadius, 1)} m
        {:else if labelled.kind === "end"}
          E en x = {formatNumber(labelled.x, 1)} m
        {:else if element?.type === "point" && element.loop}
          <Sym symbol="h_L" /> = {formatNumber(element.loop.height, 1)} m · R = {formatNumber(element.loop.topRadius, 2)} m
        {/if}
      </strong>
      {#if edit?.id === labelled.id && edit.reason}<em>{edit.reason}</em>{/if}
    </div>
  {/if}
</div>

<style>
  .elements {
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

  .guides circle,
  .guides line {
    fill: none;
    stroke: var(--handle);
    stroke-width: 1.4;
    stroke-dasharray: 5 4;
  }

  .point,
  .axis-handle,
  .toolbar,
  .label {
    position: absolute;
    top: 0;
    left: 0;
  }

  .point {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    margin: -10px 0 0 -10px;
    padding: 0;
    border: 3px solid var(--primary);
    border-radius: 50%;
    background: var(--surface);
    color: var(--primary-strong);
    font: inherit;
    font-size: 10px;
    font-weight: var(--weight-black);
    cursor: move;
    pointer-events: auto;
    touch-action: none;
    box-shadow: 0 2px 6px rgb(40 20 70 / 25%);
    transition: scale 0.12s, background 0.12s;
  }

  .point.crest {
    border-color: var(--handle);
  }

  .point::before,
  .axis-handle::before {
    content: "";
    position: absolute;
    inset: -10px;
    border-radius: 50%;
  }

  .point:hover,
  .point:focus-visible {
    scale: 1.15;
    outline: none;
    box-shadow: var(--focus-ring), 0 2px 6px rgb(40 20 70 / 25%);
  }

  .point.selected {
    background: var(--primary-soft);
  }

  .point.active {
    scale: 1.2;
  }

  .axis-handle {
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    margin: -7px 0 0 -7px;
    padding: 0;
    border: 2.5px solid var(--handle);
    border-radius: 3px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 9px;
    font-weight: var(--weight-black);
    rotate: 45deg;
    pointer-events: auto;
    touch-action: none;
    box-shadow: 0 2px 6px rgb(40 20 70 / 25%);
  }

  /* La letra no recibe el puntero: el toque y el hit-test caen siempre en la manija. */
  .point span,
  .axis-handle span {
    pointer-events: none;
  }

  .axis-handle span {
    rotate: -45deg;
  }

  .axis-handle.loopTop {
    cursor: ns-resize;
  }

  .axis-handle.loopRadius,
  .axis-handle.hillRadius {
    cursor: ew-resize;
  }

  /* E: círculo con su letra, como las manijas principales; se mueve solo en horizontal. */
  .axis-handle.end {
    width: 20px;
    height: 20px;
    margin: -10px 0 0 -10px;
    border: 3px solid var(--primary);
    border-radius: 50%;
    color: var(--primary-strong);
    font-size: 10px;
    rotate: 0deg;
    cursor: ew-resize;
  }

  .axis-handle.end span {
    rotate: 0deg;
  }

  .axis-handle.active,
  .axis-handle:focus-visible {
    background: var(--handle);
    outline: none;
  }

  .axis-handle.end.active,
  .axis-handle.end:focus-visible {
    background: var(--primary-soft);
    box-shadow: var(--focus-ring);
  }

  /* El elemento elegido y su loop quedan sobre los pines: son lo que se está editando. */
  .point.selected,
  .axis-handle.editing {
    z-index: 3;
  }

  /* Por encima de los pines y de la sonda: es la herramienta que se está usando. */
  .toolbar {
    z-index: 4;
    display: flex;
    flex-wrap: wrap;
    width: max-content;
    max-width: calc(100% - 16px);
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow);
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
    font-size: var(--text-12);
    font-style: normal;
    font-weight: var(--weight-bold);
    line-height: 1.4;
    color: var(--warn-text);
    white-space: normal;
  }

  .toolbar button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--surface-soft);
    color: var(--text-soft);
    font: inherit;
    font-size: var(--text-12);
    font-weight: var(--weight-bold);
    cursor: pointer;
  }

  .toolbar button:hover {
    background: var(--primary-soft);
    color: var(--primary-strong);
  }

  .toolbar button:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .toolbar button.danger:hover {
    background: var(--danger-soft);
    color: var(--danger-text);
  }

  .label {
    z-index: 4;
    display: grid;
    gap: 1px;
    width: max-content;
    max-width: 260px;
    padding: 6px 10px;
    border-radius: var(--radius-md);
    background: var(--tooltip-bg);
    color: var(--tooltip-text);
    font-size: var(--text-12);
    transform: translate(-50%, calc(-100% - 20px));
    pointer-events: none;
  }

  .label em {
    font-style: normal;
    font-weight: var(--weight-bold);
    color: var(--tooltip-accent);
  }

  @media (prefers-reduced-motion: reduce) {
    .point {
      transition: none;
    }
  }
</style>
