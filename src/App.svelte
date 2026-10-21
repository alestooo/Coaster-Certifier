<script lang="ts">
  import TopNav from "./components/TopNav.svelte";
  import Menu from "./screens/Menu.svelte";
  import Setup from "./screens/Setup.svelte";
  import Passengers from "./screens/Passengers.svelte";
  import Simulation from "./screens/Simulation.svelte";
  import Credits from "./components/Credits.svelte";

  import { createSession } from "./game/session";
  import { MAPS } from "./game/maps";

  import {
    resizePassengers,
    calculateTotalMass,
    MIN_PASSENGER_MASS,
    MAX_PASSENGER_MASS,
    type Passenger
  } from "./game/passengers";

  import { DEFAULT_CONFIG } from "./physics/index.js";

  type Screen =
    | "menu"
    | "setup"
    | "passengers"
    | "simulation";

  let screen = $state<Screen>("menu");
  let showCredits = $state(false);

  // El usuario debe seleccionar explícitamente un recorrido.
  let session = $state({
    ...createSession(),
    mapId: ""
  });

  let routeConfirmed = $state(false);
  let passengersConfirmed = $state(false);

  let routeValid = $derived(
    MAPS.some(
      map =>
        map.id === session.mapId &&
        map.available
    )
  );

  let peopleValid = $derived(
    session.passengers.length >= 1 &&
    session.passengers.length <= 4 &&
    session.passengers.every(
      passenger =>
        Number.isFinite(passenger.mass) &&
        passenger.mass >= MIN_PASSENGER_MASS &&
        passenger.mass <= MAX_PASSENGER_MASS
    )
  );

  let canPassengers = $derived(
    routeConfirmed && routeValid
  );

  let canSimulation = $derived(
    canPassengers &&
    passengersConfirmed &&
    peopleValid
  );

  let simulationConfig = $derived({
    ...DEFAULT_CONFIG,
    mass: calculateTotalMass(session.passengers),
    mapId: session.mapId
  });

  function chooseRoute() {
    routeConfirmed = false;
    passengersConfirmed = false;
  }

  function confirmRoute() {
    if (!routeValid) return;

    session.passengers = resizePassengers(
      session.passengers,
      session.passengerCount
    );

    routeConfirmed = true;
    passengersConfirmed = false;
    screen = "passengers";
  }

  function updatePassengers(updated: Passenger[]) {
    session.passengers = updated;
    session.passengerCount = updated.length;
    passengersConfirmed = false;
  }

  function confirmPeople() {
    if (!canPassengers || !peopleValid) return;

    passengersConfirmed = true;
    screen = "simulation";
  }

  function navigate(next: Exclude<Screen, "menu">) {
    if (
      next === "setup" ||
      (next === "passengers" && canPassengers) ||
      (next === "simulation" && canSimulation)
    ) {
      screen = next;
    }
  }
</script>

{#if screen !== "menu"}
  <TopNav
    current={screen}
    {canPassengers}
    {canSimulation}
    onHome={() => (screen = "menu")}
    onNavigate={navigate}
  />
{/if}

{#if screen === "menu"}
  <Menu
    onPlay={() => (screen = "setup")}
    onCredits={() => (showCredits = true)}
  />
{:else if screen === "setup"}
  <Setup
    bind:mapId={session.mapId}
    onSelect={chooseRoute}
    onBack={() => (screen = "menu")}
    onContinue={confirmRoute}
  />
{:else if screen === "passengers"}
  <Passengers
    passengers={session.passengers}
    onChange={updatePassengers}
    onBack={() => (screen = "setup")}
    onStart={confirmPeople}
  />
{:else if canSimulation}
  <Simulation
    config={simulationConfig}
    passengers={session.passengers}
    onBack={() => (screen = "menu")}
    onEditPassengers={() => (screen = "passengers")}
    onChangeMap={() => (screen = "setup")}
  />
{/if}

<Credits
  open={showCredits}
  onClose={() => (showCredits = false)}
/>