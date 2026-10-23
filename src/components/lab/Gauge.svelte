<script lang="ts">
  /** Indicador semicircular genérico (rapidez, carga, etc.). */
  type Zone = { from: number; to: number; color: string };

  let {
    value,
    min,
    max,
    zones = [],
    label,
    unit,
    display,
    sublabel = "",
    ticks = []
  }: {
    value: number;
    min: number;
    max: number;
    zones?: Zone[];
    label: string;
    unit: string;
    display: string;
    sublabel?: string;
    ticks?: { at: number; text: string }[];
  } = $props();

  const CX = 100;
  const CY = 96;
  const R = 78;
  const START = Math.PI;

  function angleFor(amount: number) {
    const fraction = Math.max(0, Math.min(1, (amount - min) / (max - min)));
    return START + fraction * Math.PI;
  }

  function point(angle: number, radius: number) {
    return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
  }

  function arc(from: number, to: number, radius: number) {
    const a = point(angleFor(from), radius);
    const b = point(angleFor(to), radius);
    const large = angleFor(to) - angleFor(from) > Math.PI ? 1 : 0;
    return `M${a.x.toFixed(2)} ${a.y.toFixed(2)} A${radius} ${radius} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  }

  let needleAngle = $derived(angleFor(value));
  let needleTip = $derived(point(needleAngle, R - 10));
  let needleTail = $derived(point(needleAngle + Math.PI, 12));
</script>

<figure class="gauge">
  <svg viewBox="0 0 200 118" role="img" aria-label={`${label}: ${display} ${unit}`}>
    <path d={arc(min, max, R)} class="gauge-track" />

    {#each zones as zone}
      <path d={arc(Math.max(min, zone.from), Math.min(max, zone.to), R)} stroke={zone.color} class="gauge-zone" />
    {/each}

    {#each ticks as tick}
      {@const outer = point(angleFor(tick.at), R + 2)}
      {@const inner = point(angleFor(tick.at), R - 9)}
      {@const text = point(angleFor(tick.at), R + 13)}
      <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} class="gauge-tick" />
      <text x={text.x} y={text.y} class="gauge-tick-text">{tick.text}</text>
    {/each}

    <line x1={needleTail.x} y1={needleTail.y} x2={needleTip.x} y2={needleTip.y} class="gauge-needle" />
    <circle cx={CX} cy={CY} r="6" class="gauge-hub" />
  </svg>

  <figcaption>
    <strong>{display}<small>{unit}</small></strong>
    <span>{label}</span>
    {#if sublabel}<em>{sublabel}</em>{/if}
  </figcaption>
</figure>

<style>
  .gauge {
    position: relative;
    margin: 0;
    display: grid;
    justify-items: center;
  }

  svg {
    width: 100%;
    max-width: 190px;
    height: auto;
    overflow: visible;
  }

  .gauge-track {
    fill: none;
    stroke: var(--surface-muted);
    stroke-width: 12;
    stroke-linecap: round;
  }

  .gauge-zone {
    fill: none;
    stroke-width: 12;
    opacity: 0.85;
  }

  .gauge-tick {
    stroke: var(--faint);
    stroke-width: 1.5;
  }

  .gauge-tick-text {
    font-size: 9px;
    font-weight: 700;
    fill: var(--muted);
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .gauge-needle {
    stroke: var(--text);
    stroke-width: 3;
    stroke-linecap: round;
  }

  .gauge-hub {
    fill: var(--text);
    stroke: var(--surface);
    stroke-width: 3;
  }

  figcaption {
    margin-top: -22px;
    display: grid;
    justify-items: center;
    gap: 1px;
    text-align: center;
  }

  figcaption strong {
    font-size: 20px;
    font-weight: 900;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.5px;
  }

  figcaption small {
    margin-left: 3px;
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
  }

  figcaption span {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--muted);
  }

  figcaption em {
    font-style: normal;
    font-size: 10.5px;
    color: var(--faint);
  }
</style>
