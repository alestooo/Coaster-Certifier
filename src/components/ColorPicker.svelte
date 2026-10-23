<script lang="ts">
  let {
    label,
    value,
    presets,
    onChange,
    compact = false
  }: {
    label: string;
    value: string;
    presets: string[];
    onChange: (color: string) => void;
    compact?: boolean;
  } = $props();

  let isCustom = $derived(!presets.some(color => color.toLowerCase() === value.toLowerCase()));
</script>

<fieldset class="color-control" class:compact>
  <legend>{label}</legend>

  <div class="color-row">
    {#each presets as color}
      <button
        type="button"
        class="swatch"
        class:active={value.toLowerCase() === color.toLowerCase()}
        style:background-color={color}
        aria-label={`${label}: ${color}`}
        aria-pressed={value.toLowerCase() === color.toLowerCase()}
        onclick={() => onChange(color)}
      ></button>
    {/each}

    <label class="custom" class:active={isCustom} title="Elegir un color personalizado">
      <input
        type="color"
        {value}
        aria-label={`Elegir ${label.toLowerCase()} personalizado`}
        oninput={event => onChange(event.currentTarget.value)}
      />
      <span class="custom-ring" style:background-color={value}></span>
      <span class="custom-plus" aria-hidden="true">+</span>
    </label>
  </div>
</fieldset>

<style>
  .color-control {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    margin-bottom: 8px;
    color: var(--text-soft);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.3px;
  }

  .compact legend {
    font-size: 11px;
  }

  .color-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .swatch {
    width: 30px;
    height: 30px;
    padding: 0;
    border: 2px solid var(--surface);
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--border-strong);
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease;
  }

  .compact .swatch {
    width: 26px;
    height: 26px;
  }

  .swatch:hover {
    transform: scale(1.1);
  }

  .swatch.active {
    box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--primary);
  }

  .custom {
    position: relative;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    margin: 0;
    border-radius: 50%;
    cursor: pointer;
  }

  .compact .custom {
    width: 26px;
    height: 26px;
  }

  .custom input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    opacity: 0;
    cursor: pointer;
  }

  .custom-ring {
    position: absolute;
    inset: 0;
    border: 2px solid var(--surface);
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--border-strong);
    background-image: conic-gradient(#f87171, #fbbf24, #4ade80, #60a5fa, #c084fc, #f87171);
  }

  .custom.active .custom-ring {
    box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--primary);
  }

  .custom-plus {
    position: relative;
    color: #ffffff;
    font-size: 15px;
    font-weight: 900;
    text-shadow: 0 1px 2px rgb(0 0 0 / 45%);
    pointer-events: none;
  }
</style>
