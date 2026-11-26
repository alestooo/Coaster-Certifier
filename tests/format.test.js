import { describe, test, expect } from "vitest";
import { parseDecimal, formatSigned, formatSpeed, formatEnergy, symbolParts, formatScientific } from "../src/ui/format.ts";

describe("Formato numérico, unidades y símbolos", () => {
  test("parseDecimal acepta coma y punto y rechaza lo ilegible", () => {
    expect(parseDecimal("3,5")).toBe(3.5);
    expect(parseDecimal("3.5")).toBe(3.5);
    expect(parseDecimal(" 12 ")).toBe(12);
    expect(parseDecimal("−2,25")).toBe(-2.25);
    expect(parseDecimal("-0")).toBe(0);
    expect(parseDecimal(",5")).toBe(0.5);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("1e3")).toBeNull();
    expect(parseDecimal("1,2,3")).toBeNull();
    expect(parseDecimal("-")).toBeNull();
  });

  test("formatSigned usa el signo menos tipográfico", () => {
    expect(formatSigned(-1, 1)).toBe("−1,0");
    expect(formatSigned(5, 1)).toBe("5,0");
  });

  test("formatSpeed da m/s como dato principal y km/h como secundario", () => {
    expect(formatSpeed(19.51)).toEqual({ main: "19,5 m/s", secondary: "70 km/h" });
  });

  test("formatEnergy expresa las energías en kJ", () => {
    expect(formatEnergy(114188)).toBe("114,2 kJ");
    expect(formatEnergy(500, 2)).toBe("0,50 kJ");
  });

  test("symbolParts separa el subíndice del anexo", () => {
    expect(symbolParts("h_L")).toEqual({ base: "h", sub: "L" });
    expect(symbolParts("ρ_c")).toEqual({ base: "ρ", sub: "c" });
    expect(symbolParts("x_máx")).toEqual({ base: "x", sub: "máx" });
    expect(symbolParts("v₀")).toEqual({ base: "v₀" });
    expect(symbolParts("n")).toEqual({ base: "n" });
  });
});

describe("Notación científica con coma", () => {
  test("escribe mantisa con coma y potencia de 10 con exponente en superíndice", () => {
    expect(formatScientific(0.0502, 2)).toBe("5,02·10⁻²");
    expect(formatScientific(4.4e-5, 2)).toBe("4,40·10⁻⁵");
    expect(formatScientific(12345, 1)).toBe("1,2·10⁴");
  });

  test("cero y negativos", () => {
    expect(formatScientific(0, 2)).toBe("0");
    expect(formatScientific(-0.0031, 1)).toBe("−3,1·10⁻³");
  });
});
