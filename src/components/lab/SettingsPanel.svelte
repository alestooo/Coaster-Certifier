<script lang="ts">
  import FieldControl from "./FieldControl.svelte";
  import { FIELD_GROUPS, type NumericKey } from "../../lib/field-definitions";
  import { MIN_PASSENGER_MASS, MAX_PASSENGER_MASS } from "../../game/passengers";
  import type { SimulationConfig } from "../../lib/types";
  import { formatNumber } from "../../ui/format";

  let {
    draft,
    cartMass,
    masses,
    cartCount,
    dirty,
    errorField = "",
    errorMessage = "",
    onPatch,
    onCartMass,
    onPassengerMass,
    onApply,
    onDiscard
  }: {
    draft: SimulationConfig;
    cartMass: number;
    masses: number[];
    cartCount: number;
    dirty: boolean;
    errorField?: string;
    errorMessage?: string;
    onPatch: (patch: Partial<SimulationConfig>) => void;
    onCartMass: (value: number) => void;
    onPassengerMass: (index: number, value: number) => void;
    onApply: () => void;
    onDiscard: () => void;
  } = $props();

  let totalMass = $derived(cartCount * cartMass + masses.reduce((sum, mass) => sum + mass, 0));

  let loopInfo = $derived.by(() => {
    if (!["loop", "reference"].includes(draft.mapId)) return null;

    const reference = draft.loopHeight / 2;
    const shape = 1 - draft.loopTopRadius / reference;

    return {
      bottomRadius: draft.loopHeight - draft.loopTopRadius,
      shape,
      circular: Math.abs(shape) < 1e-9
    };
  });

  function numberFrom(event: Event) {
    return (event.currentTarget as HTMLInputElement).valueAsNumber;
  }
</script>

<form
  class="settings-form"
  onsubmit={event => {
    event.preventDefault();
    onApply();
  }}
>
  <div class="settings-heading">
    <h2>Parámetros</h2>
    <span class="settings-hint">Símbolos del anexo · unidades del SI</span>
  </div>

  <section class="settings-group">
    <h3>Sistema de frenado y contacto</h3>

    <label class="select-field">
      <span>Final del recorrido</span>
      <select value={draft.brakeMode} onchange={event => onPatch({ brakeMode: (event.currentTarget as HTMLSelectElement).value as SimulationConfig["brakeMode"] })}>
        <option value="station">Frenos de estación (desaceleración constante a_f)</option>
        <option value="spring">Resorte de frenado (F = −k·x, opcionalmente amortiguado)</option>
      </select>
    </label>

    <label class="select-field">
      <span>Modelo de contacto con la vía</span>
      <select value={draft.contactModel} onchange={event => onPatch({ contactModel: (event.currentTarget as HTMLSelectElement).value as SimulationConfig["contactModel"] })}>
        <option value="strict">Estricto: N &gt; 0 en toda la vía</option>
        <option value="safety-wheels">Ruedas de seguridad: n ≥ n_mín fuera del loop</option>
      </select>
    </label>
  </section>

  {#each FIELD_GROUPS as group (group.id)}
    {@const fields = group.fields.filter(field => !field.visible || field.visible(draft))}
    {#if fields.length}
      <details class="settings-group" open={!group.collapsed}>
        <summary><h3>{group.title}</h3></summary>

        {#each fields as field (field.key)}
          <FieldControl
            {field}
            value={draft[field.key]}
            error={errorField === field.key}
            onInput={value => onPatch({ [field.key as NumericKey]: value })}
          />
        {/each}

        {#if group.id === "geometry" && loopInfo}
          <p class="derived-note">
            Loop en lágrima: radio en la base R_B = h_L − R = <strong>{formatNumber(loopInfo.bottomRadius, 2)} m</strong>,
            forma c = {formatNumber(loopInfo.shape, 2)}
            {loopInfo.circular ? "(circular)" : "(0 = circular)"}.
          </p>
        {/if}
      </details>
    {/if}
  {/each}

  <details class="settings-group" open>
    <summary><h3>Masa del tren · {cartCount} {cartCount === 1 ? "carrito" : "carritos"}</h3></summary>

    <label class="mass-field">
      <span>Carrito vacío (kg)</span>
      <input type="number" min="1" max="10000" step="any" required value={cartMass} onchange={event => onCartMass(numberFrom(event))} />
    </label>

    {#each masses as mass, index}
      <label class="mass-field">
        <span>Persona {index + 1} (kg)</span>
        <input type="number" min={MIN_PASSENGER_MASS} max={MAX_PASSENGER_MASS} step="any" required value={mass} onchange={event => onPassengerMass(index, numberFrom(event))} />
      </label>
    {/each}

    <p class="derived-note">
      Masa total m = <strong>{formatNumber(totalMass, 1)} kg</strong>. La masa escala fuerzas y energías; no cambia la rapidez.
    </p>
  </details>

  <div class="apply-bar">
    <button class="primary" type="submit">Aplicar y reiniciar</button>

    {#if dirty}
      <button type="button" class="ghost" onclick={onDiscard}>Descartar cambios</button>
      <small>Cambios pendientes de aplicar</small>
    {/if}

    {#if errorMessage}
      <p role="alert" class="physics-error">{errorMessage}</p>
    {/if}
  </div>
</form>

<style>
  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .settings-heading {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 6px;
  }

  .settings-heading h2 {
    margin: 0;
  }

  .settings-hint {
    font-size: 10px;
    letter-spacing: 1px;
    color: #a18ab1;
    text-transform: uppercase;
  }

  .settings-group {
    padding: 10px 0 4px;
    border-top: 1px solid #eee5f5;
  }

  .settings-group h3 {
    display: inline;
    margin: 0;
    font-size: 12px;
    font-weight: 750;
    color: #6d4a8c;
    letter-spacing: 0.2px;
  }

  .settings-group summary {
    cursor: pointer;
    margin-bottom: 10px;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .settings-group summary::before {
    content: "▸";
    font-size: 11px;
    color: #b093c7;
    transition: transform 0.15s;
  }

  .settings-group[open] summary::before {
    transform: rotate(90deg);
  }

  section.settings-group h3 {
    display: block;
    margin-bottom: 10px;
  }

  .select-field,
  .mass-field {
    display: grid;
    gap: 5px;
    margin-bottom: 10px;
    font-size: 12px;
    color: #4e3a63;
  }

  .mass-field {
    grid-template-columns: 1fr 96px;
    align-items: center;
  }

  .mass-field input {
    text-align: right;
  }

  .derived-note {
    margin: 4px 0 8px;
    padding: 8px 10px;
    border-radius: 8px;
    background: #f7f1fc;
    color: #7a5f91;
    font-size: 11px;
    line-height: 1.5;
  }

  .apply-bar {
    position: sticky;
    bottom: -15px;
    display: grid;
    gap: 6px;
    padding: 12px 0 4px;
    background: #fff;
    border-top: 1px solid #eee5f5;
  }

  .apply-bar button {
    width: 100%;
  }

  .apply-bar .ghost {
    background: transparent;
  }

  .apply-bar small {
    color: #a37935;
    font-size: 10.5px;
  }

  .physics-error {
    margin: 4px 0 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: #fff3f5;
    color: #a24e60;
    font-size: 12px;
    line-height: 1.5;
  }
</style>
