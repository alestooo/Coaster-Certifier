<script lang="ts">
  import type { Snippet } from "svelte";
  import { SlidersHorizontal, Users, ClipboardCheck } from "lucide-svelte";

  type TabId = "design" | "train" | "verdict";

  let {
    active = $bindable<TabId>("design"),
    attention = null,
    design,
    train,
    verdict
  }: {
    active?: TabId;
    attention?: TabId | null;
    design: Snippet;
    train: Snippet;
    verdict: Snippet;
  } = $props();

  const TABS: { id: TabId; label: string; icon: typeof SlidersHorizontal }[] = [
    { id: "design", label: "Diseño", icon: SlidersHorizontal },
    { id: "train", label: "Tren", icon: Users },
    { id: "verdict", label: "Dictamen", icon: ClipboardCheck }
  ];
</script>

<aside class="inspector">
  <div class="inspector-tabs" role="tablist" aria-label="Panel lateral">
    {#each TABS as tab}
      <button
        type="button"
        role="tab"
        aria-selected={active === tab.id}
        class:active={active === tab.id}
        class:attention={attention === tab.id && active !== tab.id}
        onclick={() => (active = tab.id)}
      >
        <tab.icon size={15} />
        <span>{tab.label}</span>
      </button>
    {/each}
  </div>

  <div class="inspector-body">
    {#if active === "design"}
      {@render design()}
    {:else if active === "train"}
      {@render train()}
    {:else}
      {@render verdict()}
    {/if}
  </div>
</aside>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .inspector-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 8px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-soft);
  }

  .inspector-tabs button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 38px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 12.5px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .inspector-tabs button:hover {
    color: var(--text-soft);
  }

  .inspector-tabs button.active {
    background: var(--surface);
    color: var(--primary);
    box-shadow: var(--shadow-sm);
  }

  .inspector-tabs button.attention::after {
    content: "";
    position: absolute;
    top: 7px;
    right: 10px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--danger);
    box-shadow: 0 0 0 3px var(--danger-soft);
  }

  .inspector-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 16px;
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }
</style>
