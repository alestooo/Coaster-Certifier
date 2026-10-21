<script lang="ts">
  import "../styles/top-nav.css";

  let {
    current,
    onHome,
    onNavigate,
    canPassengers = false,
    canSimulation = false
  }: {
    current: "setup" | "passengers" | "simulation";
    onHome: () => void;
    onNavigate: (
      screen: "setup" | "passengers" | "simulation"
    ) => void;
    canPassengers?: boolean;
    canSimulation?: boolean;
  } = $props();

  const items = [
    { id: "setup", label: "Recorrido", number: "01" },
    { id: "passengers", label: "Pasajeros", number: "02" },
    { id: "simulation", label: "Simulación", number: "03" }
  ] as const;

  function locked(id: string) {
    if (id === "passengers") return !canPassengers;
    if (id === "simulation") return !canSimulation;
    return false;
  }
</script>

<header class="top-nav">
  <div class="top-nav-inner">
    <button
      class="nav-brand"
      type="button"
      onclick={onHome}
      aria-label="Volver al inicio"
    >
      <img
        src="/assets/images/coaster-certifier-logo.png"
        alt=""
      />

      <span>
        <strong>Coaster-Certifier</strong>
        <small>Tu laboratorio sobre rieles</small>
      </span>
    </button>

    <nav class="nav-links" aria-label="Pasos del recorrido">
      {#each items as item}
        <button
          type="button"
          class:active={current === item.id}
          disabled={locked(item.id)}
          aria-current={current === item.id ? "page" : undefined}
          title={locked(item.id)
            ? "Completá el paso anterior para continuar"
            : item.label}
          onclick={() => {
            if (!locked(item.id)) {
              onNavigate(item.id);
            }
          }}
        >
          <span class="nav-number">{item.number}</span>
          <span>{item.label}</span>

          {#if locked(item.id)}
            <svg
              class="nav-lock"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              aria-hidden="true"
            >
              <rect
                x="5"
                y="9"
                width="10"
                height="8"
                rx="2"
              />
              <path d="M7 9V6a3 3 0 0 1 6 0v3" />
            </svg>
          {/if}
        </button>
      {/each}
    </nav>

    <button class="nav-home" type="button" onclick={onHome}>
      <span aria-hidden="true">⌂</span>
      Inicio
    </button>
  </div>
</header>

<style>
  .nav-lock {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .top-nav .nav-links button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }
</style>