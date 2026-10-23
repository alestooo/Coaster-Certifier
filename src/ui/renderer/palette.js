/**
 * Paleta del renderizador. Mantiene la identidad visual morada de la
 * aplicación; los colores semánticos (seguro / alerta / peligro) se usan
 * en el indicador de carga y en los marcadores de incumplimiento.
 */
export const PALETTE = Object.freeze({
  pageBackground: "#f6f3fb",
  primary: "#8050c8",
  primaryDark: "#603497",
  text: "#30233f",
  muted: "#7a6b89",
  border: "#e6ddef",

  skyTop: "#ece5fc",
  skyBottom: "#ffffff",
  ground: "#dfeede",
  groundEdge: "#c9dcc6",

  track: "#69449a",
  trackRail: "#cdb6e6",
  trackLift: "#b9a8cc",
  chain: "#8d7aa3",
  support: "#c7b8d9",

  cart: "#e8af3f",
  cartStripe: "#fff0bd",
  cartBar: "#4b3266",
  wheel: "#322340",
  coupling: "#65516e",

  stationWall: "#e8dff2",
  stationInner: "#faf6ff",
  stationRoof: "#785397",
  stationPlatform: "#bba4ce",
  stationWindow: "#d9c8ec",
  stationSign: "#fff8e8",

  brake: "#c4374f",
  brakeFill: "rgba(196, 55, 79, 0.13)",
  brakeHatch: "rgba(196, 55, 79, 0.35)",
  spring: "#b17e53",
  wall: "#8d739e",

  marker: "#603497",
  markerText: "#ffffff",
  panel: "rgba(255, 255, 255, 0.82)",
  panelBorder: "rgba(96, 52, 151, 0.18)",

  safe: "#39936b",
  warning: "#d79a2c",
  danger: "#c4374f",

  weight: "#c4374f",
  normal: "#368bc0",
  friction: "#d79a2c",
  springForce: "#b17e53"
});

/** Colores de fondo por tipo de tramo (bandas bajo la vía). */
export const SECTION_COLORS = Object.freeze({
  curve: "rgba(128, 80, 200, 0.11)",
  line: "rgba(128, 80, 200, 0.11)",
  loop: "rgba(215, 154, 44, 0.18)",
  flat: "rgba(122, 107, 137, 0.10)",
  brake: "rgba(196, 55, 79, 0.12)"
});

/** Extremos del degradado de rapidez de la estela [r, g, b]. */
export const TRAIL_COLORS = Object.freeze({
  slow: Object.freeze([54, 139, 192]),
  medium: Object.freeze([128, 80, 200]),
  fast: Object.freeze([217, 83, 79])
});
