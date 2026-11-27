<script lang="ts">
  import ParamSlider from "./ParamSlider.svelte";
  import { fieldLimits, type FieldDefinition } from "../../lib/field-definitions";
  import type { SimulationConfig } from "../../lib/types";

  /** Un parámetro de la configuración como ParamSlider: valor, límites y nota salen de `config`. */
  interface Props {
    field: FieldDefinition;
    config: SimulationConfig;
    error?: string;
    onInput: (value: number) => void;
    onGesture?: (active: boolean) => void;
  }

  let { field, config, error = "", onInput, onGesture }: Props = $props();
</script>

<ParamSlider
  id={field.key}
  label={field.label}
  symbol={field.symbol}
  unit={field.unit}
  step={field.step}
  scale={field.scale}
  help={field.help}
  value={config[field.key] as number}
  limits={fieldLimits(field.key, config)}
  hint={field.hint ? field.hint(config) : ""}
  {error}
  {onInput}
  {onGesture}
/>
