<script lang="ts">
  import { Users, Weight, UserPen } from "lucide-svelte";
  import Avatar from "../Avatar.svelte";
  import { MIN_PASSENGER_MASS, MAX_PASSENGER_MASS, SEATS_PER_CART, type Passenger } from "../../game/passengers";
  import { formatNumber } from "../../ui/format";

  let {
    passengers,
    cartMass,
    masses,
    cartCount,
    onCartMass,
    onPassengerMass,
    onEditPassengers
  }: {
    passengers: Passenger[];
    cartMass: number;
    masses: number[];
    cartCount: number;
    onCartMass: (value: number) => void;
    onPassengerMass: (index: number, value: number) => void;
    onEditPassengers: () => void;
  } = $props();

  let totalMass = $derived(cartCount * cartMass + masses.reduce((sum, mass) => sum + mass, 0));

  function numberFrom(event: Event) {
    return (event.currentTarget as HTMLInputElement).valueAsNumber;
  }
</script>

<div class="train">
  <div class="train-summary">
    <div>
      <span><Users size={13} /> {passengers.length} {passengers.length === 1 ? "pasajero" : "pasajeros"} · {cartCount} {cartCount === 1 ? "carrito" : "carritos"}</span>
      <strong><Weight size={14} /> {formatNumber(totalMass, 1)} kg en total</strong>
    </div>
    <button type="button" onclick={onEditPassengers}><UserPen size={14} /> Editar pasajeros</button>
  </div>

  <label class="cart-mass">
    <span>Masa de cada carrito vacío</span>
    <span class="value"><input type="number" min="1" max="10000" step="any" value={cartMass} onchange={event => onCartMass(numberFrom(event))} /> kg</span>
  </label>

  {#each Array.from({ length: cartCount }) as _, cartIndex}
    <section class="cart">
      <h4>Carrito {cartIndex + 1}</h4>
      {#each passengers.slice(cartIndex * SEATS_PER_CART, cartIndex * SEATS_PER_CART + SEATS_PER_CART) as passenger, seat}
        {@const index = cartIndex * SEATS_PER_CART + seat}
        <div class="seat">
          <Avatar {passenger} size={44} />
          <div class="seat-info">
            <strong>{passenger.name}</strong>
            <span>Asiento {seat + 1}</span>
          </div>
          <label class="seat-mass">
            <input type="number" min={MIN_PASSENGER_MASS} max={MAX_PASSENGER_MASS} step="any" value={masses[index]} aria-label={`Masa de ${passenger.name}`} onchange={event => onPassengerMass(index, numberFrom(event))} />
            <span>kg</span>
          </label>
        </div>
      {/each}
    </section>
  {/each}

  <p class="note">
    La masa escala las fuerzas en newtons y las energías en joules, pero no cambia la rapidez ni las cargas en g: la fricción μ·N también es proporcional a la masa.
  </p>
</div>

<style>
  .train {
    display: grid;
    gap: 12px;
  }

  .train-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-radius: 12px;
    background: var(--primary-soft);
  }

  .train-summary > div {
    display: grid;
    gap: 3px;
  }

  .train-summary span,
  .train-summary strong {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .train-summary span {
    font-size: 11.5px;
    color: var(--text-soft);
  }

  .train-summary strong {
    font-size: 14px;
    color: var(--primary-strong);
  }

  .train-summary button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 12px;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text-soft);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
  }

  .cart-mass {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-soft);
  }

  .value {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--muted);
  }

  .train input[type="number"] {
    width: 80px;
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 12.5px;
    font-weight: 800;
    text-align: right;
  }

  .cart {
    display: grid;
    gap: 8px;
    padding: 10px 12px 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .cart h4 {
    margin: 0;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .seat {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
  }

  .seat-info {
    display: grid;
    gap: 1px;
  }

  .seat-info strong {
    font-size: 13px;
    color: var(--text);
  }

  .seat-info span {
    font-size: 11px;
    color: var(--muted);
  }

  .seat-mass {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--muted);
  }

  .note {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.55;
    color: var(--muted);
  }
</style>
