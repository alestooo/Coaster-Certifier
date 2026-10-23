<script lang="ts">
  import { Flag, Shapes, Wind, OctagonPause, ShieldCheck, Cpu, Sparkles, Undo2, ChevronDown } from "lucide-svelte";
  import FieldControl from "./FieldControl.svelte";
  import { FIELD_GROUPS, type NumericKey } from "../../lib/field-definitions";
  import type { SimulationConfig } from "../../lib/types";
  import { formatNumber } from "../../ui/format";

  let {
    draft,
    dirty,
    errorField = "",
    errorMessage = "",
    onPatch,
    onApply,
    onDiscard,
    onScenarios
  }: {
    draft: SimulationConfig;
    dirty: boolean;
    errorField?: string;
    errorMessage?: string;
    onPatch: (patch: Partial<SimulationConfig>) => void;
    onApply: () => void;
    onDiscard: () => void;
    onScenarios: () => void;
  } = $props();

  const GROUP_ICONS: Record<string, typeof Flag> = {
    initial: Flag,
    geometry: Shapes,
    losses: Wind,
    braking: OctagonPause,
    criteria: ShieldCheck,
    numeric: Cpu
  };

  let open = $state<Record<string, boolean>>({ initial: true, geometry: true, losses: false, braking: true, criteria: false, numeric: false });

  let loopInfo = $derived.by(() => {
    if (!["loop", "reference"].includes(draft.mapId)) return null;

    const reference = draft.loopHeight / 2;
    const shape = 1 - draft.loopTopRadius / reference;

    return { bottomRadius: draft.loopHeight - draft.loopTopRadius, shape, circular: Math.abs(shape) < 1e-9 };
  });

  function groupSummary(id: string) {
    switch (id) {
      case "initial":
        return `H ${formatNumber(draft.initialHeight, 1)} m · v₀ ${formatNumber(draft.initialSpeed, 1)} m/s`;
      case "geometry":
        return `W ${formatNumber(draft.trackWidth, 0)} m${loopInfo ? ` · loop ${formatNumber(draft.loopHeight, 1)} m` : ""}`;
      case "losses":
        return `μ ${formatNumber(draft.friction, 3)}`;
      case "braking":
        return draft.brakeMode === "station"
          ? `frenos a_f ${formatNumber(draft.brakeDeceleration, 1)} m/s² · ${formatNumber(draft.brakingLength, 0)} m`
          : `resorte k ${formatNumber(draft.springConstant, 0)} N/m`;
      case "criteria":
        return `${draft.minLoad} g a +${draft.maxLoad} g`;
      default:
        return `dt ${draft.timeStep} s`;
    }
  }
</script>

<form
  class="settings"
  onsubmit={event => {
    event.preventDefault();
    onApply();
  }}
>
  <div class="settings-intro">
    <p>Ajustá los parámetros del anexo y aplicá el diseño. Los símbolos son los del enunciado; las unidades, del SI.</p>
    <button type="button" class="scenarios" onclick={onScenarios}><Sparkles size={14} /> Escenarios de referencia</button>
  </div>

  <section class="group">
    <header class="group-head static">
      <OctagonPause size={15} />
      <h3>Frenado y contacto</h3>
    </header>

    <div class="choice-grid">
      <label class="choice" class:selected={draft.brakeMode === "station"}>
        <input type="radio" name="brake" value="station" checked={draft.brakeMode === "station"} onchange={() => onPatch({ brakeMode: "station" })} />
        <strong>Frenos de estación</strong>
        <span>Desaceleración constante a_f en E → F</span>
      </label>
      <label class="choice" class:selected={draft.brakeMode === "spring"}>
        <input type="radio" name="brake" value="spring" checked={draft.brakeMode === "spring"} onchange={() => onPatch({ brakeMode: "spring" })} />
        <strong>Resorte</strong>
        <span>F = −k·x, amortiguador opcional</span>
      </label>
      <label class="choice" class:selected={draft.contactModel === "strict"}>
        <input type="radio" name="contact" value="strict" checked={draft.contactModel === "strict"} onchange={() => onPatch({ contactModel: "strict" })} />
        <strong>Contacto estricto</strong>
        <span>N &gt; 0 en toda la vía</span>
      </label>
      <label class="choice" class:selected={draft.contactModel === "safety-wheels"}>
        <input type="radio" name="contact" value="safety-wheels" checked={draft.contactModel === "safety-wheels"} onchange={() => onPatch({ contactModel: "safety-wheels" })} />
        <strong>Ruedas de seguridad</strong>
        <span>Airtime hasta n_mín fuera del loop</span>
      </label>
    </div>
  </section>

  {#each FIELD_GROUPS as group (group.id)}
    {@const fields = group.fields.filter(field => !field.visible || field.visible(draft))}
    {#if fields.length}
      {@const Icon = GROUP_ICONS[group.id]}
      <section class="group" class:open={open[group.id]}>
        <button type="button" class="group-head" aria-expanded={open[group.id]} onclick={() => (open[group.id] = !open[group.id])}>
          <Icon size={15} />
          <h3>{group.title}</h3>
          <small>{groupSummary(group.id)}</small>
          <ChevronDown size={15} class="chevron" />
        </button>

        {#if open[group.id]}
          <div class="group-body">
            {#each fields as field (field.key)}
              <FieldControl {field} value={draft[field.key]} error={errorField === field.key} onInput={value => onPatch({ [field.key as NumericKey]: value })} />
            {/each}

            {#if group.id === "geometry" && loopInfo}
              <p class="note">
                Loop en lágrima: radio en la base R_B = h_L − R = <strong>{formatNumber(loopInfo.bottomRadius, 2)} m</strong>
                {loopInfo.circular ? "(circular)" : `· forma c = ${formatNumber(loopInfo.shape, 2)}`}
              </p>
            {/if}
          </div>
        {/if}
      </section>
    {/if}
  {/each}

  <div class="apply">
    <button class="primary" type="submit">Aplicar diseño</button>
    {#if dirty}
      <button type="button" class="ghost" onclick={onDiscard}><Undo2 size={14} /> Descartar</button>
    {/if}
    {#if errorMessage}
      <p role="alert" class="error">{errorMessage}</p>
    {:else if dirty}
      <p class="pending">Hay cambios sin aplicar.</p>
    {/if}
  </div>
</form>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .settings-intro p {
    margin: 0 0 8px;
    font-size: 12px;
    line-height: 1.55;
    color: var(--muted);
  }

  .scenarios {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    justify-content: center;
    height: 38px;
    border: 1px dashed var(--border-strong);
    border-radius: 11px;
    background: var(--accent-soft);
    color: #8a5a12;
    font: inherit;
    font-size: 12.5px;
    font-weight: 800;
    cursor: pointer;
  }

  .group {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    overflow: hidden;
  }

  .group-head {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    border: 0;
    background: var(--surface-soft);
    color: var(--text-soft);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .group-head.static {
    grid-template-columns: auto 1fr;
    cursor: default;
  }

  .group-head h3 {
    margin: 0;
    font-size: 12.5px;
    font-weight: 900;
    color: var(--text);
  }

  .group-head small {
    justify-self: end;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .group-head :global(.chevron) {
    color: var(--faint);
    transition: transform 0.15s;
  }

  .group.open .group-head :global(.chevron) {
    transform: rotate(180deg);
  }

  .group-body {
    padding: 4px 12px 8px;
  }

  .note {
    margin: 6px 0 4px;
    padding: 8px 10px;
    border-radius: 9px;
    background: var(--accent-soft);
    color: #8a5a12;
    font-size: 11px;
    line-height: 1.5;
  }

  .choice-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    padding: 10px 12px 12px;
  }

  .choice {
    position: relative;
    display: grid;
    gap: 2px;
    padding: 9px 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .choice input {
    position: absolute;
    opacity: 0;
    inset: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .choice.selected {
    border-color: var(--primary);
    background: var(--primary-soft);
  }

  .choice strong {
    font-size: 11.5px;
    color: var(--text);
  }

  .choice span {
    font-size: 10.5px;
    color: var(--muted);
    line-height: 1.4;
  }

  .apply {
    position: sticky;
    bottom: -16px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px;
    padding: 12px 0 4px;
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .apply .primary {
    height: 44px;
    border: 0;
    border-radius: 12px;
    background: linear-gradient(180deg, #9a6be0, var(--primary));
    color: white;
    font: inherit;
    font-size: 13.5px;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 6px 16px rgb(122 75 198 / 28%);
  }

  .apply .ghost {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 44px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--text-soft);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .apply .error,
  .apply .pending {
    grid-column: 1 / -1;
    margin: 0;
    padding: 8px 10px;
    border-radius: 9px;
    font-size: 11.5px;
    line-height: 1.5;
  }

  .apply .error {
    background: var(--danger-soft);
    color: #9d2a39;
  }

  .apply .pending {
    background: var(--accent-soft);
    color: #8a5a12;
  }
</style>
