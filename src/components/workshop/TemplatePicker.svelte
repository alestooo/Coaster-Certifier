<script lang="ts">
  import { BookOpen, ChevronDown, CircleCheck, CircleX } from "lucide-svelte";
  import TrackThumbnail from "../TrackThumbnail.svelte";
  import { MAPS, mapName, type MapId } from "../../game/maps";
  import { SCENARIO_CARDS, type ScenarioId } from "../../game/scenarios";

  interface Props {
    mapId: MapId;
    onTemplate: (mapId: MapId) => void;
    onScenario: (id: ScenarioId) => void;
    /** Abre la guía con los criterios: en el teléfono la barra no tiene lugar para su botón. */
    onGuide: () => void;
  }

  let { mapId, onTemplate, onScenario, onGuide }: Props = $props();

  const POPOVER_ID = "template-picker";
  let popover: HTMLElement;

  function choose(action: () => void) {
    popover.hidePopover();
    action();
  }
</script>

<button type="button" class="trigger" popovertarget={POPOVER_ID} aria-haspopup="dialog" title="Elegir trazado o escenario">
  <span class="name">{mapName(mapId)}</span>
  <ChevronDown size={15} />
</button>

<div id={POPOVER_ID} popover="auto" class="picker" bind:this={popover} role="dialog" aria-label="Trazados y escenarios">
  <section>
    <h2>Trazados</h2>
    <ul class="maps">
      {#each MAPS.filter(map => map.available) as map (map.id)}
        <li>
          <button type="button" class="map" class:current={map.id === mapId} aria-current={map.id === mapId} onclick={() => choose(() => onTemplate(map.id))}>
            <TrackThumbnail config={map.template} class="thumb" />
            <span class="map-name">{map.name}</span>
            <span class="map-tag">{map.tag}</span>
          </button>
        </li>
      {/each}
    </ul>
  </section>

  <section>
    <div class="cases-head">
      <h2>Escenarios</h2>
      <button type="button" class="guide" onclick={() => choose(onGuide)}><BookOpen size={14} /> Ver en la guía</button>
    </div>
    <ul class="cases">
      {#each SCENARIO_CARDS as card (card.id)}
        <li>
          <button type="button" class="case" onclick={() => choose(() => onScenario(card.id))}>
            <span class="case-icon" class:ok={card.approved}>
              {#if card.approved}<CircleCheck size={15} />{:else}<CircleX size={15} />{/if}
            </span>
            <span class="case-text">
              <span class="case-title">{card.title}</span>
              <span class="case-summary">{card.summary}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </section>
</div>

<style>
  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    min-width: 0;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 15px;
    font-weight: 900;
    cursor: pointer;
  }

  .trigger:hover {
    background: var(--surface-soft);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .picker {
    inset: 56px auto auto 52px;
    width: min(620px, calc(100vw - 24px));
    max-height: calc(100dvh - 72px);
    margin: 0;
    padding: 14px;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    color: var(--text);
    box-sizing: border-box;
  }

  h2 {
    margin: 2px 2px 10px;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .cases-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }

  .cases-head h2 {
    margin-bottom: 0;
  }

  .guide {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 28px;
    padding: 0 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--primary-strong);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .guide:hover {
    background: var(--primary-soft);
  }

  section + section {
    margin-top: 14px;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .maps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .map {
    display: grid;
    gap: 3px;
    width: 100%;
    padding: 6px 6px 8px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s, transform 0.15s;
  }

  .map:hover {
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }

  .map.current {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-soft);
  }

  .map :global(.thumb) {
    border-radius: 8px;
    aspect-ratio: 16 / 7;
    object-fit: cover;
  }

  .map-name {
    font-size: 13px;
    font-weight: 900;
  }

  .map-tag {
    font-size: 11px;
    line-height: 1.3;
    color: var(--muted);
  }

  .cases {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .case {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: var(--surface-soft);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .case:hover {
    border-color: var(--border-strong);
  }

  .case-icon {
    display: inline-flex;
    padding-top: 1px;
    color: var(--danger);
  }

  .case-icon.ok {
    color: var(--success);
  }

  .case-text {
    display: grid;
    gap: 2px;
  }

  .case-title {
    font-size: 12.5px;
    font-weight: 800;
  }

  .case-summary {
    font-size: 11px;
    line-height: 1.35;
    color: var(--muted);
  }

  @media (max-width: 700px) {
    .picker {
      inset: 56px 12px auto 12px;
      width: auto;
    }

    .maps {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .cases {
      grid-template-columns: 1fr;
    }
  }
</style>
