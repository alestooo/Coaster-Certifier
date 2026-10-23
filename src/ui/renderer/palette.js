/**
 * Paleta del renderizador. Deriva del sistema de diseño morado de la
 * aplicación (tokens.css) y añade los colores de la ilustración del parque.
 */
export const PALETTE = Object.freeze({
  text: "#2d2140",
  muted: "#8a789a",
  faint: "#b3a4c2",

  skyTop: "#e4daf9",
  skyMid: "#f1ecfb",
  skyBottom: "#ffffff",
  sun: "#ffd66e",
  sunHalo: "rgba(255, 214, 110, 0.32)",
  cloud: "rgba(255, 255, 255, 0.95)",
  cloudShade: "rgba(214, 200, 236, 0.6)",
  hillFar: "#dcd0f1",
  hillNear: "#c9b8e8",

  ground: "#dcecd5",
  groundDeep: "#c3dcb9",
  groundEdge: "#aacb9f",
  grass: "#8fbf80",
  path: "#e8dfcf",

  fence: "#b9a6cf",
  fenceDark: "#9d87b8",
  lamp: "#7d6a93",
  lampLight: "#fff1c2",

  treeTrunk: "#8a6246",
  treeRound: "#6cb86f",
  treeRoundDark: "#519a58",
  treePine: "#4f9d6e",
  treePineDark: "#3f8259",
  treeTall: "#86c983",

  tent: "#e8788f",
  tentStripe: "#fff3f5",
  tentPole: "#8a6246",
  ferris: "#b39bd6",
  ferrisDark: "#8f73bd",
  ferrisCabin: "#f2a93b",

  rail: "#8f6cc9",
  railLight: "#d9c8f6",
  tie: "#6a47a3",
  spine: "#4a2f7e",
  support: "#bcaad3",
  supportDark: "#9d89ba",
  footing: "#8d7aa6",

  lift: "#a690c2",
  liftStructure: "#cdbfdd",
  chain: "#4f3a6e",
  chainLink: "#f2a93b",
  motorHouse: "#7a5aa0",
  motorRoof: "#4e3573",

  cart: "#f2b84a",
  cartDark: "#cf8f22",
  cartLight: "#ffe08a",
  cartTrim: "#4b3266",
  cartPanel: "#fbe3a3",
  seat: "#5a3f7a",
  seatDark: "#3f2a5c",
  lapBar: "#2e2140",
  wheel: "#2f2340",
  wheelRim: "#9d8fb5",
  bogie: "#4d3a64",
  headlight: "#fff4b8",
  headlightGlow: "rgba(255, 244, 184, 0.5)",
  coupling: "#5c4a73",
  shadow: "rgba(45, 33, 64, 0.22)",

  stationWall: "#f4eefb",
  stationWallShade: "#e4d8f2",
  stationRoof: "#7a4bc6",
  stationRoofDark: "#5f329a",
  stationPlatform: "#d1c3e4",
  stationPlatformFront: "#b9a8d1",
  stationEdge: "#f2a93b",
  stationSign: "#fff8e8",
  stationSignText: "#4b2d6a",
  stationFence: "#8c74a8",
  truss: "#a08cc0",
  bunting: Object.freeze(["#f2a93b", "#7a4bc6", "#2f9d78", "#d9465a", "#3a7bd5"]),
  gate: "#8c74a8",

  brake: "#d9465a",
  brakeFin: "#c23b4e",
  brakeFinLight: "#f28a99",
  spring: "#b17e53",
  springDark: "#8f6340",
  bumper: "#8d739e",
  bumperFace: "#6f5a80",

  marker: "#5f329a",
  markerText: "#ffffff",
  panel: "rgba(255, 255, 255, 0.88)",
  panelBorder: "rgba(95, 50, 154, 0.18)",

  safe: "#2f9d78",
  warning: "#f2a93b",
  danger: "#d9465a",

  weight: "#d9465a",
  normal: "#3a7bd5",
  friction: "#f2a93b",
  springForce: "#b17e53",

  personSkin: Object.freeze(["#f1c7a3", "#dca577", "#a86d48"]),
  personShirt: Object.freeze(["#3a7bd5", "#2f9d78", "#e5533d", "#f2a93b"]),
  personPants: "#2b2f45",
  personHair: Object.freeze(["#382921", "#17151a", "#b47c38"])
});

/** Tinte del resplandor por tipo de tramo (bandas de sección). */
export const SECTION_COLORS = Object.freeze({
  curve: "rgba(122, 75, 198, 0.12)",
  line: "rgba(122, 75, 198, 0.12)",
  loop: "rgba(242, 169, 59, 0.14)",
  flat: "rgba(138, 120, 154, 0.10)",
  brake: "rgba(217, 70, 90, 0.14)"
});

/** Extremos del degradado de rapidez de la estela [r, g, b]. */
export const TRAIL_COLORS = Object.freeze({
  slow: Object.freeze([58, 123, 213]),
  medium: Object.freeze([122, 75, 198]),
  fast: Object.freeze([217, 70, 90])
});
