<script lang="ts">
  import type { Passenger } from "../game/passengers";

  let {
    passenger,
  }: {
    passenger: Passenger;
  } = $props();
</script>

<svg
  class="avatar"
  viewBox="0 0 100 120"
  role="img"
  aria-label={`Personaje ${passenger.id}`}
>
  <!-- Cabello largo detrás de la cabeza y a los lados. -->
  {#if passenger.hairStyle === "long"}
    <path
      d="
        M23 43
        Q17 51 17 72
        L18 91
        Q22 100 34 98
        L37 65
        H63
        L66 98
        Q78 100 82 91
        L83 72
        Q83 50 77 43
        Z
      "
      fill={passenger.hair}
    />
  {/if}

  <!-- Camisa -->
  <path
    d="M14 116 V99 Q14 77 37 77 H63 Q86 77 86 99 V116Z"
    fill={passenger.shirt}
    stroke="#37243e"
    stroke-width="2"
  />

  <!-- Cuello -->
  <rect
    x="42"
    y="68"
    width="16"
    height="17"
    rx="5"
    fill={passenger.skin}
  />

  <!-- Cara -->
  <rect
    x="25"
    y="25"
    width="50"
    height="53"
    rx="22"
    fill={passenger.skin}
    stroke="#37243e"
    stroke-width="2"
  />

  <!-- Cabello de arriba -->
  {#if passenger.hairStyle === "long"}
    <path
      d="
        M24 46
        V35
        Q26 17 50 19
        Q73 18 77 39
        L76 48
        Q64 43 58 30
        Q43 43 24 46
        Z
      "
      fill={passenger.hair}
    />
  {:else if passenger.hairStyle === "shaved"}
    <path
      d="
        M27 39
        Q28 25 50 25
        Q72 25 73 39
        L69 35
        Q50 27 31 35
        Z
      "
      fill={passenger.hair}
    />
  {:else}
    <path
      d="
        M24 46
        V35
        Q26 18 50 20
        L70 16
        L67 24
        Q78 30 76 44
        L65 39
        L59 30
        L44 40
        Z
      "
      fill={passenger.hair}
    />
  {/if}

  <!-- Ojos -->
  <ellipse
    cx="39"
    cy="52"
    rx="2.5"
    ry="3.5"
    fill="#282033"
  />

  <ellipse
    cx="61"
    cy="52"
    rx="2.5"
    ry="3.5"
    fill="#282033"
  />

  <!-- Sonrisa -->
  <path
    d="M43 65 Q50 71 57 65"
    fill="none"
    stroke="#754741"
    stroke-width="2"
    stroke-linecap="round"
  />

  <!-- Gorra -->
  {#if passenger.hat}
    <path
      d="M20 35 Q20 10 49 10 Q78 10 78 35Z"
      fill={passenger.hatColor}
      stroke="#37243e"
      stroke-width="2"
    />

    <rect
      x="19"
      y="32"
      width="70"
      height="7"
      rx="3"
      fill={passenger.hatColor}
      stroke="#37243e"
      stroke-width="2"
    />
  {/if}
</svg>

<style>
  .avatar {
    display: block;
    width: 100px;
    height: 120px;
    margin: 0 auto;
  }
</style>