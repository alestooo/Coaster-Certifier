<script lang="ts">
  import { onMount } from "svelte";
  import { whenIdle } from "./lib/idle";
  import Menu from "./screens/Menu.svelte";
  import Credits from "./components/Credits.svelte";
  import LoadError from "./components/LoadError.svelte";
  import { LazyModule } from "./lib/lazy-module.svelte";
  import { createPassenger } from "./game/passengers";

  type Screen = "menu" | "workshop";

  /** Tripulación inicial del taller: dos pasajeros en un carrito. */
  const INITIAL_PASSENGERS = [createPassenger(1), createPassenger(2)];
  /** Sin `requestIdleCallback` (Safari), el taller se precarga a este tiempo del menú. */
  const PREFETCH_FALLBACK_MS = 1500;

  /** El taller (con la física, el lienzo y la auditoría) no frena la portada: baja aparte. */
  const workshop = new LazyModule(() => import("./screens/Workshop.svelte"));

  let screen = $state<Screen>("menu");
  let showCredits = $state(false);
  /** El taller se monta la primera vez y queda vivo (oculto) para no perder el diseño al volver al menú. */
  let workshopOpened = $state(false);

  // Cuando el menú ya se ve, el taller baja en segundo plano: «Diseñar y certificar» abre al instante.
  // Un fallo acá no se muestra: al entrar se vuelve a intentar.
  onMount(() => whenIdle(() => void workshop.load(), PREFETCH_FALLBACK_MS));

  function openWorkshop() {
    void workshop.load();
    workshopOpened = true;
    screen = "workshop";
  }
</script>

{#if screen === "menu"}
  <Menu onPlay={openWorkshop} onCredits={() => (showCredits = true)} />
{/if}

{#if workshopOpened}
  <div class="workshop-host" hidden={screen !== "workshop"}>
    {#await workshop.promise}
      <p class="opening" role="status">Abriendo el taller…</p>
    {:then module}
      {#if module}
        <module.default passengers={INITIAL_PASSENGERS} active={screen === "workshop"} onHome={() => (screen = "menu")} />
      {/if}
    {:catch}
      <div class="opening">
        <!-- Todavía no hay nada diseñado, y recargar es lo único que repara también los archivos
             compartidos que fallaron o una versión nueva publicada mientras tanto. -->
        <LoadError
          message="No se pudo descargar el taller."
          hint="Cuando vuelva la conexión, recargá la página."
          actionLabel="Recargar la página"
          onRetry={() => location.reload()}
        />
      </div>
    {/await}
  </div>
{/if}

<Credits open={showCredits} onClose={() => (showCredits = false)} />

<style>
  .opening {
    display: grid;
    place-items: center;
    min-height: 100svh;
    margin: 0;
    padding: 20px;
    color: var(--muted);
    font-weight: 700;
  }
</style>
