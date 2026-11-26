<script lang="ts">
  import ScrubField from "./ScrubField.svelte";
  import ChoiceCards from "../lab/ChoiceCards.svelte";
  import { visibleGroups, CONTACT_OPTIONS } from "../../lib/field-definitions";
  import type { SimulationConfig } from "../../lib/types";

  interface Props {
    draft: SimulationConfig;
    errorField: string;
    errorMessage: string;
    onPatch: (patch: Partial<SimulationConfig>) => void;
    onGesture?: (active: boolean) => void;
  }

  let { draft, errorField, errorMessage, onPatch, onGesture = () => {} }: Props = $props();

  let groups = $derived(visibleGroups(draft));
  let criteria = $derived(groups.find(group => group.id === "criteria")?.fields ?? []);
  let numeric = $derived(groups.find(group => group.id === "numeric")?.fields ?? []);
</script>

<ChoiceCards
  legend="Contacto con la vía"
  name="contact-model"
  options={CONTACT_OPTIONS}
  value={draft.contactModel}
  onChange={contactModel => onPatch({ contactModel })}
/>

<h3>Límites para los pasajeros</h3>
{#each criteria as field (field.key)}
  <ScrubField {field} config={draft} error={errorField === field.key ? errorMessage : ""} onInput={value => onPatch({ [field.key]: value })} {onGesture} />
{/each}

<details>
  <summary>Precisión numérica</summary>
  {#each numeric as field (field.key)}
    <ScrubField {field} config={draft} error={errorField === field.key ? errorMessage : ""} onInput={value => onPatch({ [field.key]: value })} {onGesture} />
  {/each}
</details>

<style>
  h3 {
    margin: 18px 0 2px;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--muted);
  }

  details {
    margin-top: 14px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }

  summary {
    font-size: 13px;
    font-weight: 800;
    color: var(--text-soft);
    cursor: pointer;
  }
</style>
