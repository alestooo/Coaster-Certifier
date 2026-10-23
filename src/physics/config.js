import {
  GRAVITY,
  MAX_BRAKE_DECELERATION,
  DEFAULT_MAX_LOAD,
  DEFAULT_MIN_LOAD,
  DEFAULT_MIN_SPEED,
  DEFAULT_MAX_SUBSTEP
} from "./constants.js";

/**
 * @typedef {Object} CustomPoint
 * @property {number} x Posición horizontal relativa al ancho del trazado (0–1).
 * @property {number} y Altura relativa a la altura inicial (0–1).
 * @property {number} loopHeight Altura del loop anclado en este punto (m); 0 = sin loop.
 * @property {number} loopTopRadius Radio de curvatura en la cima del loop (m).
 */

/**
 * @typedef {Object} SimulationConfig
 * @property {number} mass Masa total del tren con pasajeros (kg).
 * @property {number} gravity Aceleración de la gravedad (m/s²).
 * @property {number} initialHeight Altura H de la cima A (m).
 * @property {number} initialSpeed Rapidez v₀ al salir de la cadena en A (m/s).
 * @property {number} trackWidth Ancho horizontal W del trazado antes de la aproximación (m).
 * @property {"incline"|"slope"|"valley"|"loop"|"reference"|"custom"} mapId Trazado base.
 * @property {number} loopHeight Altura h_L del loop (m).
 * @property {number} loopTopRadius Radio de curvatura R en la cima del loop (m).
 * @property {number} hillHeight Altura h_c de la colina (m).
 * @property {number} hillCrestRadius Radio de curvatura ρ_c en la cresta de la colina (m).
 * @property {number} friction Coeficiente de fricción efectivo μ (adimensional).
 * @property {"station"|"spring"} brakeMode Sistema de frenado.
 * @property {number} brakingLength Longitud d_f de la zona de frenado (m).
 * @property {number} brakeDeceleration Desaceleración a_f de los frenos de estación (m/s²).
 * @property {number} springConstant Constante elástica k del resorte (N/m).
 * @property {number} springDamping Coeficiente de amortiguamiento c del resorte (N·s/m).
 * @property {number} maxCompression Compresión máxima permitida x_máx (m).
 * @property {"strict"|"safety-wheels"} contactModel Modelo de contacto con la vía.
 * @property {number} maxLoad Carga máxima admisible n_máx (g).
 * @property {number} minLoad Carga mínima admisible n_mín (g).
 * @property {number} minSpeed Umbral de detención v_mín (m/s).
 * @property {number} maxTime Tiempo máximo de observación (s).
 * @property {number} timeStep Paso de reporte dt (s).
 * @property {number} maxSubstep Paso máximo del integrador (s).
 * @property {CustomPoint[]} customPoints Nodos del trazado personalizado.
 */

export const MAP_IDS = Object.freeze([
  "incline",
  "slope",
  "valley",
  "loop",
  "reference",
  "custom"
]);

export const BRAKE_MODES = Object.freeze(["station", "spring"]);

export const CONTACT_MODELS = Object.freeze(["strict", "safety-wheels"]);

/** Cantidad máxima de nodos y de loops en un trazado personalizado. */
export const CUSTOM_LIMITS = Object.freeze({
  minPoints: 3,
  maxPoints: 9,
  maxLoops: 3,
  minSpacing: 0.05
});

/** Relación máxima entre radios del loop (lágrima): R_inferior / R_superior ≤ 19. */
export const MAX_LOOP_SHAPE = 0.9;

/**
 * Rangos válidos de cada parámetro numérico [mínimo, máximo].
 * Son la única fuente de verdad para la validación y para los controles de la interfaz.
 */
export const CONFIG_LIMITS = Object.freeze({
  mass: [1, 20000],
  gravity: [0.1, 30],
  initialHeight: [0.1, 80],
  initialSpeed: [0, 10],
  trackWidth: [1, 600],
  loopHeight: [1, 60],
  loopTopRadius: [0.5, 30],
  hillHeight: [0, 60],
  hillCrestRadius: [1, 200],
  friction: [0, 0.2],
  brakingLength: [1, 150],
  brakeDeceleration: [0.1, MAX_BRAKE_DECELERATION],
  springConstant: [100, 200000],
  springDamping: [0, 50000],
  maxCompression: [0.1, 60],
  maxLoad: [1, 10],
  minLoad: [-3, 1],
  minSpeed: [0, 5],
  maxTime: [1, 600],
  timeStep: [0.0001, 1],
  maxSubstep: [0.00001, 0.01]
});

/** @type {Readonly<SimulationConfig>} */
export const DEFAULT_CONFIG = Object.freeze(/** @type {SimulationConfig} */ ({
  mass: 500,
  gravity: GRAVITY,
  initialHeight: 20,
  initialSpeed: 0,
  trackWidth: 160,
  mapId: "slope",

  loopHeight: 14,
  loopTopRadius: 3.5,
  hillHeight: 9,
  hillCrestRadius: 25,

  friction: 0.01,

  brakeMode: "station",
  brakingLength: 80,
  brakeDeceleration: 5,
  springConstant: 6000,
  springDamping: 0,
  maxCompression: 8,

  contactModel: "strict",
  maxLoad: DEFAULT_MAX_LOAD,
  minLoad: DEFAULT_MIN_LOAD,
  minSpeed: DEFAULT_MIN_SPEED,

  maxTime: 120,
  timeStep: 0.01,
  maxSubstep: DEFAULT_MAX_SUBSTEP,

  customPoints: /** @type {CustomPoint[]} */ (
    Object.freeze([
      Object.freeze({ x: 0, y: 1, loopHeight: 0, loopTopRadius: 0 }),
      Object.freeze({ x: 0.25, y: 0, loopHeight: 0, loopTopRadius: 0 }),
      Object.freeze({ x: 0.5, y: 0.35, loopHeight: 0, loopTopRadius: 0 }),
      Object.freeze({ x: 0.75, y: 0, loopHeight: 0, loopTopRadius: 0 }),
      Object.freeze({ x: 1, y: 0, loopHeight: 0, loopTopRadius: 0 })
    ])
  )
}));

/** Error de validación de la configuración. */
export class ConfigError extends Error {
  /**
   * @param {string} message Mensaje legible para la interfaz.
   * @param {string} field Campo que provocó el error.
   */
  constructor(message, field) {
    super(message);
    this.name = "ConfigError";
    this.field = field;
  }
}

/**
 * Valida un parámetro numérico contra su rango.
 * @param {Record<string, unknown>} config
 * @param {string} key
 */
function assertRange(config, key) {
  const value = config[key];
  const [min, max] = CONFIG_LIMITS[/** @type {keyof typeof CONFIG_LIMITS} */ (key)];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ConfigError(`${key}: debe ser un número finito.`, key);
  }

  if (value < min || value > max) {
    throw new ConfigError(
      `${key}: debe estar entre ${min} y ${max}.`,
      key
    );
  }
}

/**
 * Comprueba que un loop (altura y radio en la cima) tenga forma válida.
 * @param {number} height Altura del loop h_L (m).
 * @param {number} topRadius Radio en la cima R (m).
 * @param {string} field
 */
export function assertLoopShape(height, topRadius, field = "loopTopRadius") {
  if (topRadius > height / 2 + 1e-9) {
    throw new ConfigError(
      "El radio en la cima no puede superar la mitad de la altura del loop (h_L ≥ 2R).",
      field
    );
  }

  const shape = 1 - (2 * topRadius) / height;

  if (shape > MAX_LOOP_SHAPE + 1e-9) {
    throw new ConfigError(
      `El radio en la cima debe ser al menos ${((1 - MAX_LOOP_SHAPE) * 50).toFixed(0)} % de la altura del loop.`,
      field
    );
  }
}

/**
 * @param {SimulationConfig} config
 */
function validateCustomPoints(config) {
  const points = config.customPoints;

  if (
    !Array.isArray(points) ||
    points.length < CUSTOM_LIMITS.minPoints ||
    points.length > CUSTOM_LIMITS.maxPoints
  ) {
    throw new ConfigError(
      `Usá entre ${CUSTOM_LIMITS.minPoints} y ${CUSTOM_LIMITS.maxPoints} puntos.`,
      "customPoints"
    );
  }

  const first = points[0];
  const last = points[points.length - 1];

  if (first.x !== 0 || first.y !== 1 || last.x !== 1 || last.y !== 0) {
    throw new ConfigError(
      "El inicio y el final tienen posiciones fijas.",
      "customPoints"
    );
  }

  const loops = points.filter(point => point.loopHeight > 0);

  if (loops.length > CUSTOM_LIMITS.maxLoops) {
    throw new ConfigError(
      `Se permiten hasta ${CUSTOM_LIMITS.maxLoops} loops.`,
      "customPoints"
    );
  }

  points.forEach((point, index) => {
    const values = [point.x, point.y, point.loopHeight, point.loopTopRadius];

    if (
      values.some(value => typeof value !== "number" || !Number.isFinite(value)) ||
      point.y < 0 ||
      point.y > 1 ||
      point.loopHeight < 0 ||
      point.loopTopRadius < 0
    ) {
      throw new ConfigError(`Punto ${index + 1}: valores inválidos.`, "customPoints");
    }

    if (index > 0 && point.x - points[index - 1].x < CUSTOM_LIMITS.minSpacing - 1e-9) {
      throw new ConfigError(
        `Separá los puntos al menos un ${CUSTOM_LIMITS.minSpacing * 100} % del ancho.`,
        "customPoints"
      );
    }

    const isEdge = index === 0 || index === points.length - 1;

    if (isEdge && point.loopHeight !== 0) {
      throw new ConfigError("Los loops deben estar en puntos interiores.", "customPoints");
    }

    if (point.loopHeight > 0) {
      if (point.loopHeight > CONFIG_LIMITS.loopHeight[1]) {
        throw new ConfigError(
          `Punto ${index + 1}: la altura del loop no puede superar ${CONFIG_LIMITS.loopHeight[1]} m.`,
          "customPoints"
        );
      }

      assertLoopShape(point.loopHeight, point.loopTopRadius, "customPoints");
    }
  });
}

/**
 * Completa la configuración con los valores por defecto y la valida.
 * Devuelve siempre un objeto nuevo; nunca modifica la entrada.
 *
 * @param {Partial<SimulationConfig>} [input]
 * @returns {SimulationConfig}
 * @throws {ConfigError} cuando algún parámetro es inválido.
 */
export function resolveConfig(input = {}) {
  /** @type {SimulationConfig} */
  const config = {
    ...DEFAULT_CONFIG,
    ...input,
    customPoints: (input.customPoints ?? DEFAULT_CONFIG.customPoints).map(point => ({
      ...point
    }))
  };

  for (const key of Object.keys(CONFIG_LIMITS)) {
    assertRange(config, key);
  }

  if (!MAP_IDS.includes(config.mapId)) {
    throw new ConfigError("Recorrido no disponible.", "mapId");
  }

  if (!BRAKE_MODES.includes(config.brakeMode)) {
    throw new ConfigError("Modo de frenado inválido.", "brakeMode");
  }

  if (!CONTACT_MODELS.includes(config.contactModel)) {
    throw new ConfigError("Modelo de contacto inválido.", "contactModel");
  }

  if (config.minLoad >= config.maxLoad) {
    throw new ConfigError("La carga mínima debe ser menor que la máxima.", "minLoad");
  }

  if (config.maxSubstep > config.timeStep) {
    throw new ConfigError(
      "El paso del integrador no puede superar el paso de reporte.",
      "maxSubstep"
    );
  }

  if (config.brakeMode === "spring" && config.maxCompression > config.brakingLength) {
    throw new ConfigError(
      "La compresión máxima no puede superar la zona de frenado.",
      "maxCompression"
    );
  }

  if (config.mapId === "loop" || config.mapId === "reference") {
    assertLoopShape(config.loopHeight, config.loopTopRadius);
  }

  if (config.mapId === "custom") {
    validateCustomPoints(config);
  }

  return config;
}
