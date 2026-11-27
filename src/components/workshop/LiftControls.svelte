<script lang="ts">
  import { untrack } from "svelte";
  import ParamSlider from "../ui/ParamSlider.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import { buildTrack, resolveConfig, copyElement, DEFAULT_LIFT, LIFT_LIMITS } from "../../physics/index.js";
  import { liftText } from "../../lib/report-text";
  import { explainConfigError } from "../../lib/handles";
  import type { SimulationConfig, TrackElement } from "../../lib/types";

  /**
   * Subida por cadena hasta A, en «Salida»: ponerla o quitarla (montaña rusa
   * lanzada) y su ángulo, la eficiencia del motor y la rapidez de la cadena.
   * No cambia el recorrido evaluado: t = 0 sigue en A.
   */
  interface Props {
    config: SimulationConfig;
    onTrack: (track: TrackElement[], step?: boolean) => void;
    onGesture?: (active: boolean) => void;
  }

  let { config, onTrack, onGesture }: Props = $props();

  type Lift = { angle: number; efficiency: number; chainSpeed: number };
  const DEGREES = 180 / Math.PI;
  const MODES = [
    { value: "chain", label: "Con subida por cadena" },
    { value: "none", label: "Sin subida (lanzada)" }
  ];

  let reason = $state("");
  let lift = $derived(config.track[0]?.type === "start" ? (config.track[0].lift ?? null) : null);

  // El motivo es del cambio que lo produjo: si el trazado cambia, se descarta.
  $effect(() => {
    void config.track;
    untrack(() => (reason = ""));
  });

  /** Trazado con esa subida en A (o sin subida), si se construye; si no, explica por qué. */
  function apply(next: Lift | null, step: boolean) {
    const start: TrackElement = next ? { type: "start", lift: next } : { type: "start" };
    const track = [start, ...config.track.slice(1).map(copyElement)];

    try {
      buildTrack(resolveConfig({ ...config, track }));
    } catch (error) {
      reason = explainConfigError(error) ?? "Ese cambio no deja un trazado construible.";
      return;
    }

    reason = "";
    onTrack(track, step);
  }

  const change = (patch: Partial<Lift>) => lift && apply({ ...lift, ...patch }, false);
  const clamp = (value: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, value));
</script>

<section class="lift" aria-label="Subida por cadena">
  <Segmented label="Subida por cadena" block value={lift ? "chain" : "none"} options={MODES} onChange={value => apply(value === "chain" ? { ...DEFAULT_LIFT } : null, true)} />

  {#if lift}
    {@const current = lift}
    <ParamSlider
      id="lift-angle"
      label="Ángulo de la subida"
      symbol="α"
      unit="°"
      step={0.5}
      help="Inclinación de la rampa de la cadena. Más empinada es más corta, pero el motor tira más fuerte."
      value={Math.round(current.angle * DEGREES * 10) / 10}
      limits={[LIFT_LIMITS.angleDegrees[0], LIFT_LIMITS.angleDegrees[1]]}
      onInput={value => change({ angle: clamp(value, LIFT_LIMITS.angleDegrees) / DEGREES })}
      {onGesture}
    />
    <ParamSlider
      id="lift-efficiency"
      label="Eficiencia del motor"
      symbol="η"
      unit="%"
      step={1}
      help="Qué parte de la energía eléctrica llega a la cadena. El resto se pierde en el motor y la transmisión."
      value={Math.round(current.efficiency * 100)}
      limits={[LIFT_LIMITS.efficiency[0] * 100, LIFT_LIMITS.efficiency[1] * 100]}
      onInput={value => change({ efficiency: clamp(value / 100, LIFT_LIMITS.efficiency) })}
      {onGesture}
    />
    <ParamSlider
      id="lift-speed"
      label="Rapidez de la cadena"
      symbol="v_c"
      unit="m/s"
      step={0.1}
      help="A qué rapidez sube el tren por la cadena. La potencia del motor crece con ella."
      value={current.chainSpeed}
      limits={[LIFT_LIMITS.chainSpeed[0], LIFT_LIMITS.chainSpeed[1]]}
      onInput={value => change({ chainSpeed: clamp(value, LIFT_LIMITS.chainSpeed) })}
      {onGesture}
    />
  {/if}

  <p class="reading" role="status">{liftText(config)}</p>
  {#if reason}<p class="reason" role="alert">{reason}</p>{/if}
</section>

<style>
  .lift {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }

  .reading,
  .reason {
    margin: 0;
    font-size: var(--text-12);
    line-height: 1.45;
  }

  .reading {
    color: var(--muted);
  }

  .reason {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--accent-soft);
    color: var(--warn-text);
  }
</style>
