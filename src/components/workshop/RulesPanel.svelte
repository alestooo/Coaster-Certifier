<script lang="ts">
  import SliderField from "../ui/SliderField.svelte";
  import Disclosure from "../ui/Disclosure.svelte";
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

<h3>Límites de certificación</h3>
{#each criteria as field (field.key)}
  <SliderField {field} config={draft} error={errorField === field.key ? errorMessage : ""} onInput={value => onPatch({ [field.key]: value })} {onGesture} />
{/each}

<div class="numeric">
  <Disclosure summary="Precisión numérica">
    {#each numeric as field (field.key)}
      <SliderField {field} config={draft} error={errorField === field.key ? errorMessage : ""} onInput={value => onPatch({ [field.key]: value })} {onGesture} />
    {/each}
  </Disclosure>
</div>

<style>
  h3 {
    margin: 18px 0 2px;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .numeric {
    margin-top: var(--space-3);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border);
  }
</style>
