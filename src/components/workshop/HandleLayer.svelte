<script lang="ts">
  import { tick } from "svelte";
  import NumberField from "../ui/NumberField.svelte";
  import Sym from "../ui/Sym.svelte";
  import { letterName } from "../../lib/point-legend";
  import { onPointerRelease } from "../../lib/pointer-release";
  import { proposeDrag, proposeValue, handleText, type Handle, type HandleId, type DragProposal, type DragStart } from "../../lib/handles";
  import { fieldByKey, limitsOf } from "../../lib/field-definitions";
  import type { Camera } from "../../ui/renderer/camera.js";
  import type { AreaId } from "../../lib/audit";
  import type { SimulationConfig } from "../../lib/types";

  interface MarkerBadge {
    label: string;
    x: number;
    y: number;
    /** Sobre la vía en lugar de encima del punto (cuando ahí ya hay una manija). */
    raised?: boolean;
  }

  interface Props {
    camera: Camera;
    handles: Handle[];
    markers: MarkerBadge[];
    selectedArea: AreaId | null;
    /** Durante la reproducción solo quedan las letras, sin manijas. */
    hidden: boolean;
    config: SimulationConfig;
    onDragState: (dragging: boolean) => void;
    onPatch: (patch: Partial<SimulationConfig>) => void;
    onSelect: (area: AreaId) => void;
  }

  let { camera, handles, markers, selectedArea, hidden, config, onDragState, onPatch, onSelect }: Props = $props();

  /** Multiplicador del paso con Shift o Re Pág / Av Pág. */
  const BIG_STEP = 10;
  const KEY_DIRECTIONS: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: BIG_STEP, PageDown: -BIG_STEP };

  let layer: HTMLDivElement;
  let active = $state<HandleId | null>(null);
  /** Manija y puntero al empezar el arrastre (referencia de las manijas relativas, como R). */
  let dragStart: DragStart | null = null;
  let focused = $state<HandleId | null>(null);
  let editing = $state<HandleId | null>(null);
  /** Última propuesta, con la manija a la que pertenece: su motivo se muestra hasta la próxima interacción. */
  let proposal = $state.raw<(DragProposal & { id: HandleId }) | null>(null);

  let visible = $derived(hidden ? [] : handles.filter(handle => handle.primary || handle.area === selectedArea || handle.id === active));
  let letters = $derived(new Set(visible.map(handle => handle.letter).filter(Boolean)));
  let badges = $derived(markers.filter(marker => !letters.has(marker.label)));
  let labelled = $derived(visible.find(handle => handle.id === (active ?? editing ?? focused)) ?? null);
  let text = $derived(labelled ? handleText(labelled, labelled.value, config) : null);
  let guides = $derived(guideShapes());

  /** Posición en pantalla para la propiedad `transform`. */
  function at(x: number, y: number) {
    return `translate(${camera.toX(x)}px, ${camera.toY(y)}px)`;
  }

  /**
   * Posición para la propiedad `translate`: se compone después de `rotate`
   * y `scale`, así las manijas giradas (rombos) no se desplazan al girar.
   */
  function place(x: number, y: number) {
    return `${camera.toX(x)}px ${camera.toY(y)}px`;
  }

  function fresh(id: HandleId): Handle | undefined {
    return handles.find(handle => handle.id === id);
  }

  function pointerWorld(event: PointerEvent) {
    const rect = layer.getBoundingClientRect();
    return { x: camera.fromX(event.clientX - rect.left), y: camera.fromY(event.clientY - rect.top) };
  }

  function apply(id: HandleId, next: DragProposal) {
    proposal = { ...next, id };
    onPatch(next.patch);
  }

  async function refocus(id: HandleId) {
    await tick();
    layer.querySelector<HTMLElement>(`[data-handle="${id}"]`)?.focus();
  }

  /** Deja de escuchar en la ventana el fin del gesto (ver `onPointerRelease`). */
  let stopRelease: (() => void) | null = null;

  function start(event: PointerEvent, handle: Handle) {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    (event.currentTarget as HTMLElement).focus();
    active = handle.id;
    dragStart = { handle, point: pointerWorld(event) };
    proposal = null;
    // Si la manija desaparece en pleno gesto, soltar en cualquier lado lo termina igual.
    stopRelease = onPointerRelease(window, () => end(handle.id));
    onDragState(true);
  }

  function move(event: PointerEvent, id: HandleId) {
    if (active !== id) return;

    const handle = fresh(id);
    if (handle) apply(id, proposeDrag(handle, pointerWorld(event), config, dragStart ?? undefined));
  }

  function end(id: HandleId) {
    if (active !== id) return;

    const handle = fresh(id);
    stopRelease?.();
    stopRelease = null;
    active = null;
    dragStart = null;
    onDragState(false);
    if (handle) onSelect(handle.area);
  }

  function key(event: KeyboardEvent, handle: Handle) {
    if (event.key === "Enter") {
      event.preventDefault();
      editing = handle.id;
      return;
    }

    const direction = KEY_DIRECTIONS[event.key];
    if (!direction) return;

    event.preventDefault();
    const step = fieldByKey(handle.key)?.step ?? 0.1;
    const multiplier = event.shiftKey ? BIG_STEP : 1;
    apply(handle.id, proposeValue(handle, handle.value + direction * multiplier * step, config));
  }

  function commitTyped(id: HandleId, value: number) {
    const handle = fresh(id);
    if (handle) apply(id, proposeValue(handle, value, config));
    closeTyped(id);
  }

  function closeTyped(id: HandleId) {
    if (editing !== id) return;
    editing = null;
    refocus(id);
  }

  /** Guías de las manijas secundarias del área seleccionada (px). */
  function guideShapes() {
    if (hidden) return { circle: null, arrow: null, span: null };

    const top = fresh("loopTop");
    const radius = fresh("loopRadius");
    const speed = fresh("speed");
    const foot = fresh("hillFoot");

    const circle =
      selectedArea === "loop" && top && radius
        ? { cx: camera.toX(top.x), cy: camera.toY(top.y - radius.value), r: radius.value * camera.scale, hx: camera.toX(radius.x), hy: camera.toY(radius.y) }
        : null;

    const arrow =
      selectedArea === "start" && speed?.anchor && speed.value > 0
        ? { x1: camera.toX(speed.anchor.x), y1: camera.toY(speed.anchor.y), x2: camera.toX(speed.x), y2: camera.toY(speed.y) }
        : null;

    const span =
      selectedArea === "hill" && foot?.anchor
        ? { x1: camera.toX(foot.anchor.x), x2: camera.toX(foot.x), y: camera.toY(0) + 10 }
        : null;

    return { circle, arrow, span };
  }
</script>

<div class="handles" bind:this={layer}>
  <svg class="guides" aria-hidden="true">
    <defs>
      <marker id="speed-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" style:fill="var(--handle)" />
      </marker>
    </defs>
    {#if guides.circle}
      <circle cx={guides.circle.cx} cy={guides.circle.cy} r={guides.circle.r} class="guide" />
      <line x1={guides.circle.cx} y1={guides.circle.cy} x2={guides.circle.hx} y2={guides.circle.hy} class="guide thin" />
      <circle cx={guides.circle.cx} cy={guides.circle.cy} r="2.5" class="guide-dot" />
    {/if}
    {#if guides.arrow}
      <line x1={guides.arrow.x1} y1={guides.arrow.y1} x2={guides.arrow.x2} y2={guides.arrow.y2} class="arrow" marker-end="url(#speed-head)" />
    {/if}
    {#if guides.span}
      <line x1={guides.span.x1} y1={guides.span.y} x2={guides.span.x2} y2={guides.span.y} class="guide thin" />
      <line x1={guides.span.x1} y1={guides.span.y - 5} x2={guides.span.x1} y2={guides.span.y + 5} class="guide thin" />
      <line x1={guides.span.x2} y1={guides.span.y - 5} x2={guides.span.x2} y2={guides.span.y + 5} class="guide thin" />
    {/if}
  </svg>

  {#each badges as marker (marker.label)}
    <span class="badge" class:raised={marker.raised} style:transform={at(marker.x, marker.y)} role="img" aria-label={`${marker.label}: ${letterName(marker.label)}`} title={`${marker.label}: ${letterName(marker.label)}`}>{marker.label}</span>
  {/each}

  {#each visible as handle (handle.id)}
    {@const limits = limitsOf(handle.key)}
    {@const label = handleText(handle, handle.value, config).label}
    <button
      type="button"
      class="handle axis-{handle.axis}"
      class:primary={handle.primary}
      class:selected={handle.area === selectedArea}
      class:active={active === handle.id}
      data-handle={handle.id}
      style:translate={place(handle.x, handle.y)}
      role="slider"
      aria-label={handle.name}
      aria-valuemin={limits[0]}
      aria-valuemax={limits[1]}
      aria-valuenow={handle.value}
      aria-valuetext={label}
      aria-orientation={handle.axis === "y" ? "vertical" : "horizontal"}
      title={handle.letter ? `${handle.letter}: ${letterName(handle.letter)}` : undefined}
      onpointerdown={event => start(event, handle)}
      onpointermove={event => move(event, handle.id)}
      onpointerup={() => end(handle.id)}
      onpointercancel={() => end(handle.id)}
      onlostpointercapture={() => end(handle.id)}
      onkeydown={event => key(event, handle)}
      onfocus={() => (focused = handle.id)}
      onblur={() => {
        if (focused === handle.id) focused = null;
      }}
      ondblclick={() => (editing = handle.id)}
    >
      {#if handle.letter}<span>{handle.letter}</span>{/if}
    </button>

    {#if editing === handle.id}
      <!-- Al salir (Enter, Esc o clic afuera) se cierra y el foco vuelve a la manija. -->
      <div class="typed" style:transform={at(handle.x, handle.y)} onfocusout={() => closeTyped(handle.id)}>
        <NumberField
          value={handle.value}
          step={fieldByKey(handle.key)?.step ?? 0.1}
          unit={fieldByKey(handle.key)?.unit ?? ""}
          label={`${handle.name}: escribí el valor`}
          autofocus
          onCommit={value => commitTyped(handle.id, value)}
        />
      </div>
    {/if}
  {/each}

  {#if labelled && text && editing !== labelled.id}
    <div class="label" style:transform={at(labelled.x, labelled.y)} role="presentation">
      <strong>{#if text.symbol}<Sym symbol={text.symbol} spoken={text.label} /><span aria-hidden="true"> = {text.value}</span>{:else}{text.value}{/if}</strong>
      {#if text.detail}<span>{text.detail}</span>{/if}
      {#if proposal?.limited && proposal.id === labelled.id}
        <em>{proposal.reason ?? "Se ajustó al límite permitido."}</em>
      {/if}
    </div>
  {/if}
</div>

<style>
  .handles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .guides {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .guide {
    fill: none;
    stroke: var(--handle);
    stroke-width: 1.6;
    stroke-dasharray: 5 4;
  }

  .guide.thin {
    stroke-width: 1.2;
  }

  .guide-dot {
    fill: var(--handle);
  }

  .arrow {
    stroke: var(--handle);
    stroke-width: 3;
    stroke-linecap: round;
  }

  .badge,
  .handle,
  .typed,
  .label {
    position: absolute;
    top: 0;
    left: 0;
  }

  .badge {
    pointer-events: auto;
    cursor: help;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    margin: -10px 0 0 -10px;
    border: 2px solid white;
    border-radius: 50%;
    background: var(--primary-strong);
    color: white;
    font-size: 10px;
    font-weight: 900;
    box-shadow: 0 2px 6px rgb(40 20 70 / 25%);
  }

  .handle {
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    margin: -7px 0 0 -7px;
    padding: 0;
    border: 2.5px solid var(--handle);
    border-radius: 3px;
    background: white;
    color: var(--primary-strong);
    font: inherit;
    font-size: 10.5px;
    font-weight: 900;
    pointer-events: auto;
    touch-action: none;
    box-shadow: 0 2px 6px rgb(40 20 70 / 25%);
    transition: background 0.12s, scale 0.12s, box-shadow 0.12s;
    rotate: 45deg;
  }

  .handle > span {
    rotate: -45deg;
  }

  /* Área de captura generosa para el dedo sin agrandar el dibujo. */
  .handle::before {
    content: "";
    position: absolute;
    inset: -10px;
    border-radius: 50%;
  }

  .handle.primary {
    width: 22px;
    height: 22px;
    margin: -11px 0 0 -11px;
    border-color: var(--primary);
    border-radius: 50%;
    rotate: 0deg;
  }

  .handle.primary > span {
    rotate: 0deg;
  }

  .axis-y {
    cursor: ns-resize;
  }

  .axis-x {
    cursor: ew-resize;
  }

  .axis-tangent {
    cursor: move;
  }

  .handle:hover,
  .handle:focus-visible {
    scale: 1.18;
    outline: none;
    box-shadow: 0 0 0 4px rgb(122 75 198 / 22%), 0 2px 6px rgb(40 20 70 / 25%);
  }

  .handle.selected {
    background: var(--primary-soft);
  }

  .handle.active {
    scale: 1.22;
    background: var(--primary);
    color: white;
  }

  .handle:not(.primary).active {
    background: var(--handle);
  }

  .typed {
    margin: -50px 0 0 -48px;
    padding: var(--space-1);
    border-radius: var(--radius-md);
    background: var(--surface);
    pointer-events: auto;
    box-shadow: var(--shadow-lg);
  }

  .label {
    display: grid;
    gap: 1px;
    width: max-content;
    max-width: 260px;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgb(45 33 64 / 92%);
    color: white;
    font-size: 11.5px;
    line-height: 1.35;
    translate: -50% calc(-100% - 20px);
    pointer-events: none;
    box-shadow: var(--shadow);
  }

  .label strong {
    font-size: 13px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  .label span {
    color: rgb(255 255 255 / 78%);
  }

  .label em {
    font-style: normal;
    font-weight: 800;
    color: var(--tooltip-accent);
  }

  @media (prefers-reduced-motion: reduce) {
    .handle {
      transition: none;
    }
  }

  /* En el personalizado B, C y D caen sobre un punto editable: la letra va arriba, sin taparlo. */
  .badge.raised {
    margin-top: -32px;
  }
</style>
