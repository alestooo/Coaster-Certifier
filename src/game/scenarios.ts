import { SCENARIOS } from "../physics/index.js";
import type { ConfigInput } from "../lib/types";

export type ScenarioId = (typeof SCENARIOS)[number]["id"];

export type ScenarioCard = {
  id: ScenarioId;
  title: string;
  description: string;
  summary: string;
  approved: boolean;
  config: ConfigInput;
};

/** Escenarios de referencia de la librería, listos para la interfaz. */
export const SCENARIO_CARDS: ScenarioCard[] = SCENARIOS.map(scenario => ({
  id: scenario.id,
  title: scenario.title,
  description: scenario.description,
  summary: scenario.summary,
  approved: scenario.expected.approved,
  config: scenario.config as ConfigInput
}));

export function scenarioConfig(id: ScenarioId): ConfigInput {
  const scenario = SCENARIOS.find(item => item.id === id);

  if (!scenario) {
    throw new Error(`Escenario desconocido: ${id}`);
  }

  return { ...scenario.config } as ConfigInput;
}
