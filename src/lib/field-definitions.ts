import { CONFIG_LIMITS } from "../physics/index.js";
import type { SimulationConfig } from "./types";

export type NumericKey = keyof typeof CONFIG_LIMITS;

export type FieldDefinition = {
  key: NumericKey;
  symbol: string;
  label: string;
  unit: string;
  step: number;
  help: string;
  /** Devuelve verdadero cuando el campo aplica a la configuración dada. */
  visible?: (config: SimulationConfig) => boolean;
};

export type FieldGroup = {
  id: string;
  title: string;
  fields: FieldDefinition[];
  collapsed?: boolean;
};

const hasLoop = (config: SimulationConfig) => ["loop", "reference"].includes(config.mapId);
const hasHill = (config: SimulationConfig) => ["valley", "reference"].includes(config.mapId);
const isStation = (config: SimulationConfig) => config.brakeMode === "station";
const isSpring = (config: SimulationConfig) => config.brakeMode === "spring";
const hasSafetyWheels = (config: SimulationConfig) => config.contactModel === "safety-wheels";

/** Grupos de parámetros del panel de ajustes, en el orden en que se muestran. */
export const FIELD_GROUPS: FieldGroup[] = [
  {
    id: "initial",
    title: "Condiciones iniciales en A",
    fields: [
      {
        key: "initialHeight",
        symbol: "H",
        label: "Altura de la cima A",
        unit: "m",
        step: 0.5,
        help: "Energía potencial disponible para todo el recorrido."
      },
      {
        key: "initialSpeed",
        symbol: "v₀",
        label: "Rapidez al salir de la cadena",
        unit: "m/s",
        step: 0.1,
        help: "Energía cinética inicial. El anexo propone entre 0,5 y 5 m/s."
      }
    ]
  },
  {
    id: "geometry",
    title: "Geometría del trazado",
    fields: [
      {
        key: "trackWidth",
        symbol: "W",
        label: "Ancho horizontal",
        unit: "m",
        step: 5,
        help: "Distancia horizontal desde A hasta la aproximación a la estación."
      },
      {
        key: "loopHeight",
        symbol: "h_L",
        label: "Altura del loop",
        unit: "m",
        step: 0.5,
        help: "Altura que debe alcanzar el tren en la cima C.",
        visible: hasLoop
      },
      {
        key: "loopTopRadius",
        symbol: "R",
        label: "Radio en la cima del loop",
        unit: "m",
        step: 0.25,
        help: "Condición de contacto en C: v² ≥ g·R. Debe cumplirse h_L ≥ 2R; con R = h_L/2 el loop es circular.",
        visible: hasLoop
      },
      {
        key: "hillHeight",
        symbol: "h_c",
        label: "Altura de la colina",
        unit: "m",
        step: 0.5,
        help: "Energía necesaria para superar la cresta D. Con 0 m no hay colina.",
        visible: hasHill
      },
      {
        key: "hillCrestRadius",
        symbol: "ρ_c",
        label: "Radio de curvatura en la cresta",
        unit: "m",
        step: 1,
        help: "Carga mínima en D: n_D = 1 − v_D²/(g·ρ_c).",
        visible: hasHill
      }
    ]
  },
  {
    id: "losses",
    title: "Pérdidas",
    fields: [
      {
        key: "friction",
        symbol: "μ",
        label: "Coeficiente de fricción efectivo",
        unit: "",
        step: 0.001,
        help: "Rodadura y aire agrupados: f = μ·|N|, opuesta al movimiento."
      }
    ]
  },
  {
    id: "braking",
    title: "Zona de frenado E → F",
    fields: [
      {
        key: "brakingLength",
        symbol: "d_f",
        label: "Longitud de la zona de frenado",
        unit: "m",
        step: 1,
        help: "Distancia disponible para detener el tren."
      },
      {
        key: "brakeDeceleration",
        symbol: "a_f",
        label: "Desaceleración de los frenos",
        unit: "m/s²",
        step: 0.1,
        help: "Constante durante el frenado; el anexo limita a 1 g (9,81 m/s²).",
        visible: isStation
      },
      {
        key: "springConstant",
        symbol: "k",
        label: "Constante elástica del resorte",
        unit: "N/m",
        step: 100,
        help: "Fuerza restauradora F = −k·x y energía almacenada ½·k·x².",
        visible: isSpring
      },
      {
        key: "springDamping",
        symbol: "c",
        label: "Amortiguamiento del resorte",
        unit: "N·s/m",
        step: 50,
        help: "Fuerza viscosa −c·v que disipa energía. Con 0 el resorte es ideal y devuelve toda la energía.",
        visible: isSpring
      },
      {
        key: "maxCompression",
        symbol: "x_máx",
        label: "Compresión máxima permitida",
        unit: "m",
        step: 0.1,
        help: "Límite de compresión del resorte durante el frenado.",
        visible: isSpring
      }
    ]
  },
  {
    id: "criteria",
    title: "Criterios del dictamen",
    fields: [
      {
        key: "maxLoad",
        symbol: "n_máx",
        label: "Carga máxima admisible",
        unit: "g",
        step: 0.1,
        help: "Límite superior de la carga n = N/(m·g). El anexo fija +5 g."
      },
      {
        key: "minLoad",
        symbol: "n_mín",
        label: "Carga mínima admisible",
        unit: "g",
        step: 0.1,
        help: "Límite inferior (airtime). El anexo fija −1 g; solo aplica con ruedas de seguridad.",
        visible: hasSafetyWheels
      },
      {
        key: "minSpeed",
        symbol: "v_mín",
        label: "Umbral de detención en subida",
        unit: "m/s",
        step: 0.1,
        help: "Por debajo de esta rapidez, subiendo, se considera que el tren se detuvo."
      }
    ]
  },
  {
    id: "numeric",
    title: "Configuración numérica",
    collapsed: true,
    fields: [
      {
        key: "timeStep",
        symbol: "dt",
        label: "Paso de reporte",
        unit: "s",
        step: 0.001,
        help: "Intervalo entre estados reportados a la interfaz."
      },
      {
        key: "maxSubstep",
        symbol: "Δt",
        label: "Paso máximo del integrador RK4",
        unit: "s",
        step: 0.0001,
        help: "El anexo propone 0,001 s. Pasos menores aumentan la precisión y el costo."
      },
      {
        key: "maxTime",
        symbol: "t_máx",
        label: "Tiempo máximo de observación",
        unit: "s",
        step: 5,
        help: "La simulación se detiene al alcanzarlo aunque el tren siga en movimiento."
      }
    ]
  }
];

/** Rango [mínimo, máximo] de un campo numérico. */
export function limitsOf(key: NumericKey): readonly [number, number] {
  const [min, max] = CONFIG_LIMITS[key];
  return [min, max];
}
