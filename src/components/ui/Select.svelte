<script lang="ts" generics="T extends string">
  import { Check, ChevronDown } from "lucide-svelte";
  import { nextIndex } from "../../lib/ui/roving";
  import { placeBelow, LIST_MAX_HEIGHT_PX } from "../../lib/ui/popover-place";

  /**
   * Lista desplegable propia (la lista nativa del sistema no sigue el diseño).
   * Teclado: flechas, Home y End recorren; Enter o Espacio eligen; Esc cierra
   * sin cambiar nada; un clic afuera también cierra.
   */
  interface Option {
    value: T;
    label: string;
    description?: string;
  }

  interface Props {
    label: string;
    value: T;
    options: Option[];
    onChange: (value: T) => void;
  }

  let { label, value, options, onChange }: Props = $props();

  const uid = $props.id();

  let trigger: HTMLButtonElement;
  let list: HTMLDivElement;
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
  let place = $state({ top: 0, left: 0, minWidth: 0, flip: false });
  let current = $derived(options.find(option => option.value === value));

  function show() {
    place = placeBelow(trigger.getBoundingClientRect(), window.innerHeight);
    active = Math.max(0, options.findIndex(option => option.value === value));
    list.showPopover();
    // Foco ya: una tecla pulsada justo después de abrir no debe caer en el disparador.
    list.focus();
  }

  function choose(index: number) {
    if (options[index].value !== value) onChange(options[index].value);
    list.hidePopover();
    trigger.focus();
  }

  function triggerKey(event: KeyboardEvent) {
    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    show();
  }

  function listKey(event: KeyboardEvent) {
    const next = nextIndex(active, event.key, options.length);

    if (next !== null) {
      event.preventDefault();
      active = next;
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      list.hidePopover();
      trigger.focus();
    } else if (event.key === "Tab") {
      list.hidePopover();
    }
  }

  function toggled(event: ToggleEvent) {
    open = event.newState === "open";
  }
</script>

<button
  bind:this={trigger}
  type="button"
  class="trigger"
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-controls={`${uid}-list`}
  aria-label={`${label}: ${current?.label ?? ""}`}
  onpointerdown={() => (closeOnClick = open)}
  onclick={toggleFromClick}
  onkeydown={triggerKey}
>
  <span class="value">{current?.label ?? ""}</span>
  <ChevronDown size={15} />
</button>

<div
  bind:this={list}
  popover="auto"
  id={`${uid}-list`}
  class="list"
  class:flip={place.flip}
  role="listbox"
  tabindex="-1"
  aria-label={label}
  aria-activedescendant={open ? `${uid}-option-${active}` : undefined}
  style:top={`${place.top}px`}
  style:left={`${place.left}px`}
  style:min-width={`${place.minWidth}px`}
  style:max-height={`${LIST_MAX_HEIGHT_PX}px`}
  onkeydown={listKey}
  ontoggle={toggled}
>
  {#each options as option, index (option.value)}
    <!-- El teclado lo maneja el listbox (aria-activedescendant); el clic elige. -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      id={`${uid}-option-${index}`}
      class="option"
      class:active={index === active}
      role="option"
      tabindex="-1"
      aria-selected={option.value === value}
      onclick={() => choose(index)}
      onpointermove={() => (active = index)}
    >
      <span class="check">{#if option.value === value}<Check size={14} />{/if}</span>
      <span class="text">
        <span class="label">{option.label}</span>
        {#if option.description}<span class="description">{option.description}</span>{/if}
      </span>
    </div>
  {/each}
</div>

<style>
  .trigger {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-width: 0;
    max-width: 100%;
    height: var(--control-md);
    padding: 0 var(--space-2) 0 var(--space-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: var(--text-13);
    font-weight: var(--weight-bold);
    cursor: pointer;
  }

  .value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trigger:hover {
    border-color: var(--primary);
  }

  .trigger:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .list {
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

  .list.flip {
    translate: 0 -100%;
  }

  .list:focus-visible {
    outline: none;
  }

  .option {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3) var(--space-2) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-13);
    cursor: pointer;
  }

  .option.active {
    background: var(--surface-muted);
  }

  .option[aria-selected="true"] .label {
    color: var(--primary-strong);
  }

  .check {
    display: inline-flex;
    width: 14px;
    padding-top: 1px;
    color: var(--primary);
  }

  .text {
    display: grid;
    gap: 2px;
  }

  .label {
    font-weight: var(--weight-bold);
  }

  .description {
    font-size: var(--text-12);
    color: var(--muted);
  }
</style>
