import { describe, test, expect } from "vitest";
import { brakingCard } from "../src/lib/braking-card";

const base = { entrySpeed: 18, stoppingDistance: null, requiredDistance: null, available: 80, text: "" };

describe("Tarjeta de distancia de frenado", () => {
  test("detenido: distancia usada de la disponible", () => {
    expect(brakingCard({ ...base, outcome: "stopped", stoppingDistance: 32.1, tone: "ok" }, "finished")).toMatchObject({ value: "32,1 m", note: "de 80 m disponibles", tone: "ok" });
  });

  test("el resorte lo devuelve antes de E: rebota y queda fuera de la zona", () => {
    expect(brakingCard({ ...base, outcome: "returned", tone: "bad" }, "stalled")).toMatchObject({ value: "Rebota", note: "el resorte lo devuelve y queda antes de E", tone: "bad" });
  });

  test("quieto antes de E sin cortar la simulación: no llega", () => {
    expect(brakingCard({ ...base, outcome: "not-reached", tone: "info" }, "stalled")).toMatchObject({ value: "No llega" });
  });

  test("la simulación se cortó en un incumplimiento antes de la zona: sin dato", () => {
    expect(brakingCard({ ...base, outcome: "not-reached", tone: "info" }, "rejected")).toMatchObject({ value: "Sin dato" });
  });
});
