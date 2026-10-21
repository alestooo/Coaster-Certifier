export type Passenger = {
  id: number;
  skin: string;
  hair: string;
  hairStyle: "short" | "long" | "shaved";
  shirt: string;
  hat: boolean;
  hatColor: string;
  mass: number;
};

export const MAX_PASSENGERS = 4;
export const SEATS_PER_CART = 2;

export const CART_MASS = 425;
export const DEFAULT_PASSENGER_MASS = 75;

// Límites de configuración de la aplicación.
export const MIN_PASSENGER_MASS = 20;
export const MAX_PASSENGER_MASS = 150;

export function normalizePassengerMass(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PASSENGER_MASS;
  }

  const limited = Math.min(
    MAX_PASSENGER_MASS,
    Math.max(MIN_PASSENGER_MASS, value)
  );

  return Math.round(limited * 10) / 10;
}

export function createPassenger(id: number): Passenger {
  return {
    id,
    skin: "#dca577",
    hair: "#382921",
    hairStyle: "short",
    shirt: "#8050cf",
    hat: false,
    hatColor: "#439c79",
    mass: DEFAULT_PASSENGER_MASS,
  };
}

export function resizePassengers(
  current: Passenger[],
  count: number
): Passenger[] {
  const safeCount = Number.isFinite(count)
    ? Math.min(MAX_PASSENGERS, Math.max(1, Math.round(count)))
    : 1;

  return Array.from({ length: safeCount }, (_, index) => {
    const passenger = {
      ...createPassenger(index + 1),
      ...current[index],
      id: index + 1,
    };

    return {
      ...passenger,
      mass: normalizePassengerMass(passenger.mass),
    };
  });
}

export function calculateCartCount(
  passengers: Passenger[]
): number {
  return Math.max(
    1,
    Math.ceil(passengers.length / SEATS_PER_CART)
  );
}

export function calculateTotalMass(
  passengers: Passenger[]
): number {
  const cartMass = calculateCartCount(passengers) * CART_MASS;

  const passengerMass = passengers.reduce(
    (total, passenger) => total + passenger.mass,
    0
  );

  return cartMass + passengerMass;
}