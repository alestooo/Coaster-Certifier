<script lang="ts">
  import type { Passenger } from "../game/passengers";

  export type Reaction = "calm" | "airtime" | "scream" | "scared";

  let {
    passenger,
    size = 120,
    reaction = "calm"
  }: {
    passenger: Passenger;
    size?: number;
    reaction?: Reaction;
  } = $props();

  const OUTLINE = "#37243e";
  const MOUTH = "#7a3f3a";
  const MOUTH_INNER = "#5a2426";

  type Brows = "neutral" | "raised" | "worried" | "flat";
  type Eyes = "open" | "wide" | "closed";
  type Mouth = "smile" | "smirk" | "small" | "grin" | "open" | "wavy";

  /** Expresión resultante del estado de ánimo y de la reacción al recorrido. */
  let expression = $derived.by((): { brows: Brows; eyes: Eyes; mouth: Mouth; sweat: boolean } => {
    const { mood } = passenger;

    if (reaction === "scared") {
      return { brows: "worried", eyes: "closed", mouth: "wavy", sweat: true };
    }

    if (reaction === "scream") {
      return mood === "nervous"
        ? { brows: "worried", eyes: "wide", mouth: "open", sweat: true }
        : { brows: "raised", eyes: "wide", mouth: "open", sweat: false };
    }

    if (reaction === "airtime") {
      return mood === "nervous"
        ? { brows: "worried", eyes: "closed", mouth: "wavy", sweat: true }
        : { brows: "raised", eyes: "wide", mouth: "grin", sweat: false };
    }

    if (mood === "brave") return { brows: "flat", eyes: "open", mouth: "smirk", sweat: false };
    if (mood === "nervous") return { brows: "worried", eyes: "open", mouth: "small", sweat: false };
    return { brows: "neutral", eyes: "open", mouth: "smile", sweat: false };
  });

  let darkerShirt = $derived(shade(passenger.shirt, -0.18));
  let darkerAccessory = $derived(shade(passenger.accessoryColor, -0.22));
  let darkerSkin = $derived(shade(passenger.skin, -0.14));
  let hairShine = $derived(shade(passenger.hair, 0.28));
  let clipId = $derived(`shirt-clip-${passenger.id}-${Math.round(size)}`);

  /** Aclara (positivo) u oscurece (negativo) un color hexadecimal. */
  function shade(hex: string, amount: number): string {
    const value = hex.replace("#", "");
    const full = value.length === 3 ? value.split("").map(c => c + c).join("") : value;
    const channels = [0, 2, 4].map(offset => parseInt(full.slice(offset, offset + 2), 16));

    const mixed = channels.map(channel => {
      const target = amount >= 0 ? 255 : 0;
      return Math.round(channel + (target - channel) * Math.abs(amount));
    });

    return `#${mixed.map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
  }

  const SHIRT_PATH = "M12 140 V114 Q12 97 32 95 L50 92 Q60 102 70 92 L88 95 Q108 97 108 114 V140 Z";
  const HEAD_PATH = "M33 54 Q33 24 60 24 Q87 24 87 54 L87 66 Q87 89 60 89 Q33 89 33 66 Z";
</script>

<svg
  class="avatar"
  viewBox="0 0 120 140"
  width={size}
  height={size * (140 / 120)}
  role="img"
  aria-label={`${passenger.name}, pasajero ${passenger.id}`}
>
  <defs>
    <clipPath id={clipId}>
      <path d={SHIRT_PATH} />
    </clipPath>
  </defs>

  <!-- Cabello: capa posterior -->
  {#if passenger.hairStyle === "long"}
    <path d="M31 50 Q22 82 30 108 Q42 112 48 102 L48 58 H72 L72 102 Q78 112 90 108 Q98 82 89 50 Z" fill={passenger.hair} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />
  {:else if passenger.hairStyle === "curly"}
    {#each [[34, 40], [28, 54], [29, 68], [36, 80], [86, 40], [92, 54], [91, 68], [84, 80], [46, 30], [60, 26], [74, 30]] as [cx, cy]}
      <circle {cx} {cy} r="10" fill={passenger.hair} stroke={OUTLINE} stroke-width="2" />
    {/each}
  {:else if passenger.hairStyle === "ponytail"}
    <path d="M86 48 Q104 56 104 84 Q104 100 94 104 Q92 92 90 80 Q86 66 82 60 Z" fill={passenger.hair} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />
    <path d="M86 56 Q92 62 90 70" fill="none" stroke={hairShine} stroke-width="2" stroke-linecap="round" opacity="0.7" />
    <rect x="83" y="52" width="8" height="6" rx="2" fill={passenger.accessoryColor} stroke={OUTLINE} stroke-width="1.5" />
  {/if}

  <!-- Capucha (detrás del cuello) -->
  {#if passenger.shirtStyle === "hoodie"}
    <path d="M20 112 Q14 62 60 44 Q106 62 100 112 Z" fill={darkerShirt} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />
  {/if}

  <!-- Cuello -->
  <rect x="50" y="78" width="20" height="22" rx="7" fill={passenger.skin} stroke={OUTLINE} stroke-width="2" />
  <rect x="51" y="79" width="18" height="9" rx="6" fill={darkerSkin} opacity="0.55" />

  <!-- Camisa -->
  <path d={SHIRT_PATH} fill={passenger.shirt} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />

  {#if passenger.shirtStyle === "stripes"}
    <g clip-path={`url(#${clipId})`}>
      {#each [104, 118, 132] as y}
        <rect x="0" y={y} width="120" height="7" fill={passenger.shirtAccent} opacity="0.95" />
      {/each}
    </g>
  {:else if passenger.shirtStyle === "hoodie"}
    <path d="M38 96 Q60 118 82 96 Q74 104 60 104 Q46 104 38 96 Z" fill={darkerShirt} stroke={OUTLINE} stroke-width="1.5" stroke-linejoin="round" />
    <path d="M53 104 L51 124 M67 104 L69 124" stroke={passenger.shirtAccent} stroke-width="2.4" stroke-linecap="round" />
    <circle cx="51" cy="125" r="2.2" fill={passenger.shirtAccent} />
    <circle cx="69" cy="125" r="2.2" fill={passenger.shirtAccent} />
    <path d="M34 128 Q60 122 86 128 V140 H34 Z" fill={darkerShirt} opacity="0.6" />
  {:else}
    <path d="M44 95 Q60 108 76 95" fill="none" stroke={darkerShirt} stroke-width="2.2" stroke-linecap="round" />
  {/if}

  <!-- Sombra del cuello sobre la camisa -->
  <path d="M46 94 Q60 103 74 94 L70 92 Q60 100 50 92 Z" fill={OUTLINE} opacity="0.08" />

  <!-- Orejas -->
  <circle cx="33" cy="60" r="6.5" fill={passenger.skin} stroke={OUTLINE} stroke-width="2" />
  <circle cx="87" cy="60" r="6.5" fill={passenger.skin} stroke={OUTLINE} stroke-width="2" />
  <path d="M31 58 Q29 61 32 63" fill="none" stroke={darkerSkin} stroke-width="1.5" stroke-linecap="round" />
  <path d="M89 58 Q91 61 88 63" fill="none" stroke={darkerSkin} stroke-width="1.5" stroke-linecap="round" />

  <!-- Cabeza -->
  <path d={HEAD_PATH} fill={passenger.skin} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />
  <path d="M36 70 Q40 86 60 88 Q80 86 84 70 Q80 82 60 84 Q40 82 36 70 Z" fill={darkerSkin} opacity="0.35" />

  <!-- Rubor -->
  <ellipse cx="42" cy="66" rx="5.5" ry="3" fill="#f08a8a" opacity={reaction === "calm" ? 0.35 : 0.55} />
  <ellipse cx="78" cy="66" rx="5.5" ry="3" fill="#f08a8a" opacity={reaction === "calm" ? 0.35 : 0.55} />

  <!-- Cejas -->
  {#if expression.brows === "raised"}
    <path d="M42 42 Q49 36 56 41 M64 41 Q71 36 78 42" fill="none" stroke={passenger.hair} stroke-width="3" stroke-linecap="round" />
  {:else if expression.brows === "worried"}
    <path d="M42 48 Q49 46 56 42 M64 42 Q71 46 78 48" fill="none" stroke={passenger.hair} stroke-width="3" stroke-linecap="round" />
  {:else if expression.brows === "flat"}
    <path d="M42 45 L56 47 M64 47 L78 45" fill="none" stroke={passenger.hair} stroke-width="3" stroke-linecap="round" />
  {:else}
    <path d="M42 46 Q49 42 56 45 M64 45 Q71 42 78 46" fill="none" stroke={passenger.hair} stroke-width="3" stroke-linecap="round" />
  {/if}

  <!-- Ojos -->
  {#if expression.eyes === "closed"}
    <path d="M44 58 Q49 63 54 58 M66 58 Q71 63 76 58" fill="none" stroke={OUTLINE} stroke-width="2.2" stroke-linecap="round" />
  {:else}
    {#if expression.eyes === "wide"}
      <ellipse cx="49" cy="57" rx="6.5" ry="7.5" fill="#ffffff" stroke={OUTLINE} stroke-width="1.5" />
      <ellipse cx="71" cy="57" rx="6.5" ry="7.5" fill="#ffffff" stroke={OUTLINE} stroke-width="1.5" />
    {/if}
    <ellipse cx="49" cy="57" rx={expression.eyes === "wide" ? 4.2 : 3.6} ry={expression.eyes === "wide" ? 5.2 : 4.4} fill="#2b2033" />
    <ellipse cx="71" cy="57" rx={expression.eyes === "wide" ? 4.2 : 3.6} ry={expression.eyes === "wide" ? 5.2 : 4.4} fill="#2b2033" />
    <circle cx="50.6" cy="55.2" r="1.4" fill="#ffffff" />
    <circle cx="72.6" cy="55.2" r="1.4" fill="#ffffff" />
  {/if}

  <!-- Nariz -->
  <path d="M59 61 Q56 67 60 68" fill="none" stroke={OUTLINE} stroke-width="1.6" stroke-linecap="round" opacity="0.55" />

  <!-- Boca -->
  {#if expression.mouth === "smile"}
    <path d="M50 73 Q60 82 70 73" fill="none" stroke={MOUTH} stroke-width="2.4" stroke-linecap="round" />
  {:else if expression.mouth === "smirk"}
    <path d="M51 74 Q61 80 70 71" fill="none" stroke={MOUTH} stroke-width="2.4" stroke-linecap="round" />
  {:else if expression.mouth === "small"}
    <path d="M54 75 Q60 77 66 75" fill="none" stroke={MOUTH} stroke-width="2.2" stroke-linecap="round" />
  {:else if expression.mouth === "grin"}
    <path d="M47 71 Q60 88 73 71 Z" fill={MOUTH_INNER} stroke={MOUTH} stroke-width="2" stroke-linejoin="round" />
    <path d="M49 72 Q60 76 71 72 L70.5 74.5 Q60 79 49.5 74.5 Z" fill="#ffffff" />
  {:else if expression.mouth === "open"}
    <ellipse cx="60" cy="76" rx="7.5" ry="9.5" fill={MOUTH_INNER} stroke={MOUTH} stroke-width="2" />
    <ellipse cx="60" cy="82" rx="4.5" ry="3" fill="#e07a85" />
    <rect x="54.5" y="67.5" width="11" height="3" rx="1" fill="#ffffff" />
  {:else}
    <path d="M50 75 Q55 70 60 75 T70 75" fill="none" stroke={MOUTH} stroke-width="2.3" stroke-linecap="round" />
  {/if}

  {#if expression.sweat}
    <path d="M92 38 Q96 46 92 48 Q88 46 92 38 Z" fill="#8fd3f4" stroke={OUTLINE} stroke-width="1.2" />
  {/if}

  <!-- Cabello: capa superior -->
  {#if passenger.hairStyle === "short"}
    <path d="M33 54 Q33 20 60 20 Q87 20 87 54 Q82 42 68 40 Q56 44 48 36 Q40 42 33 54 Z" fill={passenger.hair} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />
    <path d="M44 30 Q52 24 62 25" fill="none" stroke={hairShine} stroke-width="2.5" stroke-linecap="round" opacity="0.7" />
  {:else if passenger.hairStyle === "long"}
    <path d="M33 54 Q33 20 60 20 Q87 20 87 54 Q84 40 70 38 Q58 42 50 36 Q40 42 33 54 Z" fill={passenger.hair} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />
    <path d="M33 50 Q29 70 33 86 L40 86 Q36 70 40 50 Z M87 50 Q91 70 87 86 L80 86 Q84 70 80 50 Z" fill={passenger.hair} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />
    <path d="M44 30 Q52 24 62 25" fill="none" stroke={hairShine} stroke-width="2.5" stroke-linecap="round" opacity="0.7" />
  {:else if passenger.hairStyle === "curly"}
    <path d="M33 54 Q33 24 60 24 Q87 24 87 54 Q82 44 72 44 Q66 36 60 42 Q54 36 48 44 Q38 44 33 54 Z" fill={passenger.hair} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />
    {#each [[42, 34], [52, 28], [62, 26], [72, 30], [81, 38]] as [cx, cy]}
      <circle {cx} {cy} r="7" fill={passenger.hair} stroke={OUTLINE} stroke-width="2" />
    {/each}
    <circle cx="54" cy="29" r="2" fill={hairShine} opacity="0.7" />
  {:else if passenger.hairStyle === "ponytail"}
    <path d="M33 54 Q33 20 60 20 Q87 20 87 54 Q84 38 66 36 Q52 36 44 40 Q36 44 33 54 Z" fill={passenger.hair} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />
    <path d="M44 30 Q60 22 78 30 M48 26 Q60 20 74 26" fill="none" stroke={hairShine} stroke-width="1.8" stroke-linecap="round" opacity="0.6" />
  {:else if passenger.hairStyle === "bun"}
    <path d="M33 54 Q33 22 60 22 Q87 22 87 54 Q84 40 66 38 Q52 38 44 42 Q36 46 33 54 Z" fill={passenger.hair} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />
    <circle cx="60" cy="18" r="10" fill={passenger.hair} stroke={OUTLINE} stroke-width="2" />
    <path d="M54 14 Q60 10 66 14" fill="none" stroke={hairShine} stroke-width="2" stroke-linecap="round" opacity="0.7" />
    <path d="M46 28 Q60 22 74 28" fill="none" stroke={hairShine} stroke-width="1.8" stroke-linecap="round" opacity="0.6" />
  {:else}
    <path d="M34 50 Q36 26 60 25 Q84 26 86 50 Q80 42 60 41 Q40 42 34 50 Z" fill={passenger.hair} opacity="0.45" />
    {#each [[44, 34], [52, 30], [60, 29], [68, 30], [76, 34], [48, 38], [64, 37], [56, 34], [72, 40]] as [cx, cy]}
      <circle {cx} {cy} r="1.1" fill={passenger.hair} opacity="0.8" />
    {/each}
  {/if}

  <!-- Accesorios -->
  {#if passenger.accessory === "cap"}
    <path d="M32 46 Q32 16 60 16 Q88 16 88 46 Z" fill={passenger.accessoryColor} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />
    <path d="M60 46 L106 43 Q108 50 60 52 Z" fill={darkerAccessory} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />
    <path d="M32 46 Q60 42 88 46" fill="none" stroke={darkerAccessory} stroke-width="2.5" />
    <circle cx="60" cy="16" r="3" fill={darkerAccessory} stroke={OUTLINE} stroke-width="1.5" />
  {:else if passenger.accessory === "helmet"}
    <path d="M28 56 Q28 10 60 10 Q92 10 92 56 Z" fill={passenger.accessoryColor} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />
    <rect x="26" y="52" width="68" height="7" rx="3" fill={darkerAccessory} stroke={OUTLINE} stroke-width="1.5" />
    <path d="M40 24 Q50 15 62 15" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.5" />
    <path d="M36 60 Q60 94 84 60" fill="none" stroke={darkerAccessory} stroke-width="2.5" stroke-linecap="round" />
  {:else if passenger.accessory === "glasses"}
    <circle cx="49" cy="57" r="9" fill="#ffffff" fill-opacity="0.25" stroke={passenger.accessoryColor} stroke-width="2.6" />
    <circle cx="71" cy="57" r="9" fill="#ffffff" fill-opacity="0.25" stroke={passenger.accessoryColor} stroke-width="2.6" />
    <path d="M58 56 Q60 54 62 56 M40 55 L33 53 M80 55 L87 53" fill="none" stroke={passenger.accessoryColor} stroke-width="2.6" stroke-linecap="round" />
    <path d="M44 52 Q47 50 51 51" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.8" />
  {:else if passenger.accessory === "party"}
    <path d="M60 2 L43 38 L77 38 Z" fill={passenger.accessoryColor} stroke={OUTLINE} stroke-width="2" stroke-linejoin="round" />
    <path d="M50 24 L70 24 M46 32 L74 32" stroke={darkerAccessory} stroke-width="3" />
    <circle cx="60" cy="3" r="4.5" fill="#ffffff" stroke={OUTLINE} stroke-width="1.5" />
    <path d="M43 38 Q34 60 36 76" fill="none" stroke={OUTLINE} stroke-width="1" opacity="0.5" />
  {:else if passenger.accessory === "headphones"}
    <path d="M30 56 Q30 16 60 16 Q90 16 90 56" fill="none" stroke={passenger.accessoryColor} stroke-width="5" stroke-linecap="round" />
    <rect x="24" y="50" width="13" height="19" rx="5" fill={passenger.accessoryColor} stroke={OUTLINE} stroke-width="2" />
    <rect x="83" y="50" width="13" height="19" rx="5" fill={passenger.accessoryColor} stroke={OUTLINE} stroke-width="2" />
    <rect x="27" y="54" width="7" height="11" rx="3" fill={darkerAccessory} />
    <rect x="86" y="54" width="7" height="11" rx="3" fill={darkerAccessory} />
  {/if}
</svg>

<style>
  .avatar {
    display: block;
    overflow: visible;
  }
</style>
