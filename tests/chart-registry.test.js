import { describe, test, expect } from "vitest";
import { Chart } from "chart.js";
import "../src/ui/charts/physicsChart.js";

describe("Registro de Chart.js", () => {
  test("registra lo que usan las gráficas: líneas, escala lineal, leyenda y tooltip", () => {
    expect(Chart.registry.controllers.get("line")).toBeDefined();
    expect(Chart.registry.scales.get("linear")).toBeDefined();
    expect(Chart.registry.elements.get("line")).toBeDefined();
    expect(Chart.registry.elements.get("point")).toBeDefined();
    expect(Chart.registry.plugins.get("legend")).toBeDefined();
    expect(Chart.registry.plugins.get("tooltip")).toBeDefined();
  });

  test("no registra tipos que no usa (barras, tortas, escalas de tiempo): el módulo pesa menos", () => {
    expect(Chart.registry.controllers.get("bar")).toBeUndefined();
    expect(Chart.registry.controllers.get("pie")).toBeUndefined();
    expect(Chart.registry.scales.get("time")).toBeUndefined();
  });
});
