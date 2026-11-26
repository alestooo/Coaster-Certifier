<script lang="ts">
  import { CircleAlert } from "lucide-svelte";
  import type { Camera } from "../../ui/renderer/camera.js";
  import type { PlainIssue } from "../../lib/audit";

  interface Props {
    camera: Camera;
    issues: PlainIssue[];
    hidden: boolean;
    openIssue: number | null;
    /** Animación de aviso cuando la reproducción terminó en un incumplimiento. */
    ping: boolean;
    onOpen: (index: number | null) => void;
  }

  let { camera, issues, hidden, openIssue, ping, onOpen }: Props = $props();
</script>

{#if !hidden}
  {#each issues as issue, index (`${issue.code}-${index}`)}
    <div class="marker" style:translate={`${camera.toX(issue.x)}px ${camera.toY(issue.y)}px`}>
      <span class="halo" aria-hidden="true"></span>
      <button
        type="button"
        class="pin"
        class:open={openIssue === index}
        class:ping
        aria-label={`Problema: ${issue.title}`}
        aria-expanded={openIssue === index}
        title={issue.title}
        onclick={() => onOpen(openIssue === index ? null : index)}
      >
        <CircleAlert size={16} strokeWidth={2.6} aria-hidden="true" />
      </button>
    </div>
  {/each}
{/if}

<style>
  .marker {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
  }

  /* Halo que late en el punto exacto del incumplimiento. */
  .halo {
    position: absolute;
    left: -8px;
    top: -8px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgb(217 70 90 / 40%);
    animation: pulse 1.8s ease-out infinite;
    pointer-events: none;
  }

  /* Gota girada: su punta (esquina inferior izquierda) queda sobre el incumplimiento. */
  .pin {
    position: absolute;
    left: -12px;
    top: -29px;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 2px solid white;
    border-radius: 50% 50% 50% 4px;
    background: var(--danger);
    color: white;
    font: inherit;
    font-size: 14px;
    font-weight: 900;
    rotate: -45deg;
    box-shadow: 0 4px 10px rgb(157 42 57 / 35%);
    cursor: pointer;
    pointer-events: auto;
    transition: scale 0.15s;
  }

  .pin :global(svg) {
    rotate: 45deg;
  }

  .pin:hover,
  .pin:focus-visible,
  .pin.open {
    scale: 1.15;
    outline: none;
  }

  .pin.ping {
    animation: ping 0.5s ease-in-out 4;
  }

  @keyframes pulse {
    from {
      transform: scale(0.6);
      opacity: 0.9;
    }
    to {
      transform: scale(2.6);
      opacity: 0;
    }
  }

  @keyframes ping {
    50% {
      scale: 1.45;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .halo,
    .pin.ping {
      animation: none;
    }
  }
</style>
