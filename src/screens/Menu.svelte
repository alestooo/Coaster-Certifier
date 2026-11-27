<script lang="ts">
  import { onMount } from "svelte";
  import { Play, Info } from "lucide-svelte";

  let {
    onPlay,
    onCredits
  }: {
    onPlay: () => void;
    onCredits: () => void;
  } = $props();

  const BACKGROUND_VIDEO = "/assets/backgrounds/coaster-menu-fondo.mp4";
  const BACKGROUND_POSTER = "/assets/backgrounds/coaster-menu-fondo-poster.webp";
  const LOGO = "/assets/images/coaster-certifier-logo.webp";
  /** Con movimiento reducido no se monta el video: queda el póster de fondo. */
  const reduceMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  let video = $state<HTMLVideoElement>();
  /** El navegador no dejó reproducir (p. ej. iOS en bajo consumo, que dibuja un botón encima): queda el póster. */
  let blocked = $state(false);

  onMount(() => {
    video?.play()?.catch((error: unknown) => {
      // Solo un bloqueo del autoplay; una reproducción interrumpida (pausa, desmontar) no quita el video.
      if (error instanceof DOMException && error.name === "NotAllowedError") blocked = true;
    });
  });
</script>

<section class="menu-screen" aria-label="Menú principal de Coaster-Certifier">
  {#if !reduceMotion && !blocked}
    <video bind:this={video} class="menu-video" src={BACKGROUND_VIDEO} poster={BACKGROUND_POSTER} autoplay muted loop playsinline aria-hidden="true" tabindex="-1"></video>
  {/if}

  <div class="version-badge">ENTREGA FINAL · v1.0</div>

  <div class="menu-content">
    <h1 class="menu-title">
      <img class="menu-logo" src={LOGO} width="512" height="512" alt="Coaster-Certifier" />
    </h1>

    <p class="menu-tagline">
      Diseñá una montaña rusa, simulá el recorrido con física y dejá que el auditor la certifique o te diga qué ajustar.
    </p>

    <nav class="menu-actions" aria-label="Menú">
      <button type="button" class="game-button" onclick={onPlay}>
        <Play size={20} /> Diseñar y certificar
      </button>

      <button type="button" class="game-button secondary" onclick={onCredits}>
        <Info size={16} /> Créditos
      </button>
    </nav>
  </div>
</section>

<style>
  .menu-tagline {
    max-width: 420px;
    margin: -8px 0 0;
    text-align: center;
    color: rgb(255 255 255 / 86%);
    font-size: 15px;
    line-height: 1.55;
    text-shadow: 0 2px 10px rgb(0 0 0 / 45%);
  }

  .menu-actions .game-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }



</style>
