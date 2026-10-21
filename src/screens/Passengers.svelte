<script lang="ts">
  import "../styles/passenger-extras.css";

  import Avatar from "../components/Avatar.svelte";
  import ColorPicker from "../components/ColorPicker.svelte";

  import {
    MAX_PASSENGERS,
    MIN_PASSENGER_MASS,
    MAX_PASSENGER_MASS,
    normalizePassengerMass,
    resizePassengers,
    calculateCartCount,
    calculateTotalMass,
    createPassenger,
    type Passenger
  } from "../game/passengers";

  let {
    passengers,
    onBack,
    onStart,
    onChange
  }: {
    passengers: Passenger[];
    onBack: () => void;
    onStart: () => void;
    onChange: (passengers: Passenger[]) => void;
  } = $props();

  let selected = $state(0);

  let passenger = $derived(passengers[selected]);
  let cartCount = $derived(calculateCartCount(passengers));

  const skinColors = [
    "#f4d5b5",
    "#dca577",
    "#a86d48",
    "#67412e"
  ];

  const hairColors = [
    "#382921",
    "#17151a",
    "#b47c38",
    "#805c48"
  ];

  const shirtColors = [
    "#8050cf",
    "#338fc2",
    "#399b77",
    "#d86d85",
    "#e6ae3b"
  ];

  const hatColors = [
    "#439c79",
    "#8050cf",
    "#338fc2",
    "#d86d85",
    "#e6ae3b"
  ];

  const hairStyles: {
    id: Passenger["hairStyle"];
    label: string;
  }[] = [
    { id: "short", label: "Corto" },
    { id: "long", label: "Largo" },
    { id: "shaved", label: "Rapado" }
  ];

  function updatePassenger(change: Partial<Passenger>) {
    onChange(
      passengers.map((person, index) =>
        index === selected
          ? { ...person, ...change }
          : person
      )
    );
  }

  function changeCount(count: number) {
    const updated = resizePassengers(passengers, count);

    selected = Math.min(selected, updated.length - 1);
    onChange(updated);
  }

  function updateMass(input: HTMLInputElement) {
    const mass = normalizePassengerMass(input.valueAsNumber);

    input.value = String(mass);
    updatePassenger({ mass });
  }

  function resetAppearance() {
    if (!passenger) return;

    const defaults = createPassenger(passenger.id);

    updatePassenger({
      skin: defaults.skin,
      hair: defaults.hair,
      hairStyle: defaults.hairStyle,
      shirt: defaults.shirt,
      hat: defaults.hat,
      hatColor: defaults.hatColor
    });
  }
</script>

<main class="page passengers-page">
  <div class="passengers-heading">
    <div>
      <span class="passengers-eyebrow">
        UN EQUIPO CON PERSONALIDAD
      </span>

      <h1>Listos para subir.</h1>
      <p>Elegí a cada pasajero y dale su propio estilo.</p>
    </div>
  </div>

  <section class="party-panel" aria-labelledby="party-title">
    <div class="party-copy">
      <span class="party-mark" aria-hidden="true">＋</span>

      <div>
        <h2 id="party-title">¿Quiénes se suben?</h2>
        <p>Hasta cuatro personas. Dos asientos por carrito.</p>
      </div>
    </div>

    <div
      class="party-choices"
      role="group"
      aria-label="Cantidad de pasajeros"
    >
      {#each Array.from({ length: MAX_PASSENGERS }, (_, index) => index + 1) as number}
        <button
          class="party-option"
          class:active={passengers.length === number}
          type="button"
          aria-label={`${number} ${number === 1 ? "persona" : "personas"}`}
          aria-pressed={passengers.length === number}
          onclick={() => changeCount(number)}
        >
          <span class="party-icons" aria-hidden="true">
            {#each Array.from({ length: number }) as _}
              <svg viewBox="0 0 16 23">
                <circle
                  cx="8"
                  cy="5"
                  r="4"
                  fill="currentColor"
                />

                <path
                  d="M1 21V16Q1 10 8 10T15 16V21Z"
                  fill="currentColor"
                />
              </svg>
            {/each}
          </span>

          <span>{number}</span>
        </button>
      {/each}
    </div>
  </section>

  <div class="customization-layout">
    <section
      class="character-workspace"
      aria-label="Personalización del pasajero"
    >
      {#if passenger}
        <div class="character-preview">
          <span class="character-label">VISTA PREVIA</span>

          <div class="character-stage">
            <div class="character-halo"></div>

            <div class="hero-avatar">
              <Avatar {passenger} />
            </div>

            <div class="character-shadow"></div>
          </div>

          <h2>Persona {passenger.id}</h2>

          <p>
            Carrito {Math.floor(selected / 2) + 1} ·
            Asiento {(selected % 2) + 1}
          </p>

          <span class="preview-note">
            Los cambios se guardan al instante
          </span>
        </div>

        <div class="character-tools">
          <div class="tools-heading">
            <h2>Su propio estilo</h2>

            <button
              type="button"
              onclick={resetAppearance}
            >
              Restablecer
            </button>
          </div>

          <section
            class="passenger-mass"
            aria-label="Masa del pasajero"
          >
            <div class="mass-heading">
              <label for="passenger-mass-input">
                Masa de la persona
              </label>

              <strong>{passenger.mass} kg</strong>
            </div>

            <div class="mass-inputs">
              <input
                type="range"
                aria-label="Ajustar masa del pasajero"
                min={MIN_PASSENGER_MASS}
                max={MAX_PASSENGER_MASS}
                step="0.1"
                value={passenger.mass}
                oninput={(event) => updateMass(event.currentTarget)}
              />

              <label class="mass-number">
                <input
                  id="passenger-mass-input"
                  type="number"
                  min={MIN_PASSENGER_MASS}
                  max={MAX_PASSENGER_MASS}
                  step="0.1"
                  value={passenger.mass}
                  onchange={(event) => updateMass(event.currentTarget)}
                />

                <span>kg</span>
              </label>
            </div>

            <p>
              Entre {MIN_PASSENGER_MASS} y {MAX_PASSENGER_MASS} kg.
              Se incluye en la masa total del tren.
            </p>
          </section>

          <ColorPicker
            label="Tono de piel"
            value={passenger.skin}
            presets={skinColors}
            onChange={(skin) => updatePassenger({ skin })}
          />

          <fieldset class="hair-control">
            <legend>Estilo de cabello</legend>

            <div class="hair-options">
              {#each hairStyles as style}
                <button
                  type="button"
                  class:active={passenger.hairStyle === style.id}
                  aria-pressed={passenger.hairStyle === style.id}
                  onclick={() =>
                    updatePassenger({ hairStyle: style.id })}
                >
                  {style.label}
                </button>
              {/each}
            </div>
          </fieldset>

          <ColorPicker
            label="Color del cabello"
            value={passenger.hair}
            presets={hairColors}
            onChange={(hair) => updatePassenger({ hair })}
          />

          <ColorPicker
            label="Color de camisa"
            value={passenger.shirt}
            presets={shirtColors}
            onChange={(shirt) => updatePassenger({ shirt })}
          />

          <div class="hat-control">
            <div>
              <strong>Una gorra para el viaje</strong>
              <span>Accesorio opcional</span>
            </div>

            <label class="hat-toggle">
              <input
                type="checkbox"
                checked={passenger.hat}
                onchange={(event) =>
                  updatePassenger({
                    hat: event.currentTarget.checked
                  })}
              />

              <span>Usar gorra</span>
            </label>
          </div>

          {#if passenger.hat}
            <ColorPicker
              label="Color de gorra"
              value={passenger.hatColor}
              presets={hatColors}
              onChange={(hatColor) =>
                updatePassenger({ hatColor })}
            />
          {/if}
        </div>
      {/if}
    </section>

    <aside class="crew-panel" aria-label="Pasajeros del tren">
      <div class="crew-heading">
        <h2>Tu equipo</h2>
        <span>{passengers.length} / {MAX_PASSENGERS}</span>
      </div>

      <p class="crew-intro">
        Seleccioná una persona para editarla.
      </p>

      {#each Array.from({ length: cartCount }) as _, cartIndex}
        <div class="crew-cart">
          <h3>
            Carrito {cartIndex + 1}
            <span>2 asientos</span>
          </h3>

          <div class="crew-list">
            {#each passengers.slice(cartIndex * 2, cartIndex * 2 + 2) as person, seat}
              <button
                class="passenger-choice"
                class:active={selected === cartIndex * 2 + seat}
                type="button"
                aria-pressed={selected === cartIndex * 2 + seat}
                onclick={() => (selected = cartIndex * 2 + seat)}
              >
                <Avatar passenger={person} />

                <span>
                  <strong>Persona {person.id}</strong>
                  <small>
                    Asiento {seat + 1} · {person.mass} kg
                  </small>
                </span>

                <span
                  class="choice-dot"
                  aria-hidden="true"
                ></span>
              </button>
            {/each}
          </div>
        </div>
      {/each}

      <div class="crew-summary">
        <div>
          <span>Carritos</span>
          <strong>{cartCount}</strong>
        </div>

        <div>
          <span>Masa total inicial</span>
          <strong>{calculateTotalMass(passengers)} kg</strong>
        </div>
      </div>

      <p class="crew-note">
        La apariencia no cambia la masa.
        Podés ajustar las masas en el simulador.
      </p>

      <button
        class="game-button"
        type="button"
        onclick={onStart}
      >
        Ir al recorrido →
      </button>
    </aside>
  </div>
</main>