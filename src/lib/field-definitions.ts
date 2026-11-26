import { CONFIG_LIMITS } from "../physics/index.js";
import type { SimulationConfig } from "./types";
import type { AreaId } from "./audit";
import { formatNumber, kmh } from "../ui/format";

export type NumericKey = keyof typeof CONFIG_LIMITS;

export interface FieldDefinition {
  key: NumericKey;
  /** Símbolo del enunciado del proyecto (anexo). */
  symbol: string;
  label: string;
  unit: string;
  step: number;
  help: string;
  /** Devuelve verdadero cuando el campo aplica a la configuración dada. */
  visible?: (config: SimulationConfig) => boolean;
  /** Lectura calculada que acompaña al valor (equivalencias, umbrales). */
  hint?: (config: SimulationConfig) => string;
}

export interface FieldGroup {
  id: AreaId;
  title: string;
  /** Puntos del trazado que cubre el grupo, como en el lienzo. */
  points?: string;
  fields: FieldDefinition[];
  visible?: (config: SimulationConfig) => boolean;
}

export interface ChoiceOption<T extends string> {
  value: T;
  title: string;
  description: string;
}

const METRES_PER_FLOOR = 3;

const hasLoop = (config: SimulationConfig) => ["loop", "reference"].includes(config.mapId);
const hasHill = (config: SimulationConfig) => ["valley", "reference"].includes(config.mapId);
const isStation = (config: SimulationConfig) => config.brakeMode === "station";
const isSpring = (config: SimulationConfig) => config.brakeMode === "spring";
const hasSafetyWheels = (config: SimulationConfig) => config.contactModel === "safety-wheels";

/** Sistemas de frenado disponibles al final del recorrido. */
export const BRAKE_OPTIONS: ChoiceOption<SimulationConfig["brakeMode"]>[] = [
  {
    value: "station",
    title: "Frenos en la recta final",
    description: "Frenan a ritmo constante entre E y F hasta detener el tren."
  },
  {
    value: "spring",
    title: "Resorte de tope",
    description: "Un resorte al final de la vía absorbe la energía al comprimirse."
  }
];

/** Reglas de contacto con la vía que exige la certificación. */
export const CONTACT_OPTIONS: ChoiceOption<SimulationConfig["contactModel"]>[] = [
  {
    value: "strict",
    title: "Siempre apoyado",
    description: "El tren debe empujar la vía en todo el recorrido (N > 0)."
  },
  {
    value: "safety-wheels",
    title: "Con ruedas anti-levantamiento",
    description: "Puede flotar sobre las crestas sin bajar de n_mín; en el loop se sigue exigiendo N > 0."
  }
];

/** Grupos de parámetros del panel de diseño, en el orden en que el tren los recorre. */
export const FIELD_GROUPS: FieldGroup[] = [
  {
    id: "start",
    title: "Salida",
    points: "A",
    fields: [
      {
        key: "initialHeight",
        symbol: "H",
        label: "Altura de la cima inicial",
        unit: "m",
        step: 0.5,
        help: "Altura desde la que cae el tren. Fija la energía disponible para todo el recorrido.",
        hint: config => `≈ ${Math.max(1, Math.round(config.initialHeight / METRES_PER_FLOOR))} pisos de un edificio`
      },
      {
        key: "initialSpeed",
        symbol: "v₀",
        label: "Rapidez al soltar la cadena",
        unit: "m/s",
        step: 0.1,
        help: "Rapidez con la que el tren pasa por la cima A. El anexo propone entre 0,5 y 5 m/s.",
        hint: config => (config.initialSpeed === 0 ? "Parte desde el reposo" : `${formatNumber(kmh(config.initialSpeed), 1)} km/h`)
      }
    ]
  },
  {
    id: "layout",
    title: "Trazado y pérdidas",
    fields: [
      {
        key: "trackWidth",
        symbol: "W",
        label: "Largo horizontal del trazado",
        unit: "m",
        step: 5,
        help: "Distancia horizontal desde A hasta la recta de llegada. Más largo = pendientes más suaves."
      },
      {
        key: "friction",
        symbol: "μ",
        label: "Fricción (rodadura y aire)",
        unit: "",
        step: 0.001,
        help: "Coeficiente efectivo: la fricción vale f = μ·N y se opone al movimiento.",
        hint: config =>
          config.friction === 0 ? "Sin pérdidas: caso ideal" : `Se opone con el ${formatNumber(100 * config.friction, 1)} % de la fuerza normal`
      }
    ]
  },
  {
    id: "loop",
    title: "Loop",
    points: "B · C",
    visible: hasLoop,
    fields: [
      {
        key: "loopHeight",
        symbol: "h_L",
        label: "Altura del loop",
        unit: "m",
        step: 0.5,
        help: "Altura de la cima C sobre la entrada B."
      },
      {
        key: "loopTopRadius",
        symbol: "R",
        label: "Radio en la cima",
        unit: "m",
        step: 0.25,
        help: "Curvatura en C. Para no despegarse, el tren necesita v² ≥ g·R en la cima. Con R = h_L/2 el loop es circular; más chico, en forma de lágrima.",
        hint: config =>
          `Necesita ≥ ${formatNumber(Math.sqrt(config.gravity * config.loopTopRadius), 1)} m/s en la cima · radio en la base ${formatNumber(config.loopHeight - config.loopTopRadius, 1)} m`
      }
    ]
  },
  {
    id: "hill",
    title: "Colina",
    points: "D",
    visible: hasHill,
    fields: [
      {
        key: "hillHeight",
        symbol: "h_c",
        label: "Altura de la colina",
        unit: "m",
        step: 0.5,
        help: "Altura de la cresta D. Con 0 m no hay colina."
      },
      {
        key: "hillCrestRadius",
        symbol: "ρ_c",
        label: "Radio de la cresta",
        unit: "m",
        step: 1,
        help: "Curvatura en D: más chico = cresta más cerrada y más sensación de flotar. n_D = 1 − v_D²/(g·ρ_c).",
        hint: config => `Flota (0 g) si la cruza a más de ${formatNumber(Math.sqrt(config.gravity * config.hillCrestRadius), 1)} m/s`
      }
    ]
  },
  {
    id: "braking",
    title: "Frenado",
    points: "E → F",
    fields: [
      {
        key: "brakingLength",
        symbol: "d_f",
        label: "Largo de la zona de frenado",
        unit: "m",
        step: 1,
        help: "Recta final entre E y F donde el tren debe quedar detenido."
      },
      {
        key: "brakeDeceleration",
        symbol: "a_f",
        label: "Intensidad de los frenos",
        unit: "m/s²",
        step: 0.1,
        help: "Desaceleración constante mientras frena. El anexo la limita a 1 g (9,81 m/s²) por comodidad.",
        visible: isStation,
        hint: config =>
          `≈ ${formatNumber(config.brakeDeceleration / config.gravity, 2)} g · pierde ${formatNumber(config.brakeDeceleration, 1)} m/s cada segundo`
      },
      {
        key: "springConstant",
        symbol: "k",
        label: "Rigidez del resorte",
        unit: "N/m",
        step: 100,
        help: "F = −k·x: cuanto más rígido, menos se comprime para absorber la misma energía.",
        visible: isSpring
      },
      {
        key: "springDamping",
        symbol: "c",
        label: "Amortiguador",
        unit: "N·s/m",
        step: 50,
        help: "Disipa energía con una fuerza −c·v. Con 0 el resorte devuelve toda la energía.",
        visible: isSpring,
        hint: config => (config.springDamping === 0 ? "Sin amortiguador: el tren rebota sin detenerse" : "Disipa la energía del rebote")
      },
      {
        key: "maxCompression",
        symbol: "x_máx",
        label: "Compresión máxima permitida",
        unit: "m",
        step: 0.1,
        help: "Cuánto se puede comprimir el resorte antes de considerarse un choque.",
        visible: isSpring
      }
    ]
  },
  {
    id: "criteria",
    title: "Reglas de certificación",
    fields: [
      {
        key: "maxLoad",
        symbol: "n_máx",
        label: "Fuerza g máxima permitida",
        unit: "g",
        step: 0.1,
        help: "Lo más fuerte que puede sentir un pasajero, n = N/(m·g). 1 g es estar sentado en reposo; el anexo fija +5 g."
      },
      {
        key: "minLoad",
        symbol: "n_mín",
        label: "Fuerza g mínima permitida",
        unit: "g",
        step: 0.1,
        help: "Con valores negativos el pasajero se separa del asiento y lo sujeta la barra. El anexo fija −1 g.",
        visible: hasSafetyWheels
      },
      {
        key: "minSpeed",
        symbol: "v_mín",
        label: "Rapidez mínima en subidas",
        unit: "m/s",
        step: 0.1,
        help: "Si al subir la rapidez cae por debajo de este valor, se considera que el tren se quedó sin impulso."
      }
    ]
  },
  {
    id: "numeric",
    title: "Precisión numérica",
    fields: [
      {
        key: "timeStep",
        symbol: "dt",
        label: "Intervalo entre muestras",
        unit: "s",
        step: 0.001,
        help: "Cada cuánto se guarda un estado para las gráficas y el CSV."
      },
      {
        key: "maxSubstep",
        symbol: "Δt",
        label: "Paso máximo de RK4",
        unit: "s",
        step: 0.0001,
        help: "El anexo propone 0,001 s. Pasos menores aumentan la precisión y el costo."
      },
      {
        key: "maxTime",
        symbol: "t_máx",
        label: "Tiempo máximo simulado",
        unit: "s",
        step: 5,
        help: "Si el tren sigue en movimiento al alcanzarlo, la simulación se detiene sin aprobar."
      }
    ]
  }
];

/** Grupos que aplican a la configuración, cada uno solo con sus campos visibles. */
export function visibleGroups(config: SimulationConfig): FieldGroup[] {
  return FIELD_GROUPS.filter(group => !group.visible || group.visible(config)).map(group => ({
    ...group,
    fields: group.fields.filter(field => !field.visible || field.visible(config))
  }));
}

/** Campos que aplican a la configuración, en el orden del panel. */
export function visibleFields(config: SimulationConfig): FieldDefinition[] {
  return visibleGroups(config).flatMap(group => group.fields);
}

/** Rango [mínimo, máximo] de un campo numérico. */
export function limitsOf(key: NumericKey): readonly [number, number] {
  const [min, max] = CONFIG_LIMITS[key];
  return [min, max];
}

/** Definición de un campo por su clave de configuración. */
export function fieldByKey(key: string): FieldDefinition | undefined {
  for (const group of FIELD_GROUPS) {
    const field = group.fields.find(candidate => candidate.key === key);
    if (field) return field;
  }

  return undefined;
}

/**
 * Traduce un error de validación de la librería a un mensaje con la
 * etiqueta del campo y su unidad, en lugar de la clave interna.
 */
export function friendlyConfigMessage(field: string, message: string): string {
  const definition = fieldByKey(field);

  if (!definition || !message.startsWith(`${field}:`)) return message;

  const decimal = (value: string) => value.replace(".", ",");
  const rest = message
    .slice(field.length + 1)
    .trim()
    .replace(/entre (\S+) y (\S+?)\.$/, (_, min: string, max: string) =>
      `entre ${decimal(min)} y ${decimal(max)}${definition.unit ? ` ${definition.unit}` : ""}.`
    );

  return `${definition.label}: ${rest}`;
}
