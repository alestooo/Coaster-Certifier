<script lang="ts">
  import ScrubField from "./ScrubField.svelte";
  import AreaStatus from "./AreaStatus.svelte";
  import { visibleGroups, BRAKE_OPTIONS } from "../../lib/field-definitions";
  import type { AuditReport, AreaId } from "../../lib/audit";
  import type { SimulationConfig } from "../../lib/types";

  interface Props {
    area: AreaId;
    draft: SimulationConfig;
    report: AuditReport | null;
    errorField: string;
    errorMessage: string;
    onPatch: (patch: Partial<SimulationConfig>) => void;
    onGesture?: (active: boolean) => void;
  }

  let { area, draft, report, errorField, errorMessage, onPatch, onGesture = () => {} }: Props = $props();

  let group = $derived(visibleGroups(draft).find(candidate => candidate.id === area) ?? null);
  let brake = $derived(BRAKE_OPTIONS.find(option => option.value === draft.brakeMode));
</script>

<AreaStatus insight={report?.areas[area]} />

{#if area === "braking"}
  <div class="segmented" role="radiogroup" aria-label="Sistema de frenado">
    {#each BRAKE_OPTIONS as option (option.value)}
      <button
        type="button"
        role="radio"
        aria-checked={draft.brakeMode === option.value}
        class:active={draft.brakeMode === option.value}
        onclick={() => onPatch({ brakeMode: option.value })}
      >
        {option.title}
      </button>
    {/each}
  </div>
  {#if brake}<p class="explain">{brake.description}</p>{/if}
{/if}

{#if group}
  {#each group.fields as field (field.key)}
    <ScrubField {field} config={draft} error={errorField === field.key ? errorMessage : ""} onInput={value => onPatch({ [field.key]: value })} {onGesture} />
  {/each}
{/if}

<style>
  .segmented {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    margin-top: 8px;
    padding: 4px;
    border-radius: 12px;
    background: var(--surface-muted);
  }

  .segmented button {
    height: 34px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--text-soft);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .segmented button.active {
    background: var(--surface);
    color: var(--primary-strong);
    box-shadow: var(--shadow-sm);
  }

  .explain {
    margin: 6px 2px 2px;
    font-size: 11.5px;
    line-height: 1.4;
    color: var(--muted);
  }
</style>
