import { describe, test, expect } from "vitest";
import { fixTitle, changeText, changeReason } from "../src/lib/fix-text.ts";

const loopHigher = { key: "loopHeight", label: "Altura del loop", unit: "m", before: 21.5, after: 24 };
const brakeShorter = { key: "brakingLength", label: "Zona de frenado", unit: "m", before: 80, after: 60 };

describe("Textos de las correcciones", () => {
  test("un solo cambio que aumenta se titula «Aumentar …» con la etiqueta de la interfaz", () => {
    expect(fixTitle({ changes: [loopHigher] })).toBe("Aumentar altura del loop");
    expect(fixTitle({ changes: [brakeShorter] })).toBe("Reducir largo de la zona de frenado");
  });

  test("varios cambios se titulan «Combinar ajustes del recorrido»", () => {
    expect(fixTitle({ changes: [loopHigher, brakeShorter] })).toBe("Combinar ajustes del recorrido");
  });

  test("changeText usa símbolo, coma decimal y unidad", () => {
    expect(changeText(loopHigher)).toBe("h_L: 21,5 → 24 m");
    expect(changeText({ key: "friction", label: "Coeficiente de fricción", unit: "", before: 0.01, after: 0.005 })).toBe("μ: 0,01 → 0,005");
  });

  test("changeReason explica la física del cambio", () => {
    expect(changeReason(loopHigher)).toMatch(/abre la base/);
  });
});
