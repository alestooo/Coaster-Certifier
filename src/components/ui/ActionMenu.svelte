<script lang="ts">
  import { ChevronDown } from "lucide-svelte";
  import { nextIndex } from "../../lib/ui/roving";
  import { placeBelow, LIST_MAX_HEIGHT_PX } from "../../lib/ui/popover-place";
  import type { IconComponent } from "../../lib/ui/icon";

  /**
   * Botón con un menú de acciones (role="menu"): cada opción hace algo, no
   * elige un valor. Teclado: flechas, Home y End recorren; Enter o Espacio
   * ejecutan; Esc cierra y devuelve el foco al botón.
   */
  interface Item {
    id: string;
    label: string;
    icon?: IconComponent;
    onSelect: () => void;
  }

  interface Props {
    label: string;
    icon?: IconComponent;
    items: Item[];
    variant?: "primary" | "secondary";
  }

  let { label, icon: Icon, items, variant = "secondary" }: Props = $props();

  const uid = $props.id();
  let trigger: HTMLButtonElement;
  let menu: HTMLDivElement;
  let entries: HTMLDivElement[] = $state([]);
  let open = $state(false);
  /**
   * El segundo clic sobre el botón cierra: al presionar, la lista (popover
   * con cierre al tocar afuera) ya se cierra sola, y el clic no debe abrirla otra vez.
   */
  let closeOnClick = false;

  function toggleFromClick() {
    if (closeOnClick) {
      closeOnClick = false;
      return;
    }
    show();
  }
  let active = $state(0);
  let place = $state(placeBelow({ top: 0, bottom: 0, left: 0, width: 0 }, 0));

  function show(index = 0) {
    place = placeBelow(trigger.getBoundingClientRect(), window.innerHeight);
    active = index;
    menu.showPopover();
    // Foco ya: una tecla pulsada justo después de abrir no debe caer en el botón.
    entries[index]?.focus();
  }

  function run(index: number) {
    menu.hidePopover();
    trigger.focus();
    items[index].onSelect();
  }

  function triggerKey(event: KeyboardEvent) {
    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    show(event.key === "ArrowUp" ? items.length - 1 : 0);
  }

  function menuKey(event: KeyboardEvent) {
    const next = nextIndex(active, event.key, items.length);

    if (next !== null) {
      event.preventDefault();
      active = next;
      entries[next]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      run(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      menu.hidePopover();
      trigger.focus();
    } else if (event.key === "Tab") {
      menu.hidePopover();
    }
  }

  function toggled(event: ToggleEvent) {
    open = event.newState === "open";
  }
</script>

<button
  bind:this={trigger}
  type="button"
  class="trigger {variant}"
  aria-haspopup="menu"
  aria-expanded={open}
  aria-controls={`${uid}-menu`}
  onpointerdown={() => (closeOnClick = open)}
  onclick={toggleFromClick}
  onkeydown={triggerKey}
>
  {#if Icon}<Icon size={15} />{/if}
  <span>{label}</span>
  <ChevronDown size={15} />
</button>

<div
  bind:this={menu}
  popover="auto"
  id={`${uid}-menu`}
  class="menu"
  class:flip={place.flip}
  role="menu"
  aria-label={label}
  tabindex="-1"
  style:top={`${place.top}px`}
  style:left={`${place.left}px`}
  style:min-width={`${place.minWidth}px`}
  style:max-height={`${LIST_MAX_HEIGHT_PX}px`}
  onkeydown={menuKey}
  ontoggle={toggled}
>
  {#each items as item, index (item.id)}
    {@const ItemIcon = item.icon}
    <!-- El teclado lo maneja el menú (foco itinerante); el clic ejecuta. -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      bind:this={entries[index]}
      class="item"
      role="menuitem"
      tabindex={index === active ? 0 : -1}
      onclick={() => run(index)}
      onpointermove={() => (active = index)}
    >
      {#if ItemIcon}<ItemIcon size={15} />{/if}
      {item.label}
    </div>
  {/each}
</div>

<style>
  .trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    height: var(--control-md);
    padding: 0 var(--space-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: var(--text-13);
    font-weight: var(--weight-bold);
    white-space: nowrap;
    cursor: pointer;
  }

  .trigger.primary {
    border-color: var(--primary);
    background: var(--primary);
    color: var(--on-primary);
  }

  .trigger:hover {
    border-color: var(--primary);
  }

  .trigger:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .menu {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: var(--space-1);
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    color: var(--text);
  }

  .menu.flip {
    translate: 0 -100%;
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-13);
    font-weight: var(--weight-bold);
    white-space: nowrap;
    cursor: pointer;
  }

  .item:focus,
  .item:hover {
    outline: none;
    background: var(--surface-muted);
  }
</style>
