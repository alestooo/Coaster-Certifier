import { describe, test, expect } from "vitest";
import { fixTitle, changeText, changeReason, changeSymbol, changeValues } from "../src/lib/fix-text.ts";

const loopHigher = { key: "loopHeight", label: "Altura del loop", unit: "m", before: 21.5, after: 24 };
const brakeShorter = { key: "brakingLength", label: "Zona de frenado", unit: "m", before: 80, after: 60 };

describe("Textos de las correcciones", () => {
  test("un solo cambio que aumenta se titula «Aumentar …» con la etiqueta de la interfaz", () => {
    expect(fixTitle({ changes: [loopHigher] })).toBe("Aumentar altura del loop");
    expect(fixTitle({ changes: [brakeShorter] })).toBe("Reducir largo de frenado");
  });

  test("varios cambios se titulan con lo que cambia, en palabras: «Cambiar altura del loop y largo de frenado»", () => {
    expect(fixTitle({ changes: [loopHigher, brakeShorter] })).toBe("Cambiar altura del loop y largo de frenado");
    expect(fixTitle({ changes: [loopHigher, brakeShorter, { key: "friction", label: "μ", unit: "", before: 0.01, after: 0 }] })).toBe(
      "Cambiar altura del loop, largo de frenado y fricción (rodadura y aire)"
    );
  });

  test("cada cambio se separa en símbolo y valores para dibujar el símbolo con subíndice", () => {
    expect(changeSymbol(loopHigher)).toBe("h_L");
    expect(changeValues(loopHigher)).toBe("21,5 → 24 m");
  });

  test("changeText usa símbolo, coma decimal y unidad", () => {
    expect(changeText(loopHigher)).toBe("h_L: 21,5 → 24 m");
    expect(changeText({ key: "friction", label: "Coeficiente de fricción", unit: "", before: 0.01, after: 0.005 })).toBe("μ: 0,01 → 0,005");
  });

  test("changeReason explica la física del cambio", () => {
    expect(changeReason(loopHigher)).toMatch(/abre la base/);
  });
});
