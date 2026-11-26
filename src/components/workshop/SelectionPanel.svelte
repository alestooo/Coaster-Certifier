<script lang="ts">
  import SliderField from "../ui/SliderField.svelte";
  import AreaStatus from "./AreaStatus.svelte";
  import Segmented from "../ui/Segmented.svelte";
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
  const BRAKE_SEGMENTS = BRAKE_OPTIONS.map(option => ({ value: option.value, label: option.title }));
</script>

<AreaStatus insight={report?.areas[area]} />

{#if area === "braking"}
  <div class="mode">
    <Segmented label="Sistema de frenado" block value={draft.brakeMode} options={BRAKE_SEGMENTS} onChange={value => onPatch({ brakeMode: value })} />
  </div>
  {#if brake}<p class="explain">{brake.description}</p>{/if}
{/if}

{#if group}
  {#each group.fields as field (field.key)}
    <SliderField {field} config={draft} error={errorField === field.key ? errorMessage : ""} onInput={value => onPatch({ [field.key]: value })} {onGesture} />
  {/each}
{/if}

<style>
  .mode {
    margin-top: var(--space-2);
  }

  .explain {
    margin: 6px 2px 2px;
    font-size: 11.5px;
    line-height: 1.4;
    color: var(--muted);
  }
</style>
