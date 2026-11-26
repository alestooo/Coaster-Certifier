<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { X } from "lucide-svelte";
  import HandleLayer from "./HandleLayer.svelte";
  import PlaybackPill from "./PlaybackPill.svelte";
  import ZoomControls from "./ZoomControls.svelte";
  import LoadLegend from "./LoadLegend.svelte";
  import IssuePins from "./IssuePins.svelte";
  import LoadError from "../LoadError.svelte";
  import { workshopParts } from "../../lib/workshop-parts";
  import TrackProbe from "./TrackProbe.svelte";
  import PointLayer from "./PointLayer.svelte";
  import { pointHandles, insertPoint } from "../../lib/custom-points";
  import { probeAt, probeLines } from "../../lib/probe";
  import type { FixSearch } from "../../lib/fix-search.svelte";
  import { renderSimulation, RENDER_DEFAULT_OPTIONS, MIN_ZOOM, MAX_ZOOM, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM, frameViewAbove, fitBounds } from "../../ui/renderer/index.js";
  import { createCamera, liftProfile, type Camera, type CameraView } from "../../ui/renderer/camera.js";
  import { createFrameLoop, type FrameLoop } from "../../lib/frame-loop";
  import { wheelZoomFactor, zoomAround, pinchPose, type PinchStart, type Viewport } from "../../lib/camera-gestures";
  import { handlesFor } from "../../lib/handles";
  import { nearestTrackPoint, areaAtDistance, areaBounds } from "../../lib/track-hit";
  import { focusRanges } from "../../lib/track-focus";
  import { geometryAt, buildTrack } from "../../physics/index.js";
  import { loadProfile, ribbonRuns } from "../../lib/load-profile";
  import type { AuditResult } from "../../lib/live-audit.svelte";
  import type { SimulationConfig, Track, TrackPoint } from "../../lib/types";
  import type { DesignSession } from "../../lib/design-session.svelte";
  import type { AuditReport, AreaId } from "../../lib/audit";
  import type { Passenger } from "../../game/passengers";

  interface Props {
    session: DesignSession;
    passengers: Passenger[];
    report: AuditReport | null;
    /** Recorrido auditado: alimenta la franja de fuerza g. */
    result: AuditResult | null;
    /** Corrección que se previsualiza como pista fantasma. */
    ghost?: SimulationConfig | null;
    fixes: FixSearch;
    openIssue: number | null;
    /** Aviso en el pin cuando la reproducción terminó en un incumplimiento. */
    ping: boolean;
    onOpenIssue: (index: number | null) => void;
    /** Clic fuera del popover: lo cierra sin mover el foco. */
    onDismissIssue: () => void;
    onPreviewFix: (config: SimulationConfig | null) => void;
    onApplyFix: (config: SimulationConfig) => void;
    selectedArea: AreaId | null;
    onSelect: (area: AreaId | null) => void;
    /** Punto elegido del trazado personalizado. */
    selectedPoint: number | null;
    /** Alto de la hoja del panel en el teléfono (0 si el panel va al costado). */
    sheetInset?: number;
    onSelectPoint: (index: number | null) => void;
  }

  let {
    session,
    passengers,
    report,
    result,
    ghost = null,
    fixes,
    openIssue,
    ping,
    onOpenIssue,
    onDismissIssue,
    onPreviewFix,
    onApplyFix,
    selectedArea,
    onSelect,
    selectedPoint,
    sheetInset = 0,
    onSelectPoint
  }: Props = $props();

  /** Estados con los que el recorrido termina sin aprobar (la simulación se detiene ahí). */
  const FAILED_STATUSES = new Set(["rejected", "lost-contact", "stalled", "timeout"]);

  /** Ancho del popover de correcciones y separación respecto del pin (px). */
  const POPOVER_WIDTH_PX = 340;
  const POPOVER_GAP_PX = 22;
  const POPOVER_MARGIN_PX = 12;
  /** Alto mínimo que se le garantiza al popover; si su contenido es mayor, se desplaza por dentro. */
  const POPOVER_MIN_HEIGHT_PX = 260;

  /** Radio de captura de la vía para seleccionar con un clic (px). */
  const HIT_RADIUS_PX = 14;
  /** Movimiento mínimo para que un arrastre del fondo sea paneo y no clic (px). */
  const PAN_THRESHOLD_PX = 4;
  const BUTTON_ZOOM_STEP = 1.4;
  const FOLLOW_ZOOM = 1.6;
  const CAMERA_ANIMATION_MS = 320;
  const FIT_VIEW: CameraView = { mode: "fit", zoom: 1 };
  /**
   * En el personalizado el clic sobre la vía espera este tiempo antes de
   * seleccionar: si llega un doble clic (agregar punto), la selección no
   * abre el panel ni mueve la cámara bajo el segundo clic.
   */
  const DOUBLE_CLICK_MS = 260;

  type Pose = { zoom: number; centerX: number; centerY: number };

  let canvas: HTMLCanvasElement;
  let loop: FrameLoop | undefined;

  let view = $state.raw<CameraView>(FIT_VIEW);
  let camera = $state.raw<Camera | null>(null);
  let dragging = $state(false);
  let animating = $state(false);
  let hoverTrack = $state(false);
  /** Punto de la vía bajo el cursor, para la lectura de v, g y N. */
  let hover = $state.raw<{ x: number; y: number; distance: number } | null>(null);
  let panning = $state(false);
  let showHint = $state(true);
  /** Motivo por el que no se pudo agregar un punto con doble clic. */
  let pointMessage = $state("");
  let pendingSelect: ReturnType<typeof setTimeout> | null = null;

  /** El destino se recalcula en cada cuadro: si la pista cambia en el medio (otro recorrido), se llega a su encuadre sin saltar. */
  let animation: { from: Pose; target: CameraView; start: number } | null = null;
  /** Punteros activos sobre el lienzo, para el zoom con dos dedos. */
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: PinchStart | null = null;
  let press: { x: number; y: number; centerX: number; centerY: number; scale: number; fitScale: number; moved: boolean } | null = null;
  let viewBeforeDrag: CameraView = FIT_VIEW;
  /** El encuadre actual viene de enfocar una selección: al deseleccionar se vuelve al ajuste. */
  let zoomedForSelection = false;

  let runner = $derived(session.runner);
  let live = $derived(!runner.running && session.preview ? session.preview : { config: runner.config, track: runner.track });

  // Un aviso de «no se puede agregar» vale hasta que los puntos (o el recorrido) cambian.
  $effect(() => {
    void live.config.customPoints;
    void isCustom;
    untrack(() => (pointMessage = ""));
  });

  // Con otra pista (deshacer con el teclado, plantilla), la lectura vieja quedaría flotando fuera de la vía.
  $effect(() => {
    void live.track;
    untrack(() => (hover = null));
  });
  let handles = $derived(handlesFor(live.track, live.config));
  let isCustom = $derived(live.config.mapId === "custom");
  let customHandles = $derived(isCustom ? pointHandles(live.track, live.config) : []);
  let focus = $derived(focusRanges(live.track, selectedArea));
  // En el personalizado los puntos ya son manijas: las letras de crestas y loops sobrarían.
  let markers = $derived(
    (isCustom ? [] : live.track.markers).map(marker => {
      const point = geometryAt(live.track, marker.distance);
      return { label: marker.label, x: point.x, y: point.y };
    })
  );
  let issues = $derived(report?.issues ?? []);
  let shownIssue = $derived(openIssue !== null && auditCurrentOrNull() ? (issues[openIssue] ?? null) : null);

  /** El popover de correcciones viaja aparte: se precarga en reposo o al abrir un problema. */
  const fixPopover = workshopParts.fixPopover;
  $effect(() => {
    if (shownIssue) untrack(() => void fixPopover.load());
  });
  /**
   * El popover se ubica al costado de la parte afectada (no encima), así
   * la pista corregida que se previsualiza queda a la vista.
   */
  let popoverAt = $derived.by(() => {
    if (!shownIssue || !camera) return null;

    const bounds = areaBounds(live.track, shownIssue.area);
    const pinX = camera.toX(shownIssue.x);
    const areaLeft = bounds ? camera.toX(bounds.minX) : pinX;
    const areaRight = bounds ? camera.toX(bounds.maxX) : pinX;
    const fitsRight = areaRight + POPOVER_GAP_PX + POPOVER_WIDTH_PX + POPOVER_MARGIN_PX <= camera.width;
    const fitsLeft = areaLeft - POPOVER_GAP_PX - POPOVER_WIDTH_PX >= POPOVER_MARGIN_PX;
    const left = fitsRight
      ? areaRight + POPOVER_GAP_PX
      : fitsLeft
        ? areaLeft - POPOVER_GAP_PX - POPOVER_WIDTH_PX
        : pinX + POPOVER_GAP_PX;
    const top = Math.max(
      POPOVER_MARGIN_PX,
      Math.min(camera.toY(shownIssue.y) - 90, camera.height - POPOVER_MIN_HEIGHT_PX - POPOVER_MARGIN_PX)
    );

    return {
      left: Math.max(POPOVER_MARGIN_PX, Math.min(left, camera.width - POPOVER_WIDTH_PX - POPOVER_MARGIN_PX)),
      top,
      // El lienzo recorta: el popover nunca pasa de su borde inferior.
      maxHeight: camera.height - top - POPOVER_MARGIN_PX
    };
  });
  let showRibbon = $state(true);
  /** El dictamen corresponde al diseño que se ve (no a uno anterior mientras se edita). */
  let auditCurrent = $derived(!!result && JSON.stringify(result.config) === JSON.stringify(live.config));

  function auditCurrentOrNull() {
    return auditCurrent ? result : null;
  }
  let profile = $derived(result ? loadProfile(result.history, buildTrack(result.config)) : []);
  let ribbon = $derived(showRibbon && auditCurrent && result ? ribbonRuns(profile, live.track, live.config) : []);
  let probe = $derived.by(() => {
    if (!hover || !result || !auditCurrent || runner.running || dragging || panning) return null;

    const readout = probeAt(result.history, live.track, hover.distance);
    const stoppedByViolation = FAILED_STATUSES.has(result.final.status) && hover.distance > result.final.distance;
    return { ...hover, section: readout?.section ?? "", lines: probeLines(readout, { stoppedByViolation }) };
  });

  let ghostTrack = $derived.by((): Track | undefined => {
    if (!ghost) return undefined;
    try {
      return buildTrack(ghost);
    } catch {
      return undefined;
    }
  });
  // Las letras A–F son elementos DOM (manijas o insignias), no se dibujan en el canvas.
  let options = { ...RENDER_DEFAULT_OPTIONS, showReadings: false, showMarkers: false };
  let reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  $effect(() => {
    void [live, runner.viewState, runner.history, passengers, issues, focus, view, ribbon, ghostTrack];
    loop?.invalidate();
  });

  $effect(() => {
    // Se lee antes de usar `loop`: con `loop?.` el argumento no se evaluaría y el efecto
    // quedaría sin dependencias mientras el bucle aún no existe.
    const active = runner.running || animating || dragging;
    loop?.setActive(active);
  });

  onMount(() => {
    loop = createFrameLoop(draw);
    loop.setActive(runner.running || animating || dragging);
    loop.invalidate();

    const resize = new ResizeObserver(() => loop?.invalidate());
    resize.observe(canvas);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      if (pendingSelect) clearTimeout(pendingSelect);
      resize.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      loop?.destroy();
    };
  });

  function draw(elapsed: number) {
    runner.tick(elapsed);
    if (animation) stepAnimation(performance.now());

    const used = renderSimulation(canvas, {
      state: runner.viewState,
      config: live.config,
      track: live.track,
      passengers,
      history: runner.history,
      camera: view,
      // Mientras la escala cambia en cada cuadro (animación o pellizco), no se cachea una capa por cuadro.
      options: animating || pinch ? { ...options, cacheWorld: false } : options,
      issues,
      focus,
      ribbon,
      ghostTrack
    });

    if (used && projectionChanged(used, camera)) camera = used;
  }

  function projectionChanged(next: Camera, previous: Camera | null): boolean {
    if (!previous) return true;
    return (
      next.width !== previous.width ||
      next.height !== previous.height ||
      Math.abs(next.scale - previous.scale) > 1e-6 ||
      Math.abs(next.toX(0) - previous.toX(0)) > 0.05 ||
      Math.abs(next.toY(0) - previous.toY(0)) > 0.05
    );
  }

  /** Pose (zoom y centro en metros) que muestra hoy la cámara. */
  function poseOf(source: Camera): Pose {
    return { zoom: source.scale / source.fitScale, centerX: source.fromX(source.width / 2), centerY: source.fromY(source.height / 2) };
  }

  /** Pose de una vista pedida, resolviendo los centros por defecto. */
  function poseFor(target: CameraView): Pose {
    const probe = createCamera(camera?.width ?? canvas.clientWidth, camera?.height ?? canvas.clientHeight, {
      state: runner.viewState,
      track: live.track,
      camera: target
    });
    return poseOf(probe);
  }

  function clampToTrack(next: CameraView): CameraView {
    if (next.mode !== "fit" || next.centerX === undefined || next.centerY === undefined) return next;

    const bounds = fitBounds(live.track, liftProfile(live.track));
    return {
      ...next,
      centerX: Math.min(bounds.maxX, Math.max(bounds.minX, next.centerX)),
      centerY: Math.min(bounds.maxY, Math.max(bounds.minY, next.centerY))
    };
  }

  function cancelAnimation() {
    animation = null;
    animating = false;
  }

  function viewportOf(source: Camera): Viewport {
    return { width: source.width, height: source.height, fitScale: source.fitScale };
  }

  function animateTo(target: CameraView) {
    if (!camera || reducedMotion) {
      view = target;
      return;
    }

    animation = { from: poseOf(camera), target, start: performance.now() };
    animating = true;
  }

  function stepAnimation(now: number) {
    if (!animation) return;

    const progress = Math.min(1, (now - animation.start) / CAMERA_ANIMATION_MS);
    const eased = 1 - (1 - progress) ** 3;
    const { from } = animation;
    const to = poseFor(animation.target);

    if (progress >= 1) {
      view = animation.target;
      animation = null;
      animating = false;
      return;
    }

    view = {
      mode: "fit",
      zoom: from.zoom * (to.zoom / from.zoom) ** eased,
      centerX: from.centerX + (to.centerX - from.centerX) * eased,
      centerY: from.centerY + (to.centerY - from.centerY) * eased
    };
  }

  /** Encuadra un área del diseño (zoom a la selección). */
  function focusArea(area: AreaId) {
    const bounds = areaBounds(live.track, area);
    if (!bounds || !camera) return;

    zoomedForSelection = true;
    animateTo(frameViewAbove(camera.width, camera.height, coveredBottom(), live.track, bounds));
  }

  /** Cuánto tapa la hoja del panel (teléfono) la parte de abajo del lienzo (px). */
  function coveredBottom(): number {
    if (!sheetInset || !canvas) return 0;

    const rect = canvas.getBoundingClientRect();
    return Math.max(0, Math.min(rect.height, sheetInset - (window.innerHeight - rect.bottom)));
  }

  // La hoja aparece (o cambia de alto) después de elegir: se vuelve a encuadrar por encima de ella.
  $effect(() => {
    void sheetInset;
    untrack(() => {
      if (zoomedForSelection && selectedArea) focusArea(selectedArea);
    });
  });

  /** Vuelve al encuadre completo si el zoom actual vino de una selección. */
  export function leaveFocus() {
    if (!zoomedForSelection) return;
    zoomedForSelection = false;
    animateTo(FIT_VIEW);
  }

  function fit() {
    zoomedForSelection = false;
    animateTo(FIT_VIEW);
  }

  /** Zoom anclado al píxel (px, py), calculado desde la vista pedida y no desde el último cuadro. */
  function zoomAt(factor: number, px: number, py: number) {
    if (!camera || dragging) return;

    zoomedForSelection = false;
    cancelAnimation();

    if (view.mode === "follow") {
      view = { mode: "follow", zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor)) };
      return;
    }

    const pose = zoomAround(poseFor(view), factor, px, py, viewportOf(camera));
    view = pose.zoom <= MIN_VIEW_ZOOM + 1e-6 ? FIT_VIEW : clampToTrack({ mode: "fit", ...pose });
  }

  function localPoint(event: PointerEvent | WheelEvent) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onWheel(event: WheelEvent) {
    if (!event.deltaY) return;
    event.preventDefault();
    const point = localPoint(event);
    zoomAt(wheelZoomFactor(event.deltaY, event.deltaMode, canvas.clientHeight), point.x, point.y);
  }

  function trackHit(px: number, py: number) {
    if (!camera) return null;
    const hit = nearestTrackPoint(live.track, camera.fromX(px), camera.fromY(py));
    return hit.gap * camera.scale <= HIT_RADIUS_PX ? hit : null;
  }

  function pinchSpan() {
    const [a, b] = [...pointers.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function onPointerDown(event: PointerEvent) {
    if (!camera || event.button !== 0) return;

    const point = localPoint(event);
    pointers.set(event.pointerId, point);
    canvas.setPointerCapture(event.pointerId);
    cancelAnimation();
    if (openIssue !== null) onDismissIssue();

    if (pointers.size === 2) {
      // Dos dedos: zoom con pellizco en lugar de paneo.
      const span = pinchSpan();
      press = null;
      panning = false;
      zoomedForSelection = false;
      pinch = { pose: poseFor(view), distance: Math.max(1, span.distance), x: span.x, y: span.y };
      return;
    }

    press = {
      x: point.x,
      y: point.y,
      centerX: camera.fromX(camera.width / 2),
      centerY: camera.fromY(camera.height / 2),
      scale: camera.scale,
      fitScale: camera.fitScale,
      moved: false
    };
  }

  function onPointerMove(event: PointerEvent) {
    const point = localPoint(event);

    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, point);

    if (pinch && pointers.size === 2 && camera) {
      const span = pinchSpan();
      const pose = pinchPose(pinch, span.distance, span.x, span.y, viewportOf(camera));
      view = clampToTrack({ mode: "fit", ...pose });
      return;
    }

    if (!press) {
      const hit = trackHit(point.x, point.y);
      hoverTrack = !!hit;
      hover = hit ? { x: hit.x, y: hit.y, distance: hit.distance } : null;
      return;
    }

    hover = null;

    const dx = point.x - press.x;
    const dy = point.y - press.y;

    if (!press.moved && Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return;

    press.moved = true;
    panning = true;
    zoomedForSelection = false;
    view = clampToTrack({
      mode: "fit",
      zoom: Math.min(MAX_VIEW_ZOOM, Math.max(MIN_VIEW_ZOOM, press.scale / press.fitScale)),
      centerX: press.centerX - dx / press.scale,
      centerY: press.centerY + dy / press.scale
    });
  }

  function releasePointer(event: PointerEvent) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
  }

  function onPointerUp(event: PointerEvent) {
    releasePointer(event);
    const current = press;
    press = null;
    panning = false;

    if (!current || current.moved) return;

    const point = localPoint(event);
    const hit = trackHit(point.x, point.y);

    if (hit) {
      const area = areaAtDistance(live.track, hit.distance);
      const choose = () => {
        pendingSelect = null;
        showHint = false;
        onSelect(area);
        focusArea(area);
      };

      if (pendingSelect) clearTimeout(pendingSelect);
      if (isCustom) {
        pendingSelect = setTimeout(choose, DOUBLE_CLICK_MS);
      } else {
        choose();
      }
    } else if (selectedArea) {
      onSelect(null);
      leaveFocus();
    } else if (selectedPoint !== null) {
      // Clic en el cielo: suelta el punto elegido.
      onSelectPoint(null);
    }
  }

  function onDragState(active: boolean) {
    if (!camera) return;

    if (active) {
      // Si la cámara venía animándose, al soltar se vuelve a su destino y no a la pose intermedia.
      viewBeforeDrag = animation ? animation.target : view;
      cancelAnimation();
      session.beginGesture();
      showHint = false;
      const pose = poseOf(camera);
      view = { mode: "fit", zoom: pose.zoom, centerX: pose.centerX, centerY: pose.centerY, scale: camera.scale };
      dragging = true;
      return;
    }

    dragging = false;
    session.endGesture();
    const before = viewBeforeDrag;

    if (before.mode === "follow" || before.centerX === undefined) {
      animateTo(before);
      return;
    }

    // Se queda donde está, con la escala expresada como zoom del nuevo encuadre.
    const fitScale = createCamera(camera.width, camera.height, { state: runner.viewState, track: live.track, camera: FIT_VIEW }).fitScale;
    view = clampToTrack({
      mode: "fit",
      zoom: Math.min(MAX_VIEW_ZOOM, Math.max(MIN_VIEW_ZOOM, camera.scale / fitScale)),
      centerX: camera.fromX(camera.width / 2),
      centerY: camera.fromY(camera.height / 2)
    });
  }

  function setPoints(points: TrackPoint[]) {
    session.patch({ customPoints: points }, { discardInvalid: true });
  }

  /** Doble clic: en el personalizado agrega un punto sobre la vía; en el resto (o fuera de la vía) encuadra. */
  function onDoubleClick(event: MouseEvent) {
    if (pendingSelect) clearTimeout(pendingSelect);
    pendingSelect = null;

    const hit = isCustom && camera ? trackHit(event.clientX - canvas.getBoundingClientRect().left, event.clientY - canvas.getBoundingClientRect().top) : null;

    if (!hit) {
      fit();
      return;
    }

    const result = insertPoint(live.config, hit.x, hit.y);
    if ("error" in result) {
      pointMessage = result.error;
      return;
    }

    pointMessage = "";
    session.patch({ customPoints: result.points }, { discardInvalid: true });
    onSelectPoint(result.index);
  }

  function toggleFollow() {
    zoomedForSelection = false;
    view = view.mode === "follow" ? FIT_VIEW : { mode: "follow", zoom: FOLLOW_ZOOM };
  }

  function zoomButton(factor: number) {
    if (!camera) return;
    zoomAt(factor, camera.width / 2, camera.height / 2);
  }
</script>

<div class="stage">
  <canvas
    bind:this={canvas}
    class:pointer={hoverTrack && !panning}
    class:grabbing={panning}
    aria-label="Pista y tren. Clic en la vía para seleccionar una parte; arrastrá el fondo para desplazar y usá la rueda para acercar."
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={() => {
      hover = null;
      hoverTrack = false;
    }}
    onpointercancel={event => {
      releasePointer(event);
      press = null;
      panning = false;
    }}
    ondblclick={onDoubleClick}
  ></canvas>

  {#if camera}
    <HandleLayer
      {camera}
      {handles}
      {markers}
      {selectedArea}
      hidden={runner.running}
      config={live.config}
      {onDragState}
      onPatch={patch => session.patch(patch, { discardInvalid: true })}
      onSelect={area => onSelect(area)}
    />

    {#if isCustom}
      <PointLayer
        {camera}
        handles={customHandles}
        config={live.config}
        {selectedPoint}
        hidden={runner.running}
        {onDragState}
        onPoints={setPoints}
        {onSelectPoint}
      />
    {/if}
  {/if}

  {#if camera}
    <div class="pins">
      <IssuePins {camera} issues={auditCurrent ? issues : []} hidden={runner.running || dragging} {openIssue} {ping} onOpen={onOpenIssue} />
    </div>
  {/if}

  {#if probe && camera && !shownIssue}
    <div class="pins">
      <TrackProbe {camera} x={probe.x} y={probe.y} section={probe.section} lines={probe.lines} />
    </div>
  {/if}

  {#if shownIssue && popoverAt && result && fixPopover.promise}
    {#await fixPopover.promise then module}
      <module.default
        issue={shownIssue}
        {result}
        {fixes}
        left={popoverAt.left}
        top={popoverAt.top}
        maxHeight={popoverAt.maxHeight}
        {ghost}
        onPreview={onPreviewFix}
        onApply={onApplyFix}
        onClose={() => {
          onPreviewFix(null);
          onOpenIssue(null);
        }}
      />
    {:catch error}
      <!-- Donde iría el popover: el aviso es de ese problema y se cierra con él. -->
      <div class="popover-error" style:left={`${popoverAt.left}px`} style:top={`${popoverAt.top}px`}>
        <LoadError
          floating
          message="No se pudieron descargar las correcciones."
          onRetry={() => fixPopover.retry(error)}
          onDismiss={() => {
            onPreviewFix(null);
            onOpenIssue(null);
          }}
        />
      </div>
    {/await}
  {/if}

  <div class="overlay top-left">
    {#if isCustom && pointMessage}
      <p class="hint warn" role="status">{pointMessage}</p>
    {:else if isCustom && showHint && !runner.running}
      <p class="hint">
        Arrastrá los puntos · doble clic en la vía para agregar uno · tocá un punto para ponerle un loop o elegir una plantilla
        <button type="button" aria-label="Ocultar ayuda" onclick={() => (showHint = false)}><X size={13} /></button>
      </p>
    {:else if showHint && !runner.running}
      <p class="hint">
        Arrastrá los puntos <span class="dot" aria-hidden="true"></span> de la vía para diseñar · clic en un tramo para ver sus valores
        <button type="button" aria-label="Ocultar ayuda" onclick={() => (showHint = false)}><X size={13} /></button>
      </p>
    {/if}
  </div>

  <div class="overlay top-right">
    <LoadLegend config={live.config} bind:visible={showRibbon} available={auditCurrent} />
  </div>

  <div class="overlay bottom-left">
    <PlaybackPill {runner} />
  </div>

  <div class="overlay bottom-right">
    <ZoomControls
      following={view.mode === "follow"}
      onZoomIn={() => zoomButton(BUTTON_ZOOM_STEP)}
      onZoomOut={() => zoomButton(1 / BUTTON_ZOOM_STEP)}
      onFit={fit}
      onFollow={toggleFollow}
    />
  </div>
</div>

<style>
  .stage {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: #ece5fc;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
    touch-action: none;
  }

  canvas.pointer {
    cursor: pointer;
  }

  canvas.grabbing {
    cursor: grabbing;
  }

  .popover-error {
    position: absolute;
    z-index: 5;
    width: min(340px, calc(100% - 24px));
  }

  .pins {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .overlay {
    position: absolute;
    display: flex;
    gap: 8px;
    pointer-events: none;
  }

  .overlay > :global(*) {
    pointer-events: auto;
  }

  .top-left {
    top: 12px;
    left: 12px;
  }

  .top-right {
    top: 12px;
    right: 12px;
  }

  .bottom-left {
    left: 12px;
    bottom: 12px;
  }

  .bottom-right {
    right: 12px;
    bottom: 12px;
  }

  .hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 7px 8px 7px 12px;
    border-radius: 999px;
    background: rgb(255 255 255 / 90%);
    box-shadow: var(--shadow-sm);
    color: var(--text-soft);
    font-size: 12px;
    font-weight: 700;
    backdrop-filter: blur(6px);
  }

  .hint.warn {
    background: var(--accent-soft);
    color: #8a5a12;
  }

  .hint .dot {
    width: 10px;
    height: 10px;
    border: 2px solid var(--primary);
    border-radius: 50%;
    background: white;
  }

  .hint button {
    display: inline-flex;
    padding: 3px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  /* En el teléfono la ayuda no entra; los avisos sí, porque responden a lo que se acaba de hacer. */
  @media (max-width: 700px) {
    .hint:not(.warn) {
      display: none;
    }

    .bottom-left {
      right: 12px;
      bottom: 60px;
    }
  }
</style>
