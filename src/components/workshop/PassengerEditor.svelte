<script lang="ts">
  import { Shuffle, RotateCcw, User } from "lucide-svelte";
  import Avatar, { type Reaction } from "../Avatar.svelte";
  import ColorPicker from "../ColorPicker.svelte";
  import {
    MAX_PASSENGERS,
    MIN_PASSENGER_MASS,
    MAX_PASSENGER_MASS,
    SKIN_COLORS,
    HAIR_COLORS,
    SHIRT_COLORS,
    ACCESSORY_COLORS,
    HAIR_STYLES,
    SHIRT_STYLES,
    ACCESSORIES,
    MOODS,
    resizePassengers,
    createPassenger,
    randomizePassenger,
    type Passenger
  } from "../../game/passengers";

  interface Props {
    passengers: Passenger[];
    cartMass: number;
    /** Error de masas de la sesión (pasajero o carrito fuera de rango). */
    error?: string;
    onChange: (passengers: Passenger[]) => void;
    onCartMass: (value: number) => void;
  }

  let { passengers, cartMass, error = "", onChange, onCartMass }: Props = $props();

  type TabId = "face" | "hair" | "clothes" | "accessories";

  const TABS: { id: TabId; label: string }[] = [
    { id: "face", label: "Rostro" },
    { id: "hair", label: "Cabello" },
    { id: "clothes", label: "Ropa" },
    { id: "accessories", label: "Accesorios" }
  ];

  const REACTIONS: { id: Reaction; label: string; hint: string }[] = [
    { id: "calm", label: "Tranquilo", hint: "En la estación" },
    { id: "airtime", label: "0 g", hint: "Cresta de la colina" },
    { id: "scream", label: "5 g", hint: "Base del loop" }
  ];

  let selected = $state(0);
  let tab = $state<TabId>("face");
  let reaction = $state<Reaction>("calm");

  let index = $derived(Math.min(selected, passengers.length - 1));
  let passenger = $derived(passengers[index]);

  function update(change: Partial<Passenger>) {
    onChange(passengers.map((person, position) => (position === index ? { ...person, ...change } : person)));
  }

  function changeCount(count: number) {
    selected = Math.min(selected, count - 1);
    onChange(resizePassengers(passengers, count));
  }

  /** Error de masa del panel; lo anuncia el campo que lo causa. */
  const MASS_ERROR_ID = "passenger-mass-error";

  /**
   * Número escrito en el campo. Vacío o ilegible no cambia nada: el campo
   * vuelve a mostrar el valor vigente (si no, quedaría «NaN kg» en el asiento).
   */
  function numberFrom(event: Event, current: number): number | null {
    const input = event.currentTarget as HTMLInputElement;
    if (Number.isFinite(input.valueAsNumber)) return input.valueAsNumber;

    input.value = String(current);
    return null;
  }

  function massOutOfRange(mass: number): boolean {
    return mass < MIN_PASSENGER_MASS || mass > MAX_PASSENGER_MASS;
  }
</script>

<div class="editor">
  <div class="count" role="group" aria-label="Cantidad de pasajeros">
    {#each Array.from({ length: MAX_PASSENGERS }, (_, position) => position + 1) as number}
      <button
        type="button"
        class:active={passengers.length === number}
        aria-pressed={passengers.length === number}
        aria-label={`${number} ${number === 1 ? "persona" : "personas"}`}
        onclick={() => changeCount(number)}
      >
        {#each Array.from({ length: number }) as _}<User size={11} strokeWidth={2.6} />{/each}
      </button>
    {/each}
  </div>

  <label class="row">
    <span>Masa de cada carrito vacío</span>
    <span class="value"><input type="number" min="1" max="10000" step="any" value={cartMass} onchange={event => {
      const value = numberFrom(event, cartMass);
      if (value !== null) onCartMass(value);
    }} /> kg</span>
  </label>

  <div class="seats" role="group" aria-label="Pasajeros">
    {#each passengers as person, position (person.id)}
      <button type="button" class="seat" class:active={position === index} aria-pressed={position === index} onclick={() => (selected = position)}>
        <Avatar passenger={person} size={40} />
        <span>{person.name}<small>{person.mass} kg</small></span>
      </button>
    {/each}
  </div>

  {#if error}<p class="error" id={MASS_ERROR_ID} role="alert">{error}</p>{/if}

  {#if passenger}
    <section class="person" aria-label={`Pasajero: ${passenger.name}`}>
      <div class="preview" data-reaction={reaction}>
        <Avatar {passenger} size={104} {reaction} />
        <div class="identity">
          <label class="name">
            <span>Nombre</span>
            <input type="text" maxlength="18" value={passenger.name} oninput={event => update({ name: event.currentTarget.value })} />
          </label>
          <label class="name">
            <span>Masa</span>
            <span class="value">
              <input
                type="number"
                min={MIN_PASSENGER_MASS}
                max={MAX_PASSENGER_MASS}
                step="any"
                value={passenger.mass}
                aria-label={`Masa de ${passenger.name}`}
                aria-invalid={massOutOfRange(passenger.mass)}
                aria-describedby={error ? MASS_ERROR_ID : undefined}
                onchange={event => {
                  const value = numberFrom(event, passenger.mass);
                  if (value !== null) update({ mass: value });
                }}
              />
              kg
            </span>
          </label>
          <div class="reactions" role="group" aria-label="Previsualizar reacción">
            {#each REACTIONS as option (option.id)}
              <button type="button" class:active={reaction === option.id} aria-pressed={reaction === option.id} title={option.hint} onclick={() => (reaction = option.id)}>
                {option.label}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="tabs" role="group" aria-label="Personalización">
        {#each TABS as item (item.id)}
          <button type="button" class:active={tab === item.id} aria-pressed={tab === item.id} onclick={() => (tab = item.id)}>{item.label}</button>
        {/each}
      </div>

      <div class="options">
        {#if tab === "face"}
          <ColorPicker label="Tono de piel" value={passenger.skin} presets={SKIN_COLORS} onChange={skin => update({ skin })} />
          <div class="choices">
            {#each MOODS as mood (mood.id)}
              <button type="button" class="choice" class:active={passenger.mood === mood.id} aria-pressed={passenger.mood === mood.id} title={mood.description} onclick={() => update({ mood: mood.id })}>
                {mood.label}
              </button>
            {/each}
          </div>
        {:else if tab === "hair"}
          <div class="styles">
            {#each HAIR_STYLES as style (style.id)}
              <button type="button" class="style" class:active={passenger.hairStyle === style.id} aria-pressed={passenger.hairStyle === style.id} aria-label={style.label} onclick={() => update({ hairStyle: style.id })}>
                <Avatar passenger={{ ...passenger, hairStyle: style.id, accessory: "none" }} size={38} />
                <span aria-hidden="true">{style.label}</span>
              </button>
            {/each}
          </div>
          <ColorPicker label="Color del cabello" value={passenger.hair} presets={HAIR_COLORS} onChange={hair => update({ hair })} />
        {:else if tab === "clothes"}
          <div class="styles three">
            {#each SHIRT_STYLES as style (style.id)}
              <button type="button" class="style" class:active={passenger.shirtStyle === style.id} aria-pressed={passenger.shirtStyle === style.id} aria-label={style.label} onclick={() => update({ shirtStyle: style.id })}>
                <Avatar passenger={{ ...passenger, shirtStyle: style.id }} size={38} />
                <span aria-hidden="true">{style.label}</span>
              </button>
            {/each}
          </div>
          <ColorPicker label="Color principal" value={passenger.shirt} presets={SHIRT_COLORS} onChange={shirt => update({ shirt })} />
          {#if passenger.shirtStyle !== "plain"}
            <ColorPicker label={passenger.shirtStyle === "stripes" ? "Color de las rayas" : "Cordones y capucha"} value={passenger.shirtAccent} presets={SHIRT_COLORS} onChange={shirtAccent => update({ shirtAccent })} />
          {/if}
        {:else}
          <div class="styles three">
            {#each ACCESSORIES as item (item.id)}
              <button type="button" class="style" class:active={passenger.accessory === item.id} aria-pressed={passenger.accessory === item.id} aria-label={item.label} onclick={() => update({ accessory: item.id })}>
                <Avatar passenger={{ ...passenger, accessory: item.id }} size={38} />
                <span aria-hidden="true">{item.label}</span>
              </button>
            {/each}
          </div>
          {#if passenger.accessory !== "none"}
            <ColorPicker label="Color del accesorio" value={passenger.accessoryColor} presets={ACCESSORY_COLORS} onChange={accessoryColor => update({ accessoryColor })} />
          {/if}
        {/if}
      </div>

      <div class="actions">
        <button type="button" onclick={() => update(randomizePassenger(passenger, Date.now() + index))}><Shuffle size={14} /> Sorpréndeme</button>
        <button type="button" onclick={() => update({ ...createPassenger(passenger.id), mass: passenger.mass })}><RotateCcw size={14} /> Restablecer</button>
      </div>
    </section>
  {/if}

  <p class="note">Solo la masa entra en la física; el resto cambia cómo reaccionan en el recorrido.</p>
</div>

<style>
  .editor {
    display: grid;
    gap: 12px;
  }

  .count,
  .tabs,
  .reactions {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 4px;
    padding: 4px;
    border-radius: 12px;
    background: var(--surface-muted);
  }

  .count button,
  .tabs button,
  .reactions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 1px;
    height: 30px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--text-soft);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .count button.active,
  .tabs button.active,
  .reactions button.active {
    background: var(--surface);
    color: var(--primary-strong);
    box-shadow: var(--shadow-sm);
  }

  .row,
  .name {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12.5px;
    font-weight: 800;
  }

  .value {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    color: var(--muted);
  }

  input {
    height: 30px;
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    font: inherit;
    font-size: 13px;
    font-weight: 800;
    color: var(--text);
  }

  input[type="number"] {
    width: 70px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  input[type="text"] {
    width: 110px;
  }

  .seats {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .seat {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 4px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 12.5px;
    font-weight: 800;
    text-align: left;
    cursor: pointer;
  }

  .seat span {
    display: grid;
  }

  .seat small {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--muted);
  }

  .seat.active {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-soft);
  }

  .error {
    margin: 0;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--danger-soft);
    color: #9d2a39;
    font-size: 12px;
    font-weight: 700;
  }

  .person {
    display: grid;
    gap: 10px;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface-soft);
  }

  .preview {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 10px;
  }

  .identity {
    display: grid;
    gap: 8px;
  }

  .options {
    display: grid;
    gap: 10px;
  }

  .choices {
    display: flex;
    gap: 6px;
  }

  .choice {
    flex: 1;
    height: 30px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--surface);
    color: var(--text-soft);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .choice.active,
  .style.active {
    border-color: var(--primary);
    color: var(--primary-strong);
    box-shadow: 0 0 0 2px var(--primary-soft);
  }

  .styles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .style {
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 6px 4px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text-soft);
    font: inherit;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  .actions button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 10px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--surface);
    color: var(--text-soft);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .note {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--muted);
  }
</style>
