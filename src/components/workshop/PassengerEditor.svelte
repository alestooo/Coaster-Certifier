<script lang="ts">
  import { Shuffle, RotateCcw, User } from "lucide-svelte";
  import Avatar, { type Reaction } from "../Avatar.svelte";
  import ColorPicker from "../ColorPicker.svelte";
  import NumberField from "../ui/NumberField.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Tabs from "../ui/Tabs.svelte";
  import Button from "../ui/Button.svelte";
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

  /** Reacción de muestra y dónde se ve en el recorrido (nombre accesible). */
  const REACTION_OPTIONS: { value: Reaction; label: string; ariaLabel: string }[] = [
    { value: "calm", label: "Tranquilo", ariaLabel: "Tranquilo: en la estación" },
    { value: "airtime", label: "0 g", ariaLabel: "0 g: cresta de la colina" },
    { value: "scream", label: "5 g", ariaLabel: "5 g: base del loop" }
  ];

  const COUNT_OPTIONS = Array.from({ length: MAX_PASSENGERS }, (_, position) => {
    const number = position + 1;
    return { value: String(number), label: String(number), icon: User, ariaLabel: `${number} ${number === 1 ? "pasajero" : "pasajeros"}` };
  });

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

  function massOutOfRange(mass: number): boolean {
    return mass < MIN_PASSENGER_MASS || mass > MAX_PASSENGER_MASS;
  }
</script>

<div class="editor">
  <Segmented label="Cantidad de pasajeros" block value={String(passengers.length)} options={COUNT_OPTIONS} onChange={value => changeCount(Number(value))} />

  <div class="row">
    <span>Masa por carrito (vacío)</span>
    <NumberField value={cartMass} step={1} unit="kg" label="Masa por carrito (vacío)" onCommit={onCartMass} />
  </div>

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
          <div class="name">
            <span>Masa</span>
            <span class="value">
              <!-- Un campo vacío o ilegible no cambia nada (sin «NaN kg»). -->
              <NumberField
                value={passenger.mass}
                step={1}
                unit="kg"
                label={`Masa de ${passenger.name}`}
                invalid={massOutOfRange(passenger.mass)}
                describedBy={error ? MASS_ERROR_ID : undefined}
                onCommit={value => update({ mass: value })}
              />
            </span>
          </div>
          <Segmented label="Previsualizar reacción" size="sm" block value={reaction} options={REACTION_OPTIONS} onChange={value => (reaction = value)} />
        </div>
      </div>

      <Tabs label="Personalización" tabs={TABS} active={tab} onChange={id => (tab = id as TabId)}>
        {#snippet children(current)}
      <div class="options">
        {#if current === "face"}
          <ColorPicker label="Tono de piel" value={passenger.skin} presets={SKIN_COLORS} onChange={skin => update({ skin })} />
          <fieldset class="mood">
            <legend>Actitud</legend>
            <div class="choices">
              {#each MOODS as mood (mood.id)}
                <button type="button" class="choice" class:active={passenger.mood === mood.id} aria-pressed={passenger.mood === mood.id} title={mood.description} onclick={() => update({ mood: mood.id })}>
                  {mood.label}
                </button>
              {/each}
            </div>
          </fieldset>
        {:else if current === "hair"}
          <div class="styles">
            {#each HAIR_STYLES as style (style.id)}
              <button type="button" class="style" class:active={passenger.hairStyle === style.id} aria-pressed={passenger.hairStyle === style.id} aria-label={style.label} onclick={() => update({ hairStyle: style.id })}>
                <Avatar passenger={{ ...passenger, hairStyle: style.id, accessory: "none" }} size={38} />
                <span aria-hidden="true">{style.label}</span>
              </button>
            {/each}
          </div>
          <ColorPicker label="Color del cabello" value={passenger.hair} presets={HAIR_COLORS} onChange={hair => update({ hair })} />
        {:else if current === "clothes"}
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
        {/snippet}
      </Tabs>

      <div class="actions">
        <Button size="sm" variant="secondary" onclick={() => update(randomizePassenger(passenger, Date.now() + index))}><Shuffle size={14} /> Sorprendeme</Button>
        <Button size="sm" variant="secondary" onclick={() => update({ ...createPassenger(passenger.id), mass: passenger.mass })}><RotateCcw size={14} /> Restablecer aspecto</Button>
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
    color: var(--danger-text);
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

  .mood {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  /* Mismo rótulo que los grupos de color. */
  .mood legend {
    margin-bottom: var(--space-2);
    color: var(--text-soft);
    font-size: var(--text-12);
    font-weight: var(--weight-bold);
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

  .note {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--muted);
  }
</style>
