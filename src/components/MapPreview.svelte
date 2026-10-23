<script lang="ts">
  let {
    kind
  }: {
    kind: string;
  } = $props();
</script>

<svg
  class="map-preview"
  viewBox="0 0 320 170"
  aria-hidden="true"
>
  <rect
    width="320"
    height="170"
    fill={kind === "valley"
      ? "#e1f0e9"
      : kind === "custom"
        ? "#f5e8e0"
        : kind === "reference"
          ? "#fdf0dd"
          : kind === "incline"
            ? "#e6ecf7"
            : "#eae3f8"}
  />

  <circle
    cx="270"
    cy="32"
    r="18"
    fill="#fff0c5"
  />

  <path
    d="M0 146Q70 119 130 145Q230 116 320 143V170H0Z"
    fill="#c5decf"
  />

  <g
    fill="none"
    stroke="#71508e"
    stroke-width="6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    {#if kind === "slope"}
      <path
        d="M20 38L205 133Q215 140 230 140H300"
      />
    {:else if kind === "incline"}
      <path d="M20 36L230 140H300" />
    {:else if kind === "reference"}
      <path
        d="M14 34C40 50 42 139 80 139H105C147 139 147 55 105 55C70 55 72 139 112 139H150Q190 85 230 139H302"
      />
      <g fill="#8050c8" font-size="11" font-weight="700" font-family="system-ui">
        <text x="8" y="26">A</text>
        <text x="92" y="156">B</text>
        <text x="100" y="48">C</text>
        <text x="186" y="94">D</text>
        <text x="232" y="156">E</text>
      </g>
    {:else if kind === "valley"}
      <path
        d="M20 40C60 55 75 139 120 139S172 73 204 73S250 139 300 139"
      />
    {:else if kind === "loop"}
      <path
        d="M15 37C50 55 55 139 105 139H160C204 139 204 53 160 53C116 53 116 139 160 139H213Q235 109 256 139H302"
      />
    {:else}
      <path
        d="M17 39Q40 135 70 135C100 135 100 80 73 80C46 80 46 135 73 135Q115 70 144 135C174 135 174 80 147 80C120 80 120 135 147 135H225C255 135 255 80 228 80C201 80 201 135 228 135H301"
      />
    {/if}
  </g>

  {#if kind === "custom"}
    <g
      fill="#e6b553"
      stroke="white"
      stroke-width="2"
    >
      <circle cx="17" cy="39" r="6" />
      <circle cx="73" cy="135" r="6" />
      <circle cx="144" cy="135" r="6" />
      <circle cx="228" cy="135" r="6" />
      <circle cx="301" cy="135" r="6" />
    </g>
  {/if}
</svg>

<style>
  .map-preview {
    display: block;
    width: 100%;
    height: auto;
  }
</style>