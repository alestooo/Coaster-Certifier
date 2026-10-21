import {
  createPassenger,
  type Passenger,
} from "./passengers";

export type GameSession = {
  mapId: string;
  passengerCount: number;
  passengers: Passenger[];
};

export function createSession(): GameSession {
  return {
    mapId: "slope",
    passengerCount: 1,
    passengers: [createPassenger(1)],
  };
}