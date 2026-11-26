<script lang="ts">
  import { symbolParts } from "../../ui/format";

  /**
   * Símbolo del anexo con subíndice real (h_L → h con L abajo). Se oculta a
   * los lectores de pantalla: lo acompaña un nombre hablado, que puede venir
   * en `spoken` cuando el texto de al lado no lo dice.
   */
  let { symbol, spoken = "" }: { symbol: string; spoken?: string } = $props();

  let parts = $derived(symbolParts(symbol));
</script>

<span class="sym" aria-hidden="true">{parts.base}{#if parts.sub}<sub>{parts.sub}</sub>{/if}</span>{#if spoken}<span class="spoken">{spoken}</span>{/if}

<style>
  .sym {
    font-style: italic;
    white-space: nowrap;
  }

  .spoken {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  sub {
    font-size: 0.72em;
    font-style: normal;
    line-height: 0;
  }
</style>
