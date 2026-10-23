/**
 * Escenarios de referencia: configuraciones completas con dictamen
 * esperado conocido. Los usan la interfaz (pruebas rápidas), el script
 * headless y la batería de pruebas, que verifica cada dictamen.
 */

/**
 * @typedef {Object} Scenario
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} summary Valores clave en texto.
 * @property {Partial<import("./config.js").SimulationConfig>} config
 * @property {{approved: boolean, code?: string, maxLoad?: number}} expected Dictamen esperado.
 */

/** @type {ReadonlyArray<Scenario>} */
export const SCENARIOS = Object.freeze([
  {
    id: "certification",
    title: "Trazado de certificación (anexo)",
    description:
      "Caída, loop en lágrima, colina y frenos de estación con los parámetros del anexo. Aprueba con margen.",
    summary: "H 30 m · v₀ 2 m/s · h_L 21,5 m · R 5 m · h_c 10 m · ρ_c 55 m · μ 0,01 · a_f 6 m/s² · d_f 60 m",
    config: {
      mapId: "reference",
      initialHeight: 30,
      initialSpeed: 2,
      trackWidth: 320,
      loopHeight: 21.5,
      loopTopRadius: 5,
      hillHeight: 10,
      hillCrestRadius: 55,
      friction: 0.01,
      brakeMode: "station",
      brakeDeceleration: 6,
      brakingLength: 60,
      maxLoad: 5
    },
    expected: { approved: true }
  },
  {
    id: "circular-loop",
    title: "Loop circular: siempre supera 5 g",
    description:
      "Caso de la Tabla 5 del anexo: un loop circular que mantiene contacto en la cima exige 6,6 g en la base.",
    summary: "H 30 m · v₀ 2 m/s · h_L 21,5 m · R 10,75 m (circular) · μ 0 · límite 5 g",
    config: {
      mapId: "loop",
      initialHeight: 30,
      initialSpeed: 2,
      trackWidth: 240,
      loopHeight: 21.5,
      loopTopRadius: 10.75,
      friction: 0,
      brakeDeceleration: 6,
      brakingLength: 90,
      maxLoad: 5
    },
    expected: { approved: false, code: "max-load", maxLoad: 6.6 }
  },
  {
    id: "teardrop-loop",
    title: "Loop en lágrima de la misma altura",
    description:
      "Misma altura y energía que el loop circular, pero con R = 5 m en la cima: la base es más abierta y aprueba.",
    summary: "H 30 m · v₀ 2 m/s · h_L 21,5 m · R 5 m · μ 0 · límite 5 g",
    config: {
      mapId: "loop",
      initialHeight: 30,
      initialSpeed: 2,
      trackWidth: 240,
      loopHeight: 21.5,
      loopTopRadius: 5,
      friction: 0,
      brakeDeceleration: 6,
      brakingLength: 90,
      maxLoad: 5
    },
    expected: { approved: true }
  },
  {
    id: "loop-contact",
    title: "Loop sin energía: pérdida de contacto",
    description: "La altura inicial no cumple H ≥ h_L + R/2: la normal se anula antes de la cima.",
    summary: "H 12 m · h_L 16 m · R 4 m · μ 0",
    config: {
      mapId: "loop",
      initialHeight: 12,
      trackWidth: 220,
      loopHeight: 16,
      loopTopRadius: 4,
      friction: 0,
      brakingLength: 80
    },
    expected: { approved: false, code: "contact" }
  },
  {
    id: "line",
    title: "Línea: llegar a la estación",
    description: "Bajada sencilla y detención con frenos de estación.",
    summary: "H 20 m · ancho 220 m · μ 0,01 · a_f 5 m/s² · d_f 80 m",
    config: {
      mapId: "slope",
      initialHeight: 20,
      trackWidth: 220,
      friction: 0.01,
      brakeMode: "station",
      brakeDeceleration: 5,
      brakingLength: 80
    },
    expected: { approved: true }
  },
  {
    id: "valley",
    title: "Valle: superar la colina",
    description: "Caída, colina con cresta suave y frenado. La carga mínima ocurre en la cresta.",
    summary: "H 25 m · h_c 10 m · ρ_c 60 m · μ 0,01 · a_f 5 m/s² · d_f 80 m",
    config: {
      mapId: "valley",
      initialHeight: 25,
      trackWidth: 260,
      hillHeight: 10,
      hillCrestRadius: 60,
      friction: 0.01,
      brakeDeceleration: 5,
      brakingLength: 80
    },
    expected: { approved: true }
  },
  {
    id: "airtime",
    title: "Colina con airtime (ruedas de seguridad)",
    description:
      "Con el modelo de ruedas de seguridad la carga puede bajar de 0 g hasta −1 g en la cresta sin rechazo.",
    summary: "H 30 m · h_c 6 m · ρ_c 30 m · contacto: ruedas de seguridad",
    config: {
      mapId: "valley",
      initialHeight: 30,
      trackWidth: 300,
      hillHeight: 6,
      hillCrestRadius: 30,
      friction: 0.01,
      contactModel: "safety-wheels",
      brakeDeceleration: 6,
      brakingLength: 90
    },
    expected: { approved: true }
  },
  {
    id: "stall",
    title: "Sin energía para la colina",
    description: "La fricción y la altura de la colina detienen el tren antes de la cresta.",
    summary: "H 10 m · h_c 14 m · μ 0,02",
    config: {
      mapId: "valley",
      initialHeight: 10,
      trackWidth: 260,
      hillHeight: 14,
      hillCrestRadius: 30,
      friction: 0.02,
      brakingLength: 80
    },
    expected: { approved: false, code: "min-speed" }
  },
  {
    id: "brake-short",
    title: "Zona de frenado insuficiente",
    description: "Los frenos no detienen el tren antes del final de la zona: v_E² > 2·a_f·d_f.",
    summary: "H 30 m · a_f 2 m/s² · d_f 20 m",
    config: {
      mapId: "slope",
      initialHeight: 30,
      trackWidth: 220,
      friction: 0,
      brakeDeceleration: 2,
      brakingLength: 20
    },
    expected: { approved: false, code: "overrun" }
  },
  {
    id: "spring-ideal",
    title: "Resorte ideal: observar el rebote",
    description:
      "Un resorte sin amortiguamiento devuelve la energía: el tren rebota durante todo el tiempo de observación y no se declara detenido.",
    summary: "H 20 m · μ 0,01 · k 6000 N/m · x_máx 8 m · c 0",
    config: {
      mapId: "slope",
      initialHeight: 20,
      trackWidth: 220,
      friction: 0.01,
      brakeMode: "spring",
      springConstant: 6000,
      springDamping: 0,
      maxCompression: 8,
      brakingLength: 80,
      maxTime: 120
    },
    expected: { approved: false, code: "timeout" }
  },
  {
    id: "spring-damped",
    title: "Resorte amortiguado",
    description: "Con amortiguador viscoso el resorte disipa la energía y el tren queda en reposo.",
    summary: "H 20 m · μ 0,01 · k 6000 N/m · c 4000 N·s/m · x_máx 20 m",
    config: {
      mapId: "slope",
      initialHeight: 20,
      trackWidth: 220,
      friction: 0.01,
      brakeMode: "spring",
      springConstant: 6000,
      springDamping: 4000,
      maxCompression: 20,
      brakingLength: 60,
      maxTime: 60
    },
    expected: { approved: true }
  },
  {
    id: "three-loops",
    title: "Personalizado: tres loops en lágrima",
    description: "Tres loops consecutivos a nivel del suelo, diseñados para no superar 5 g.",
    summary: "H 35 m · ancho 300 m · loops h_L 24 m · R 4 m · μ 0",
    config: {
      mapId: "custom",
      initialHeight: 35,
      trackWidth: 300,
      friction: 0,
      brakeDeceleration: 6,
      brakingLength: 90,
      maxLoad: 5,
      customPoints: [
        { x: 0, y: 1, loopHeight: 0, loopTopRadius: 0 },
        { x: 0.25, y: 0, loopHeight: 24, loopTopRadius: 4 },
        { x: 0.5, y: 0, loopHeight: 24, loopTopRadius: 4 },
        { x: 0.75, y: 0, loopHeight: 24, loopTopRadius: 4 },
        { x: 1, y: 0, loopHeight: 0, loopTopRadius: 0 }
      ]
    },
    expected: { approved: true }
  }
]);

/**
 * Busca un escenario por identificador.
 * @param {string} id
 * @returns {Scenario | undefined}
 */
export function findScenario(id) {
  return SCENARIOS.find(scenario => scenario.id === id);
}
