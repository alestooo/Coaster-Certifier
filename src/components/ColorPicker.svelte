<script lang="ts">
  let {
    label,
    value,
    presets,
    onChange,
  }: {
    label: string;
    value: string;
    presets: string[];
    onChange: (color: string) => void;
  } = $props();
</script>

<fieldset class="color-control">
  <legend>{label}</legend>

  <div class="color-control-row">
    <div class="color-presets">
      {#each presets as color}
        <button
          type="button"
          class="color-dot"
          class:active={value.toLowerCase() === color.toLowerCase()}
          style:background-color={color}
          aria-label={`${label}: ${color}`}
          aria-pressed={value.toLowerCase() === color.toLowerCase()}
          onclick={() => onChange(color)}
        ></button>
      {/each}
    </div>

    <label class="custom-color">
      <input
        type="color"
        value={value}
        aria-label={`Elegir ${label.toLowerCase()} personalizado`}
        oninput={(event) => onChange(event.currentTarget.value)}
      />

      <span>Elegir color</span>
    </label>
  </div>

  <span class="color-value">{value.toUpperCase()}</span>
</fieldset>

<style>
  .color-control {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    margin-bottom: 12px;
    color: #4e3d61;
    font-size: 13px;
    font-weight: 700;
  }

  .color-control-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
  }

  .color-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 11px;
    padding: 3px;
  }

  .color-dot {
    width: 29px;
    height: 29px;
    padding: 0;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 0 0 1px #e0d7ea;
    cursor: pointer;
  }

  .color-dot.active {
    outline: 2px solid #8b5cc7;
    outline-offset: 3px;
  }

  .color-dot:hover {
    transform: scale(1.08);
  }

  .custom-color {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border: 1px solid #e5dced;
    border-radius: 9px;
    color: #76528f;
    background: #fcfaff;
    font-size: 12px;
    cursor: pointer;
  }

  input {
    width: 25px;
    height: 25px;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }

  input::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  input::-webkit-color-swatch {
    border: 0;
    border-radius: 5px;
  }

  input::-moz-color-swatch {
    border: 0;
    border-radius: 5px;
  }

  .color-value {
    display: block;
    margin-top: 9px;
    color: #94819f;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
</style>