<script lang="ts">
  let {
    kind
  }: {
    kind: "height" | "length" | "cart" | "person";
  } = $props();
</script>

<svg
  class="measure-icon"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if kind === "height"}
    <path
      d="M8 4v16m-3-3 3 3 3-3M5 7l3-3 3 3M15 4h5v16h-5M17 8h3m-3 4h3m-3 4h3"
    />
  {:else if kind === "length"}
    <path
      d="M3 7h18M6 4 3 7l3 3m12-6 3 3-3 3M3 15h18v6H3zM7 15v3m5-3v3m5-3v3"
    />
  {:else if kind === "cart"}
    <path d="M3 7h18l-2 9H5L3 7Zm3 0V4m6 3V4m6 3V4" />
    <circle cx="7" cy="20" r="1.5" />
    <circle cx="17" cy="20" r="1.5" />
  {:else}
    <circle cx="12" cy="6" r="3.5" />
    <path d="M5 21v-3a7 7 0 0 1 14 0v3" />
  {/if}
</svg>

<style>
  .measure-icon {
    flex-shrink: 0;
    width: 19px;
    height: 19px;
    color: #9974b8;
  }
</style>