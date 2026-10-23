<script lang="ts">
  import { Map as MapIcon, Users, FlaskConical, Home, Lock } from "lucide-svelte";
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
    onNavigate: (screen: "setup" | "passengers" | "simulation") => void;
    canPassengers?: boolean;
    canSimulation?: boolean;
  } = $props();

  const items = [
    { id: "setup", label: "Recorrido", number: 1, icon: MapIcon },
    { id: "passengers", label: "Tren", number: 2, icon: Users },
    { id: "simulation", label: "Certificación", number: 3, icon: FlaskConical }
  ] as const;

  function locked(id: string) {
    if (id === "passengers") return !canPassengers;
    if (id === "simulation") return !canSimulation;
    return false;
  }
</script>

<header class="top-nav">
  <div class="top-nav-inner">
    <button class="nav-brand" type="button" onclick={onHome} aria-label="Volver al inicio">
      <img src="/android-chrome-512x512.png" alt="" />
      <span>
        <strong>Coaster-Certifier</strong>
        <small>Certificador de montañas rusas</small>
      </span>
    </button>

    <nav class="nav-steps" aria-label="Pasos">
      {#each items as item, index}
        <button
          type="button"
          class:active={current === item.id}
          class:done={items.findIndex(step => step.id === current) > index}
          disabled={locked(item.id)}
          aria-current={current === item.id ? "step" : undefined}
          title={locked(item.id) ? "Completá el paso anterior para continuar" : item.label}
          onclick={() => {
            if (!locked(item.id)) onNavigate(item.id);
          }}
        >
          <span class="step-number">{item.number}</span>
          <item.icon size={15} />
          <span class="step-label">{item.label}</span>
          {#if locked(item.id)}<Lock size={12} class="step-lock" />{/if}
        </button>
      {/each}
    </nav>

    <button class="nav-home" type="button" onclick={onHome}><Home size={15} /> Inicio</button>
  </div>
</header>
