<script lang="ts">
  import { MAPS } from "../game/maps";
  import MapPreview from "../components/MapPreview.svelte";

  let {
    mapId = $bindable("slope"),
    onContinue,
    onBack,
    onSelect = () => {}
  }: {
    mapId: string;
    onContinue: () => void;
    onBack: () => void;
    onSelect?: () => void;
  } = $props();

  let selectedMap = $derived(
    MAPS.find(map => map.id === mapId)
  );
</script>

<main class="page setup-page">
  <div class="setup-heading">
    <div>
      <span class="setup-eyebrow">
        SEIS FORMAS DE EXPLORAR
      </span>

      <h1>Elegí el recorrido.</h1>

      <p>
        Seleccioná una pista para continuar
        con los pasajeros.
      </p>
    </div>
  </div>

  <div class="map-section-heading">
    <h2>Montañas rusas</h2>
    <span>{MAPS.length} recorridos disponibles</span>
  </div>

  <div class="map-grid four-maps">
    {#each MAPS as map}
      <button
        class="map-card"
        class:selected={mapId === map.id}
        aria-pressed={mapId === map.id}
        type="button"
        onclick={() => {
          mapId = map.id;
          onSelect();
        }}
      >
        <div class="map-art">
          <MapPreview kind={map.id} />

          <span class="map-badge">
            {map.id === "custom"
              ? "Editor de puntos"
              : map.id === "reference"
                ? "Trazado del anexo"
                : "Disponible"}
          </span>
        </div>

        <div class="map-card-body">
          <div class="map-card-title">
            <strong>{map.name}</strong>

            <span class="map-radio" aria-hidden="true">
              {mapId === map.id ? "✓" : ""}
            </span>
          </div>

          <p>{map.description}</p>

          <span class="map-category">
            {map.tag}
          </span>
        </div>
      </button>
    {/each}
  </div>

  <footer class="setup-footer">
    <div>
      <span>Tu selección</span>

      <strong>
        {selectedMap?.name ?? "Seleccioná un recorrido"}
      </strong>
    </div>

    <button
      class="game-button"
      type="button"
      disabled={!selectedMap?.available}
      onclick={onContinue}
    >
      Personalizar pasajeros →
    </button>
  </footer>
</main>

<style>
  .setup-page {
    max-width: 1450px;
  }

  .four-maps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .four-maps .map-card {
    min-height: 0;
  }

  .four-maps .map-card-body {
    padding: 15px;
  }

  .four-maps .map-card-body p {
    min-height: 42px;
    font-size: 12px;
  }

  .four-maps .map-category {
    font-size: 10px;
  }

  .four-maps .map-art {
    min-height: 0;
  }

  .four-maps .map-card-title strong {
    font-size: 15px;
  }

  .game-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (max-width: 900px) {
    .four-maps {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 520px) {
    .four-maps {
      grid-template-columns: 1fr;
    }
  }
</style>