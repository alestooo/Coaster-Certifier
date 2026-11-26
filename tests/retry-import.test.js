import { describe, test, expect } from "vitest";
import { retryUrl } from "../src/lib/retry-import.ts";

describe("Reintento de módulos cargados bajo demanda", () => {
  test("toma la URL del módulo que falló y le agrega un parámetro nuevo", () => {
    const error = new TypeError("Failed to fetch dynamically imported module: http://localhost:4173/assets/PassengerEditor-AbC1.js");

    expect(retryUrl(error, 2)).toBe("http://localhost:4173/assets/PassengerEditor-AbC1.js?retry=2");
  });

  test("sin URL de módulo en el error no hay reintento por URL", () => {
    expect(retryUrl(new Error("otra cosa"), 1)).toBeNull();
    expect(retryUrl("texto", 1)).toBeNull();
  });
});
