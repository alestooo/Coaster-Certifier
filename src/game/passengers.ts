/**
 * Modelo de pasajeros y del tren para la interfaz.
 * La apariencia no afecta la física; solo la masa entra en el modelo.
 */

export type HairStyle = "short" | "long" | "curly" | "ponytail" | "bun" | "shaved";
export type ShirtStyle = "plain" | "stripes" | "hoodie";
export type Accessory = "none" | "cap" | "helmet" | "glasses" | "party" | "headphones";
export type Mood = "happy" | "brave" | "nervous";

export type Passenger = {
  id: number;
  name: string;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  shirtStyle: ShirtStyle;
  shirtAccent: string;
  accessory: Accessory;
  accessoryColor: string;
  mood: Mood;
  mass: number;
};

export const MAX_PASSENGERS = 4;
export const SEATS_PER_CART = 2;

/** Masa de un carrito vacío (kg). */
export const CART_MASS = 425;

/** Masa por defecto de una persona (kg). */
export const DEFAULT_PASSENGER_MASS = 75;

export const MIN_PASSENGER_MASS = 20;
export const MAX_PASSENGER_MASS = 150;

export const SKIN_COLORS = ["#f8dcc2", "#f1c7a3", "#dca577", "#c68a5a", "#a86d48", "#7d4f36", "#5a3826"];
export const HAIR_COLORS = ["#17151a", "#382921", "#6b4a2b", "#b47c38", "#d9a65a", "#c94f3a", "#8d8d94", "#5f4bb6"];
export const SHIRT_COLORS = ["#8050cf", "#338fc2", "#2f9d78", "#d86d85", "#e6ae3b", "#e5533d", "#2b2f45", "#f5f1ea"];
export const ACCESSORY_COLORS = ["#439c79", "#8050cf", "#338fc2", "#d86d85", "#e6ae3b", "#2b2f45", "#f5f1ea"];

export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: "short", label: "Corto" },
  { id: "long", label: "Largo" },
  { id: "curly", label: "Rizado" },
  { id: "ponytail", label: "Cola" },
  { id: "bun", label: "Moño" },
  { id: "shaved", label: "Rapado" }
];

export const SHIRT_STYLES: { id: ShirtStyle; label: string }[] = [
  { id: "plain", label: "Lisa" },
  { id: "stripes", label: "Rayas" },
  { id: "hoodie", label: "Sudadera" }
];

export const ACCESSORIES: { id: Accessory; label: string }[] = [
  { id: "none", label: "Nada" },
  { id: "cap", label: "Gorra" },
  { id: "helmet", label: "Casco" },
  { id: "glasses", label: "Lentes" },
  { id: "party", label: "Gorro de fiesta" },
  { id: "headphones", label: "Audífonos" }
];

export const MOODS: { id: Mood; label: string; description: string }[] = [
  { id: "happy", label: "Feliz", description: "Sonríe todo el recorrido y grita de alegría en las bajadas." },
  { id: "brave", label: "Valiente", description: "Brazos arriba en cada loop; nada lo asusta." },
  { id: "nervous", label: "Nervioso", description: "Se agarra fuerte y cierra los ojos cuando la carga sube." }
];

export const PASSENGER_NAMES = [
  "Ana", "Luis", "Sofía", "Mateo", "Valeria", "Diego", "Camila", "Andrés",
  "Lucía", "Gabriel", "Daniela", "Tomás", "Paula", "Javier", "Mariana", "Sebastián"
];

/** Generador pseudoaleatorio determinista (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

export function normalizePassengerMass(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PASSENGER_MASS;
  }

  const limited = Math.min(MAX_PASSENGER_MASS, Math.max(MIN_PASSENGER_MASS, value));
  return Math.round(limited * 10) / 10;
}

export function createPassenger(id: number): Passenger {
  const defaults: Passenger[] = [
    { id: 1, name: "Ana", skin: "#f1c7a3", hair: "#382921", hairStyle: "ponytail", shirt: "#8050cf", shirtStyle: "plain", shirtAccent: "#f5f1ea", accessory: "none", accessoryColor: "#439c79", mood: "happy", mass: DEFAULT_PASSENGER_MASS },
    { id: 2, name: "Luis", skin: "#dca577", hair: "#17151a", hairStyle: "short", shirt: "#338fc2", shirtStyle: "stripes", shirtAccent: "#f5f1ea", accessory: "cap", accessoryColor: "#e6ae3b", mood: "brave", mass: 82 },
    { id: 3, name: "Sofía", skin: "#a86d48", hair: "#6b4a2b", hairStyle: "curly", shirt: "#2f9d78", shirtStyle: "hoodie", shirtAccent: "#2b2f45", accessory: "glasses", accessoryColor: "#2b2f45", mood: "nervous", mass: 64 },
    { id: 4, name: "Mateo", skin: "#f8dcc2", hair: "#d9a65a", hairStyle: "bun", shirt: "#e5533d", shirtStyle: "plain", shirtAccent: "#f5f1ea", accessory: "headphones", accessoryColor: "#8050cf", mood: "happy", mass: 70 }
  ];

  const base = defaults[(id - 1) % defaults.length];
  return { ...base, id };
}

/** Apariencia aleatoria pero reproducible a partir de una semilla. */
export function randomizePassenger(passenger: Passenger, seed: number): Passenger {
  const random = seededRandom(seed);

  return {
    ...passenger,
    name: pick(random, PASSENGER_NAMES),
    skin: pick(random, SKIN_COLORS),
    hair: pick(random, HAIR_COLORS),
    hairStyle: pick(random, HAIR_STYLES).id,
    shirt: pick(random, SHIRT_COLORS),
    shirtStyle: pick(random, SHIRT_STYLES).id,
    shirtAccent: pick(random, SHIRT_COLORS),
    accessory: pick(random, ACCESSORIES).id,
    accessoryColor: pick(random, ACCESSORY_COLORS),
    mood: pick(random, MOODS).id
  };
}

export function resizePassengers(current: Passenger[], count: number): Passenger[] {
  const safeCount = Number.isFinite(count)
    ? Math.min(MAX_PASSENGERS, Math.max(1, Math.round(count)))
    : 1;

  return Array.from({ length: safeCount }, (_, index) => {
    const passenger = {
      ...createPassenger(index + 1),
      ...current[index],
      id: index + 1
    };

    return {
      ...passenger,
      mass: normalizePassengerMass(passenger.mass)
    };
  });
}

export function calculateCartCount(passengers: Passenger[]): number {
  return Math.max(1, Math.ceil(passengers.length / SEATS_PER_CART));
}

export function calculateTotalMass(passengers: Passenger[]): number {
  const cartMass = calculateCartCount(passengers) * CART_MASS;
  const passengerMass = passengers.reduce((total, passenger) => total + passenger.mass, 0);

  return cartMass + passengerMass;
}
