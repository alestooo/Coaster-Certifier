<script lang="ts">
  import { stoppedByViolation } from "../../lib/run-status";
  import { onMount, untrack } from "svelte";
  import { X } from "lucide-svelte";
  import IconButton from "../ui/IconButton.svelte";
  import HandleLayer from "./HandleLayer.svelte";
  import PlaybackPill from "./PlaybackPill.svelte";
  import ZoomControls from "./ZoomControls.svelte";
  import LoadLegend from "./LoadLegend.svelte";
  import IssuePins from "./IssuePins.svelte";
  import LoadError from "../LoadError.svelte";
  import { workshopParts } from "../../lib/workshop-parts";
  import TrackProbe from "./TrackProbe.svelte";
  import ElementLayer from "./ElementLayer.svelte";
  import { elementHandles, insertPoint } from "../../lib/track-edit";
  import { probeAt, probeLines } from "../../lib/probe";
  import type { FixSearch } from "../../lib/fix-search.svelte";
  import { renderSimulation, RENDER_DEFAULT_OPTIONS, MIN_ZOOM, MAX_ZOOM, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM, frameViewAbove, fitBounds } from "../../ui/renderer/index.js";
  import { createCamera, type Camera, type CameraView } from "../../ui/renderer/camera.js";
  import { liftPath } from "../../ui/renderer/lift.js";
  import { trailUntil } from "../../ui/renderer/trail.js";
  import { createFrameLoop, type FrameLoop } from "../../lib/frame-loop";
  import { wheelZoomFactor, zoomAround, pinchPose, type PinchStart, type Viewport } from "../../lib/camera-gestures";
  import { handlesFor } from "../../lib/handles";
  import { nearestTrackPoint, areaAtDistance, areaBounds, elementAtDistance } from "../../lib/track-hit";
  import { focusRanges, elementRanges } from "../../lib/track-focus";
  import { needsReframe } from "../../lib/view-fit";
  import { geometryAt, buildTrack } from "../../physics/index.js";
  import { loadProfile, ribbonRuns } from "../../lib/load-profile";
  import type { AuditResult } from "../../lib/live-audit.svelte";
  import type { SimulationConfig, Track } from "../../lib/types";
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
    selectedElement: number | null;
    /** Alto de la hoja del panel en el teléfono (0 si el panel va al costado). */
    sheetInset?: number;
    onSelectElement: (index: number | null) => void;
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
    selectedElement,
    sheetInset = 0,
    onSelectElement
  }: Props = $props();


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
  /** Gesto de rueda en curso: la escala cambia en cada evento y no se cachea una capa por evento. */
  let wheeling = $state(false);
  let wheelTimer: ReturnType<typeof setTimeout> | null = null;
  /** Tras el último evento de rueda, cuánto se espera para dar el gesto por terminado (ms). */
  const WHEEL_SETTLE_MS = 200;

  /** El destino se recalcula en cada cuadro: si la pista cambia en el medio (otro recorrido), se llega a su encuadre sin saltar. */
  let animation: { from: Pose; target: CameraView; start: number } | null = null;
  /** Punteros activos sobre el lienzo, para el zoom con dos dedos. */
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: PinchStart | null = null;
  let press: { x: number; y: number; centerX: number; centerY: number; scale: number; fitScale: number; moved: boolean } | null = null;
  let viewBeforeDrag: CameraView = FIT_VIEW;
  /** El encuadre actual viene de enfocar una selección: al deseleccionar se vuelve al ajuste. */
  let zoomedForSelection = false;
  /**
   * La vista quedó conservada al soltar una manija desde el encuadre completo:
   * si después el lienzo cambia de tamaño (se abre un panel) y el trazado ya
   * no entra, se vuelve a encuadrar. Cualquier otro cambio de vista lo apaga.
   */
  let keptFromFit = false;

  let runner = $derived(session.runner);
  let live = $derived(!runner.running && session.preview ? session.preview : { config: runner.config, track: runner.track });

  // Un aviso de «no se puede agregar» vale hasta que el trazado cambia.
  $effect(() => {
    void live.config.track;
    untrack(() => (pointMessage = ""));
  });

  // Con otra pista (deshacer con el teclado, plantilla), la lectura vieja quedaría flotando fuera de la vía.
  $effect(() => {
    void live.track;
    untrack(() => (hover = null));
  });
  let handles = $derived(handlesFor(live.track, live.config));
  let trackHandles = $derived(elementHandles(live.track, live.config));
  /** Letras que ya lleva una manija de elemento (B, C, D, E…): no se repiten como insignia. */
  let handleLetters = $derived(new Set(trackHandles.map(handle => handle.letter).filter(Boolean)));
  let focus = $derived(selectedElement !== null ? elementRanges(live.track, selectedElement) : focusRanges(live.track, selectedArea));
  // Las letras van en las manijas; durante la reproducción las manijas se ocultan y quedan solo las letras.
  let markers = $derived(
    live.track.markers
      .filter(marker => runner.running || !handleLetters.has(marker.label))
      .map(marker => {
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
    const stopped = stoppedByViolation(result.final.status) && hover.distance > result.final.distance;
    return { ...hover, section: readout?.section ?? "", lines: probeLines(readout, { stoppedByViolation: stopped }) };
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
      if (wheelTimer) clearTimeout(wheelTimer);
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
      history: trailUntil(runner.history, runner.scrubIndex),
      camera: view,
      // Mientras la escala cambia en cada cuadro (animación o pellizco), no se cachea una capa por cuadro.
      options: animating || pinch || wheeling ? { ...options, cacheWorld: false } : options,
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

    const bounds = fitBounds(live.track, liftPath(live.track));
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
    keptFromFit = false;
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

  /** Tamaño del lienzo en el último cuadro (px), para saber cuándo cambió. */
  let lastSize = { width: 0, height: 0 };

  $effect(() => {
    const current = camera;
    if (!current) return;
    void current.width;
    void current.height;
    untrack(() => {
      const previous = lastSize;
      lastSize = { width: current.width, height: current.height };
      const resized = previous.width > 0 && (previous.width !== current.width || previous.height !== current.height);

      // En pleno arrastre (p. ej. se abre un panel y el lienzo se angosta), la esquina superior izquierda
      // queda fija: la pista no se corre bajo el cursor.
      if (resized && dragging && view.mode === "fit" && view.centerX !== undefined && view.centerY !== undefined) {
        view = {
          ...view,
          centerX: view.centerX - (previous.width - current.width) / (2 * current.scale),
          centerY: view.centerY + (previous.height - current.height) / (2 * current.scale)
        };
        return;
      }

      // Con la vista conservada, si el lienzo cambia de tamaño y el trazado ya no entra, se encuadra.
      if (!keptFromFit || dragging) return;
      if (needsReframe(fitBounds(live.track, liftPath(live.track)), current)) animateTo(FIT_VIEW);
    });
  });

  /** Margen (px) que el elemento elegido guarda con la hoja del panel (teléfono). */
  const REVEAL_MARGIN_PX = 48;

  /**
   * Si la hoja del panel (teléfono) o un borde tapa el elemento elegido, corre
   * la vista sin cambiar el zoom hasta dejarlo en la parte visible. Si ya se
   * ve, la cámara no se mueve.
   */
  function revealElement(x: number, y: number) {
    // Un reencuadre en curso (p. ej. al soltar una manija fuera de la vista) ya lo va a mostrar todo.
    if (!camera || dragging || animation) return;

    const covered = coveredBottom();
    const visible = camera.height - covered;
    const screenX = camera.toX(x);
    const screenY = camera.toY(y);
    // Contra la hoja del panel se deja margen; contra los bordes, solo si quedó fuera del lienzo.
    const hiddenY = screenY > visible - (covered > 0 ? REVEAL_MARGIN_PX : 0) || screenY < 0;
    const hiddenX = screenX > camera.width || screenX < 0;
    if (!hiddenX && !hiddenY) return;

    const pose = poseOf(camera);
    animateTo({
      mode: "fit",
      zoom: pose.zoom,
      centerX: hiddenX ? pose.centerX + (screenX - camera.width / 2) / camera.scale : pose.centerX,
      centerY: hiddenY ? pose.centerY - (screenY - visible / 2) / camera.scale : pose.centerY
    });
  }

  // El elemento elegido (o la hoja que aparece después) no queda tapado.
  $effect(() => {
    const index = selectedElement;
    void sheetInset;
    untrack(() => {
      if (index === null) return;
      const anchor = trackHandles.find(handle => handle.index === index && (handle.kind === "point" || handle.kind === "hillCrest" || handle.kind === "end"));
      if (anchor) revealElement(anchor.x, anchor.y);
    });
  });

  /** Vuelve al encuadre completo si el zoom actual vino de una selección. */
  export function leaveFocus() {
    if (!zoomedForSelection) return;
    zoomedForSelection = false;
    keptFromFit = false;
    animateTo(FIT_VIEW);
  }

  function fit() {
    zoomedForSelection = false;
    keptFromFit = false;
    animateTo(FIT_VIEW);
  }

  /** Zoom anclado al píxel (px, py), calculado desde la vista pedida y no desde el último cuadro. */
  function zoomAt(factor: number, px: number, py: number) {
    if (!camera || dragging) return;

    zoomedForSelection = false;
    keptFromFit = false;
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
    wheeling = true;
    if (wheelTimer) clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      wheeling = false;
      loop?.invalidate();
    }, WHEEL_SETTLE_MS);
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
      keptFromFit = false;
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
    keptFromFit = false;
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
      // Un tramo de un elemento (punto, loop, colina, recta final) elige el elemento; la caída y el frenado, su área.
      const element = elementAtDistance(live.track, hit.distance);
      const area = areaAtDistance(live.track, hit.distance);
      const choose = () => {
        pendingSelect = null;
        showHint = false;
        if (element !== null) {
          onSelectElement(element);
          return;
        }
        onSelect(area);
        focusArea(area);
      };

      // Se espera por si es un doble clic (agrega un punto).
      if (pendingSelect) clearTimeout(pendingSelect);
      pendingSelect = setTimeout(choose, DOUBLE_CLICK_MS);
    } else if (selectedArea) {
      onSelect(null);
      leaveFocus();
    } else if (selectedElement !== null) {
      // Clic en el cielo: suelta el punto elegido.
      onSelectElement(null);
    }
  }

  function onDragState(active: boolean) {
    if (!camera) return;

    if (active) {
      // Si la cámara venía animándose, al soltar se vuelve a su destino y no a la pose intermedia.
      viewBeforeDrag = animation ? animation.target : view;
      keptFromFit = false;
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

    if (before.mode === "follow") {
      animateTo(before);
      return;
    }

    // Desde el encuadre completo, solo se vuelve a encuadrar si el trazado nuevo ya no entra en la vista.
    if (before.centerX === undefined && needsReframe(fitBounds(live.track, liftPath(live.track)), camera)) {
      animateTo(before);
      return;
    }

    // Se queda donde está, con la escala expresada como zoom del nuevo encuadre.
    const fitScale = createCamera(camera.width, camera.height, { state: runner.viewState, track: live.track, camera: FIT_VIEW }).fitScale;
    const zoom = camera.scale / fitScale;
    const kept: CameraView = {
      mode: "fit",
      zoom: Math.min(MAX_VIEW_ZOOM, Math.max(MIN_VIEW_ZOOM, zoom)),
      centerX: camera.fromX(camera.width / 2),
      centerY: camera.fromY(camera.height / 2)
    };
    // Con un trazado más chico, la escala actual queda por debajo del encuadre completo (zoom < 1):
    // se conserva exacta, como durante el arrastre, hasta que se use el zoom o «Encuadrar».
    view = clampToTrack(zoom < MIN_VIEW_ZOOM ? { ...kept, scale: camera.scale } : kept);
    keptFromFit = before.centerX === undefined;
  }

  /** Doble clic: sobre la vía agrega un punto; fuera de la vía encuadra. */
  function onDoubleClick(event: MouseEvent) {
    if (pendingSelect) clearTimeout(pendingSelect);
    pendingSelect = null;

    const hit = camera ? trackHit(event.clientX - canvas.getBoundingClientRect().left, event.clientY - canvas.getBoundingClientRect().top) : null;

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
    session.setTrack(result.track, { step: true });
    onSelectElement(result.index);
  }

  function toggleFollow() {
    zoomedForSelection = false;
    keptFromFit = false;
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
    aria-label="Pista y tren. Hacé clic en la vía para elegir una parte; arrastrá el fondo para moverte; usá la rueda para acercar."
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

    <ElementLayer
      {camera}
      handles={trackHandles}
      config={live.config}
      selected={selectedElement}
      hidden={runner.running}
      {onDragState}
      onTrack={(track, step) => session.setTrack(track, { step })}
      onSelect={onSelectElement}
    />
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
    {#if pointMessage}
      <p class="hint warn" role="status">{pointMessage}</p>
    {:else if showHint && !runner.running}
      <p class="hint">
        Arrastrá los círculos <span class="dot" aria-hidden="true"></span> para cambiar la forma · doble clic en la vía agrega un punto · tocá un punto para ver sus opciones
        <IconButton label="Ocultar ayuda" icon={X} size="sm" onclick={() => (showHint = false)} />
      </p>
    {/if}
  </div>

  <div class="overlay top-right">
    <LoadLegend config={live.config} track={live.track} bind:visible={showRibbon} available={auditCurrent} />
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
    background: var(--surface-muted);
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
    color: var(--warn-text);
  }

  .hint .dot {
    width: 10px;
    height: 10px;
    border: 2px solid var(--primary);
    border-radius: 50%;
    background: white;
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
