<script lang="ts">
  import { untrack } from "svelte";
  import ParamSlider from "../ui/ParamSlider.svelte";
  import AreaStatus from "./AreaStatus.svelte";
  import { moveElement, setPointLoop, setHill, elementLimits, type TrackEdit } from "../../lib/track-edit";
  import { fieldByKey } from "../../lib/field-definitions";
  import { APPROACH_LENGTH } from "../../physics/index.js";
  import type { AreaInsight } from "../../lib/audit";
  import type { SimulationConfig, TrackElement } from "../../lib/types";

  /**
   * Valores del elemento elegido (punto, loop, colina o E) con sliders y
   * campo exacto. Lo que no entra en la geometría se detiene en el último
   * valor construible y dice por qué.
   */
  interface Props {
    index: number;
    config: SimulationConfig;
    /** Lectura del dictamen para el loop o la colina (la misma de los demás loops o colinas). */
    insight?: AreaInsight | null;
    onTrack: (track: TrackElement[]) => void;
    onGesture?: (active: boolean) => void;
  }

  let { index, config, insight = null, onTrack, onGesture }: Props = $props();

  /** Metadatos de los valores propios de un elemento (los de loop y colina vienen de field-definitions). */
  const POSITION = { label: "Posición horizontal", symbol: "x", unit: "m", step: 0.5, help: "Distancia horizontal desde A." };
  const HEIGHT = { label: "Altura", symbol: "y", unit: "m", step: 0.5, help: "Altura del punto sobre el suelo. Un valle es un punto en 0 m." };
  const END = {
    label: "Posición de E",
    symbol: "x_E",
    unit: "m",
    step: 0.5,
    help: "Dónde empieza la zona de frenado. Moverla cambia solo la recta final: el resto del trazado queda igual."
  };

  const REMOVE_LOOP_HINT = "Para quitar el loop, usá «Quitar loop» en la barra sobre el punto.";

  let reason = $state("");
  let element = $derived(config.track[index]);

  // El motivo de un recorte es del elemento que lo produjo.
  $effect(() => {
    void index;
    untrack(() => (reason = ""));
  });

  function apply(edit: TrackEdit) {
    onTrack(edit.track);
    reason = edit.reason ?? (edit.limited ? "Se ajustó al límite permitido." : "");
  }

  /**
   * Aplica un valor del campo o del slider recortado a su rango: lo escrito
   * puede salirse (p. ej. h_L = 0, que quitaría el loop sin aviso).
   */
  function commit([min, max]: [number, number], value: number, edit: (value: number) => TrackEdit) {
    const clipped = Math.min(max, Math.max(min, value));
    const result = edit(clipped);
    apply(clipped !== value ? { ...result, limited: true } : result);
  }

  /** Metadatos de un campo de field-definitions (loop y colina). */
  function meta(key: "loopHeight" | "loopTopRadius" | "hillHeight" | "hillCrestRadius") {
    const field = fieldByKey(key);
    return { label: field?.label ?? key, symbol: field?.symbol ?? "", unit: field?.unit ?? "m", step: field?.step ?? 0.5, help: field?.help ?? "" };
  }

  const shift = ([min, max]: [number, number], by: number): [number, number] => [min + by, max + by];
</script>

{#if insight}<AreaStatus {insight} />{/if}

{#if element?.type === "point"}
  <ParamSlider id={`x-${index}`} {...POSITION} value={element.x} limits={elementLimits(config, index, "x")} onInput={value => commit(elementLimits(config, index, "x"), value, x => moveElement(config, index, x, element.y))} {onGesture} />
  <ParamSlider id={`y-${index}`} {...HEIGHT} value={element.y} limits={elementLimits(config, index, "y")} onInput={value => commit(elementLimits(config, index, "y"), value, y => moveElement(config, index, element.x, y))} {onGesture} />

  {#if element.loop}
    {@const loop = element.loop}
    <ParamSlider
      id={`loop-height-${index}`}
      {...meta("loopHeight")}
      value={loop.height}
      limits={elementLimits(config, index, "loopHeight")}
      onInput={value =>
        value > 0 ? commit(elementLimits(config, index, "loopHeight"), value, height => setPointLoop(config, index, height, loop.topRadius)) : (reason = REMOVE_LOOP_HINT)}
      {onGesture}
    />
    <ParamSlider
      id={`loop-radius-${index}`}
      {...meta("loopTopRadius")}
      value={loop.topRadius}
      limits={elementLimits(config, index, "loopTopRadius")}
      hint={fieldByKey("loopTopRadius")?.hint?.({ ...config, loopHeight: loop.height, loopTopRadius: loop.topRadius }) ?? ""}
      onInput={value => commit(elementLimits(config, index, "loopTopRadius"), value, radius => setPointLoop(config, index, loop.height, radius))}
      {onGesture}
    />
  {:else}
    <p class="tip">El loop y el borrado están en la barra que aparece sobre el punto, en la pista.</p>
  {/if}
{:else if element?.type === "hill"}
  {@const hill = element}
  <ParamSlider id={`x-${index}`} {...POSITION} value={hill.x} limits={elementLimits(config, index, "x")} onInput={value => commit(elementLimits(config, index, "x"), value, x => moveElement(config, index, x, hill.height))} {onGesture} />
  <ParamSlider
    id={`hill-height-${index}`}
    {...meta("hillHeight")}
    value={hill.height}
    limits={elementLimits(config, index, "hillHeight")}
    onInput={value => commit(elementLimits(config, index, "hillHeight"), value, height => setHill(config, index, { height }))}
    {onGesture}
  />
  <ParamSlider
    id={`hill-radius-${index}`}
    {...meta("hillCrestRadius")}
    value={hill.crestRadius}
    limits={elementLimits(config, index, "hillCrestRadius")}
    onInput={value => commit(elementLimits(config, index, "hillCrestRadius"), value, crestRadius => setHill(config, index, { crestRadius }))}
    {onGesture}
  />
{:else if element?.type === "end"}
  <ParamSlider
    id="end-x"
    {...END}
    value={element.x + APPROACH_LENGTH}
    limits={shift(elementLimits(config, index, "x"), APPROACH_LENGTH)}
    onInput={value => commit(shift(elementLimits(config, index, "x"), APPROACH_LENGTH), value, x => moveElement(config, index, x - APPROACH_LENGTH))}
    {onGesture}
  />
{/if}

{#if reason}<p class="reason" role="status">{reason}</p>{/if}

<style>
  .tip,
  .reason {
    margin: var(--space-2) 0 0;
    font-size: var(--text-12);
    line-height: 1.45;
  }

  .tip {
    color: var(--muted);
  }

  .reason {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--accent-soft);
    color: var(--warn-text);
  }
</style>
