<script lang="ts">
  import { Play, Info, Sparkles } from "lucide-svelte";

  let {
    onPlay,
    onCredits
  }: {
    onPlay: () => void;
    onCredits: () => void;
  } = $props();
</script>

<section class="menu-screen" aria-label="Menú principal de Coaster-Certifier">
  <div class="version-badge">AVANCE 2 · v0.9</div>

  <div class="menu-content">
    <h1 class="menu-title">
      <img class="menu-logo" src="/assets/images/coaster-certifier-logo.png" alt="Coaster-Certifier" />
    </h1>

    <p class="menu-tagline">
      Diseñá una montaña rusa, subí a tus pasajeros y comprobá con física si el trazado aprueba.
    </p>

    <nav class="menu-actions" aria-label="Opciones">
      <button type="button" class="game-button" onclick={onPlay}>
        <Play size={20} /> Diseñar y certificar
      </button>

      <button type="button" class="game-button secondary" onclick={onCredits}>
        <Info size={16} /> Créditos
      </button>
    </nav>

    <ul class="menu-features">
      <li><Sparkles size={13} /> Loops en lágrima, colinas y frenado a escala</li>
      <li><Sparkles size={13} /> Dictamen con puntos críticos A–F</li>
      <li><Sparkles size={13} /> Gráficas, informe y CSV auditables</li>
    </ul>
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

  .menu-features {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .menu-features li {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 999px;
    background: rgb(31 20 68 / 55%);
    color: rgb(255 255 255 / 88%);
    font-size: 12px;
    font-weight: 700;
    backdrop-filter: blur(6px);
  }
</style>
