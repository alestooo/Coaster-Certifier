import { describe, test, expect } from "vitest";
import { buildTrack, resolveConfig } from "../src/physics/index.js";
import { pointLegend } from "../src/lib/point-legend.ts";

const legendOf = mapId => pointLegend(buildTrack(resolveConfig({ mapId })));

describe("Leyenda de las letras A–F", () => {
  test("Bajada simple: A, E y F presentes; B, C y D ausentes con su nota", () => {
    const legend = legendOf("slope");

    expect(legend.map(item => item.letter)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(legend.filter(item => item.present).map(item => item.letter)).toEqual(["A", "E", "F"]);
    expect(legend.find(item => item.letter === "B").note).toBe("este trazado no tiene loop");
    expect(legend.find(item => item.letter === "C").note).toBe("este trazado no tiene loop");
    expect(legend.find(item => item.letter === "D").note).toBe("este trazado no tiene colina");
    expect(legend.find(item => item.letter === "E").name).toBe("Inicio de la zona de frenado");
  });

  test("el trazado del anexo tiene las seis letras y ninguna nota", () => {
    const legend = legendOf("reference");

    expect(legend.every(item => item.present)).toBe(true);
    expect(legend.every(item => item.note === undefined)).toBe(true);
  });

  test("cada letra tiene un nombre que dice qué es", () => {
    expect(legendOf("reference").map(item => item.name)).toEqual([
      "Cima de la subida: inicio del recorrido",
      "Entrada al loop",
      "Cima del loop",
      "Cresta de la colina",
      "Inicio de la zona de frenado",
      "Fin de la zona de frenado"
    ]);
  });
});
