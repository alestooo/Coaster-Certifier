<script lang="ts">
  let {
    onPlay,
    onCredits,
  }: {
    onPlay: () => void;
    onCredits: () => void;
  } = $props();
</script>

<section
  class="menu-screen"
  aria-label="Menú principal de Coaster-Certifier"
>
  <div class="version-badge">
    BETA · v0.8
  </div>

  <div class="menu-content">
    <h1 class="menu-title">
      <img
        class="menu-logo"
        src="/assets/images/coaster-certifier-logo.png"
        alt="Coaster-Certifier"
      />
    </h1>

    <nav class="menu-actions" aria-label="Opciones">
      <button
        type="button"
        class="game-button"
        onclick={onPlay}
      >
        Jugar
      </button>

      <button
        type="button"
        class="game-button secondary"
        onclick={onCredits}
      >
        Créditos
      </button>
    </nav>
  </div>
</section>