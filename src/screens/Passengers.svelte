<script lang="ts">
  import {
    Smile,
    Scissors,
    Shirt,
    Glasses,
    Weight,
    Shuffle,
    RotateCcw,
    User,
    ArrowLeft,
    ArrowRight,
    Sparkles
  } from "lucide-svelte";

  import Avatar, { type Reaction } from "../components/Avatar.svelte";
  import ColorPicker from "../components/ColorPicker.svelte";

  import {
    MAX_PASSENGERS,
    SEATS_PER_CART,
    MIN_PASSENGER_MASS,
    MAX_PASSENGER_MASS,
    CART_MASS,
    SKIN_COLORS,
    HAIR_COLORS,
    SHIRT_COLORS,
    ACCESSORY_COLORS,
    HAIR_STYLES,
    SHIRT_STYLES,
    ACCESSORIES,
    MOODS,
    normalizePassengerMass,
    resizePassengers,
    calculateCartCount,
    calculateTotalMass,
    createPassenger,
    randomizePassenger,
    type Passenger
  } from "../game/passengers";

  import "../styles/passengers.css";

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

  type TabId = "face" | "hair" | "clothes" | "accessories" | "mass";

  const TABS: { id: TabId; label: string; icon: typeof Smile }[] = [
    { id: "face", label: "Rostro", icon: Smile },
    { id: "hair", label: "Cabello", icon: Scissors },
    { id: "clothes", label: "Ropa", icon: Shirt },
    { id: "accessories", label: "Accesorios", icon: Glasses },
    { id: "mass", label: "Masa", icon: Weight }
  ];

  const REACTIONS: { id: Reaction; label: string; hint: string }[] = [
    { id: "calm", label: "Tranquilo", hint: "En la estación" },
    { id: "airtime", label: "Airtime 0 g", hint: "Cresta de la colina" },
    { id: "scream", label: "5 g", hint: "Base del loop" }
  ];

  let selected = $state(0);
  let tab = $state<TabId>("face");
  let reaction = $state<Reaction>("calm");

  let passenger = $derived(passengers[Math.min(selected, passengers.length - 1)]);
  let cartCount = $derived(calculateCartCount(passengers));
  let totalMass = $derived(calculateTotalMass(passengers));

  let carts = $derived(
    Array.from({ length: cartCount }, (_, cart) =>
      passengers.slice(cart * SEATS_PER_CART, cart * SEATS_PER_CART + SEATS_PER_CART)
    )
  );

  function update(change: Partial<Passenger>) {
    onChange(passengers.map((person, index) => (index === selected ? { ...person, ...change } : person)));
  }

  function changeCount(count: number) {
    const updated = resizePassengers(passengers, count);
    selected = Math.min(selected, updated.length - 1);
    onChange(updated);
  }

  function updateMass(input: HTMLInputElement) {
    const mass = normalizePassengerMass(input.valueAsNumber);
    input.value = String(mass);
    update({ mass });
  }

  function surprise() {
    if (!passenger) return;
    onChange(
      passengers.map((person, index) =>
        index === selected ? randomizePassenger(person, Date.now() + index) : person
      )
    );
  }

  function reset() {
    if (!passenger) return;
    const defaults = createPassenger(passenger.id);
    update({ ...defaults, mass: passenger.mass });
  }
</script>

<main class="page passengers-page">
  <header class="passengers-heading">
    <div>
      <span class="passengers-eyebrow">PASO 2 · EL TREN</span>
      <h1>¿Quiénes se suben?</h1>
      <p>Elegí cuántas personas viajan, dale a cada una su estilo y ajustá su masa. Solo la masa entra en la física.</p>
    </div>

    <div class="count-chooser" role="group" aria-label="Cantidad de pasajeros">
      {#each Array.from({ length: MAX_PASSENGERS }, (_, index) => index + 1) as number}
        <button
          type="button"
          class="count-option"
          class:active={passengers.length === number}
          aria-pressed={passengers.length === number}
          aria-label={`${number} ${number === 1 ? "persona" : "personas"}`}
          onclick={() => changeCount(number)}
        >
          <span class="count-icons" aria-hidden="true">
            {#each Array.from({ length: number }) as _}
              <User size={14} strokeWidth={2.4} />
            {/each}
          </span>
          <span class="count-number">{number}</span>
        </button>
      {/each}
    </div>
  </header>

  <div class="passengers-layout">
    <aside class="train-panel" aria-label="Pasajeros del tren">
      <div class="panel-title">
        <h2>Tu tren</h2>
        <span>{passengers.length} / {MAX_PASSENGERS}</span>
      </div>

      {#each carts as seats, cartIndex}
        <section class="cart-card">
          <header>
            <strong>Carrito {cartIndex + 1}</strong>
            <span>{CART_MASS} kg vacío · {SEATS_PER_CART} asientos</span>
          </header>

          {#each seats as person, seat}
            {@const index = cartIndex * SEATS_PER_CART + seat}
            <button
              type="button"
              class="seat"
              class:active={selected === index}
              aria-pressed={selected === index}
              onclick={() => (selected = index)}
            >
              <span class="seat-avatar"><Avatar passenger={person} size={46} /></span>
              <span class="seat-text">
                <strong>{person.name}</strong>
                <small>Asiento {seat + 1} · {person.mass} kg</small>
              </span>
            </button>
          {/each}

          {#if seats.length < SEATS_PER_CART}
            <button type="button" class="seat empty" onclick={() => changeCount(passengers.length + 1)}>
              <span class="seat-avatar placeholder"><User size={20} /></span>
              <span class="seat-text"><strong>Asiento libre</strong><small>Agregar pasajero</small></span>
            </button>
          {/if}
        </section>
      {/each}
    </aside>

    <section class="preview-panel" aria-label="Vista previa del pasajero">
      {#if passenger}
        <div class="preview-stage" data-reaction={reaction}>
          <div class="preview-halo"></div>
          <div class="preview-avatar">
            <Avatar {passenger} size={230} {reaction} />
          </div>
          <div class="preview-shadow"></div>
        </div>

        <label class="name-field">
          <span>Nombre</span>
          <input
            type="text"
            maxlength="18"
            value={passenger.name}
            aria-label="Nombre del pasajero"
            oninput={event => update({ name: event.currentTarget.value })}
          />
        </label>

        <div class="reaction-row" role="group" aria-label="Previsualizar reacción">
          {#each REACTIONS as option}
            <button
              type="button"
              class="reaction-chip"
              class:active={reaction === option.id}
              aria-pressed={reaction === option.id}
              title={option.hint}
              onclick={() => (reaction = option.id)}
            >
              {option.label}
            </button>
          {/each}
        </div>

        <p class="preview-note">
          {MOODS.find(mood => mood.id === passenger.mood)?.description}
        </p>

        <div class="preview-actions">
          <button type="button" class="chip-button" onclick={surprise}>
            <Shuffle size={15} /> Sorpréndeme
          </button>
          <button type="button" class="chip-button ghost" onclick={reset}>
            <RotateCcw size={15} /> Restablecer
          </button>
        </div>
      {/if}
    </section>

    <section class="options-panel" aria-label="Opciones de personalización">
      <nav class="option-tabs" aria-label="Categorías">
        {#each TABS as item}
          {@const Icon = item.icon}
          <button
            type="button"
            class:active={tab === item.id}
            aria-pressed={tab === item.id}
            onclick={() => (tab = item.id)}
          >
            <Icon size={16} strokeWidth={2.2} />
            <span>{item.label}</span>
          </button>
        {/each}
      </nav>

      {#if passenger}
        <div class="option-body">
          {#if tab === "face"}
            <ColorPicker label="Tono de piel" value={passenger.skin} presets={SKIN_COLORS} onChange={skin => update({ skin })} />

            <div class="option-group">
              <h3>Estado de ánimo</h3>
              <div class="mood-cards">
                {#each MOODS as mood}
                  <button
                    type="button"
                    class="mood-card"
                    class:active={passenger.mood === mood.id}
                    aria-pressed={passenger.mood === mood.id}
                    onclick={() => update({ mood: mood.id })}
                  >
                    <strong>{mood.label}</strong>
                    <span>{mood.description}</span>
                  </button>
                {/each}
              </div>
            </div>
          {:else if tab === "hair"}
            <div class="option-group">
              <h3>Estilo</h3>
              <div class="style-grid">
                {#each HAIR_STYLES as style}
                  <button
                    type="button"
                    class="style-card"
                    class:active={passenger.hairStyle === style.id}
                    aria-pressed={passenger.hairStyle === style.id}
                    onclick={() => update({ hairStyle: style.id })}
                  >
                    <span class="style-glyph">
                      <Avatar passenger={{ ...passenger, hairStyle: style.id, accessory: "none" }} size={46} />
                    </span>
                    <span>{style.label}</span>
                  </button>
                {/each}
              </div>
            </div>

            <ColorPicker label="Color del cabello" value={passenger.hair} presets={HAIR_COLORS} onChange={hair => update({ hair })} />
          {:else if tab === "clothes"}
            <div class="option-group">
              <h3>Prenda</h3>
              <div class="style-grid three">
                {#each SHIRT_STYLES as style}
                  <button
                    type="button"
                    class="style-card"
                    class:active={passenger.shirtStyle === style.id}
                    aria-pressed={passenger.shirtStyle === style.id}
                    onclick={() => update({ shirtStyle: style.id })}
                  >
                    <span class="style-glyph"><Avatar passenger={{ ...passenger, shirtStyle: style.id }} size={46} /></span>
                    <span>{style.label}</span>
                  </button>
                {/each}
              </div>
            </div>

            <ColorPicker label="Color principal" value={passenger.shirt} presets={SHIRT_COLORS} onChange={shirt => update({ shirt })} />

            {#if passenger.shirtStyle !== "plain"}
              <ColorPicker label={passenger.shirtStyle === "stripes" ? "Color de las rayas" : "Cordones y capucha"} value={passenger.shirtAccent} presets={SHIRT_COLORS} onChange={shirtAccent => update({ shirtAccent })} />
            {/if}
          {:else if tab === "accessories"}
            <div class="option-group">
              <h3>Accesorio</h3>
              <div class="style-grid three">
                {#each ACCESSORIES as item}
                  <button
                    type="button"
                    class="style-card"
                    class:active={passenger.accessory === item.id}
                    aria-pressed={passenger.accessory === item.id}
                    onclick={() => update({ accessory: item.id })}
                  >
                    <span class="style-glyph"><Avatar passenger={{ ...passenger, accessory: item.id }} size={46} /></span>
                    <span>{item.label}</span>
                  </button>
                {/each}
              </div>
            </div>

            {#if passenger.accessory !== "none"}
              <ColorPicker label="Color del accesorio" value={passenger.accessoryColor} presets={ACCESSORY_COLORS} onChange={accessoryColor => update({ accessoryColor })} />
            {/if}
          {:else}
            <div class="option-group mass-group">
              <div class="mass-heading">
                <h3>Masa de {passenger.name}</h3>
                <strong>{passenger.mass} kg</strong>
              </div>

              <input
                type="range"
                class="mass-slider"
                min={MIN_PASSENGER_MASS}
                max={MAX_PASSENGER_MASS}
                step="0.5"
                value={passenger.mass}
                aria-label="Masa del pasajero"
                oninput={event => updateMass(event.currentTarget)}
              />

              <div class="mass-scale" aria-hidden="true">
                <span>{MIN_PASSENGER_MASS} kg</span>
                <span>{MAX_PASSENGER_MASS} kg</span>
              </div>

              <label class="mass-number">
                <span>Valor exacto</span>
                <input
                  type="number"
                  min={MIN_PASSENGER_MASS}
                  max={MAX_PASSENGER_MASS}
                  step="0.5"
                  value={passenger.mass}
                  onchange={event => updateMass(event.currentTarget)}
                />
                <span>kg</span>
              </label>

              <p class="mass-note">
                <Sparkles size={14} />
                La masa escala las fuerzas y las energías (N, J) pero no cambia la rapidez ni la carga en g:
                un tren lleno y uno vacío recorren la pista igual.
              </p>
            </div>
          {/if}
        </div>
      {/if}
    </section>
  </div>

  <footer class="passengers-footer">
    <div class="footer-summary">
      <div><span>Carritos</span><strong>{cartCount}</strong></div>
      <div><span>Pasajeros</span><strong>{passengers.length}</strong></div>
      <div><span>Masa total del tren</span><strong>{totalMass.toFixed(1)} kg</strong></div>
    </div>

    <div class="footer-actions">
      <button type="button" class="chip-button ghost" onclick={onBack}>
        <ArrowLeft size={16} /> Cambiar recorrido
      </button>
      <button type="button" class="game-button start-button" onclick={onStart}>
        Ir a la certificación <ArrowRight size={18} />
      </button>
    </div>
  </footer>
</main>
