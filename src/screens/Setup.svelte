<script lang="ts">
  import { ArrowRight, Check, Sparkles } from "lucide-svelte";
  import { MAPS } from "../game/maps";
  import TrackThumbnail from "../components/TrackThumbnail.svelte";

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

  let selectedMap = $derived(MAPS.find(map => map.id === mapId));
</script>

<main class="page setup">
  <header class="setup-hero">
    <div>
      <span class="eyebrow"><Sparkles size={13} /> Paso 1 de 3</span>
      <h1>Elegí el trazado que vas a certificar</h1>
      <p>Cada recorrido está dibujado a escala real a partir de su geometría. Después podrás ajustar alturas, radios, fricción y frenado en el laboratorio.</p>
    </div>
  </header>

  <div class="map-grid">
    {#each MAPS as map (map.id)}
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
          <TrackThumbnail config={map.preview} showMarkers={map.id === "reference"} />
          <span class="map-tag">{map.tag}</span>
          {#if mapId === map.id}
            <span class="map-check"><Check size={14} /></span>
          {/if}
        </div>

        <div class="map-body">
          <strong>{map.name}</strong>
          <p>{map.description}</p>
        </div>
      </button>
    {/each}
  </div>

  <footer class="setup-footer">
    <div>
      <span>Tu selección</span>
      <strong>{selectedMap?.name ?? "Seleccioná un recorrido"}</strong>
    </div>

    <div class="setup-footer-actions">
      <button class="secondary" type="button" onclick={onBack}>Volver al inicio</button>
      <button class="primary" type="button" disabled={!selectedMap?.available} onclick={onContinue}>
        Armar el tren <ArrowRight size={16} />
      </button>
    </div>
  </footer>
</main>

<style>
  .setup {
    max-width: 1320px;
  }

  .setup-hero {
    margin: 10px 0 24px;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .setup-hero h1 {
    margin: 8px 0 8px;
    font-size: clamp(26px, 3.6vw, 38px);
    font-weight: 900;
    letter-spacing: -0.8px;
    line-height: 1.1;
  }

  .setup-hero p {
    max-width: 720px;
    margin: 0;
    font-size: 15px;
    line-height: 1.6;
    color: var(--muted);
  }

  .map-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .map-card {
    display: grid;
    grid-template-rows: auto 1fr;
    padding: 0;
    border: 2px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    text-align: left;
    font: inherit;
    color: var(--text);
    cursor: pointer;
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
  }

  .map-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow);
    border-color: var(--border-strong);
  }

  .map-card.selected {
    border-color: var(--primary);
    box-shadow: 0 0 0 4px var(--primary-soft), var(--shadow);
  }

  .map-art {
    position: relative;
    background: linear-gradient(180deg, #ece5fc, #f8f4ff 70%, #dfeede 70%, #d4e6d0);
    padding: 10px 10px 0;
  }

  .map-art :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }

  .map-tag {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 5px 9px;
    border-radius: 999px;
    background: rgb(255 255 255 / 85%);
    color: var(--primary-strong);
    font-size: 10.5px;
    font-weight: 800;
    backdrop-filter: blur(4px);
  }

  .map-check {
    position: absolute;
    top: 10px;
    right: 10px;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--primary);
    color: white;
    box-shadow: var(--shadow-sm);
  }

  .map-body {
    display: grid;
    gap: 4px;
    padding: 14px 16px 16px;
  }

  .map-body strong {
    font-size: 16px;
    font-weight: 900;
  }

  .map-body p {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--muted);
  }

  .setup-footer {
    position: sticky;
    bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-top: 24px;
    padding: 14px 18px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: rgb(255 255 255 / 92%);
    backdrop-filter: blur(8px);
    box-shadow: var(--shadow);
  }

  .setup-footer > div:first-child {
    display: grid;
    gap: 2px;
  }

  .setup-footer span {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .setup-footer strong {
    font-size: 16px;
    font-weight: 900;
  }

  .setup-footer-actions {
    display: flex;
    gap: 8px;
  }

  .setup-footer button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 46px;
    padding: 0 18px;
    border: 1px solid var(--border);
    border-radius: 13px;
    background: var(--surface);
    color: var(--text-soft);
    font: inherit;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
  }

  .setup-footer .primary {
    border: 0;
    background: linear-gradient(180deg, #9a6be0, var(--primary));
    color: white;
    box-shadow: 0 6px 16px rgb(122 75 198 / 28%);
  }

  .setup-footer .primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (max-width: 960px) {
    .map-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 560px) {
    .map-grid {
      grid-template-columns: 1fr;
    }

    .setup-footer {
      flex-direction: column;
      align-items: stretch;
    }

    .setup-footer-actions {
      flex-direction: column;
    }
  }
</style>
