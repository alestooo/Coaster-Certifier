/** Contenido del panel derecho del taller: uno solo a la vez. */
export type PanelMode = "selection" | "verdict" | "rules" | "passengers";

export const PANEL_TITLES: Record<PanelMode, string> = {
  selection: "Parte seleccionada",
  verdict: "Dictamen",
  rules: "Reglas y precisión",
  passengers: "Tren y pasajeros"
};
