import { describe, test, expect } from "vitest";
import { valueToSlider, sliderToValue, decimalsFor, stepFrom, SLIDER_STEPS } from "../src/lib/ui/slider-scale.ts";

const linear = { min: 0, max: 10, step: 0.5, scale: "linear" };
const springConstant = { min: 100, max: 200000, step: 100, scale: "log" };
const damping = { min: 0, max: 50000, step: 50, scale: "log" };

describe("Escala del slider de un campo", () => {
  test("lineal: ida y vuelta exacta en los extremos y en el medio", () => {
    expect(valueToSlider(0, linear)).toBe(0);
    expect(valueToSlider(10, linear)).toBe(SLIDER_STEPS);
    expect(valueToSlider(5, linear)).toBe(SLIDER_STEPS / 2);
    expect(sliderToValue(SLIDER_STEPS / 2, linear)).toBe(5);
  });

  test("logarítmica: k = 6000 en [100, 200000] cae cerca del medio del recorrido y vuelve a 6000", () => {
    const position = valueToSlider(6000, springConstant);

    expect(position).toBeGreaterThan(450);
    expect(position).toBeLessThan(650);
    expect(sliderToValue(position, springConstant)).toBe(6000);
  });

  test("logarítmica con mínimo 0 (amortiguamiento): los extremos y valores intermedios vuelven", () => {
    expect(sliderToValue(0, damping)).toBe(0);
    expect(sliderToValue(SLIDER_STEPS, damping)).toBe(50000);
    expect(sliderToValue(valueToSlider(1000, damping), damping)).toBe(1000);
  });

  test("el valor siempre queda en el paso y dentro de [mín, máx]", () => {
    expect(sliderToValue(-10, linear)).toBe(0);
    expect(sliderToValue(1010, linear)).toBe(10);
    expect(sliderToValue(333, linear)).toBe(3.5);
    expect(valueToSlider(-3, linear)).toBe(0);
    expect(valueToSlider(99, linear)).toBe(SLIDER_STEPS);
  });

  test("decimalsFor da los decimales del paso", () => {
    expect(decimalsFor(1)).toBe(0);
    expect(decimalsFor(0.5)).toBe(1);
    expect(decimalsFor(0.25)).toBe(2);
    expect(decimalsFor(0.01)).toBe(2);
    expect(decimalsFor(0.0001)).toBe(4);
  });

  test("con un mínimo fuera de la grilla del paso, el slider igual llega a los valores redondos", () => {
    const height = { min: 0.1, max: 80, step: 0.5, scale: "linear" };
    const values = Array.from({ length: SLIDER_STEPS + 1 }, (_, position) => sliderToValue(position, height));

    expect(values).toContain(30);
    expect(values[0]).toBe(0.1);
    expect(values.at(-1)).toBe(80);
    // Todo valor está en la grilla del paso, salvo los extremos mismos (que pueden quedar fuera).
    for (const value of values.filter(value => value !== 0.1 && value !== 80)) {
      expect(Math.abs(value / 0.5 - Math.round(value / 0.5)), String(value)).toBeLessThan(1e-9);
    }
  });

  test("con un mínimo dinámico (R ≥ 0,05·h_L) llega a 5 m y a sus dos extremos", () => {
    const radius = { min: 0.05 * 21.5, max: 21.5 / 2, step: 0.25, scale: "linear" };
    const values = Array.from({ length: SLIDER_STEPS + 1 }, (_, position) => sliderToValue(position, radius));

    expect(values).toContain(5);
    expect(values[0]).toBeCloseTo(1.075, 9);
    expect(values.at(-1)).toBe(10.75);
  });

  test("logarítmica con mínimo 0: deja el cero en el extremo y cambia apenas se mueve", () => {
    expect(sliderToValue(0, damping)).toBe(0);
    expect(valueToSlider(0, damping)).toBe(0);
    expect(sliderToValue(SLIDER_STEPS * 0.05, damping)).toBeGreaterThan(0);
    expect(valueToSlider(50, damping)).toBeGreaterThanOrEqual(1);
    expect(sliderToValue(valueToSlider(2600, damping), damping)).toBe(2600);
  });

  test("un paso con el teclado vuelve a la grilla: de 29,6 sube a 30 y baja a 29,5", () => {
    const height = { min: 0.1, max: 80, step: 0.5 };

    expect(stepFrom(29.6, 1, height)).toBe(30);
    expect(stepFrom(29.6, -1, height)).toBe(29.5);
    expect(stepFrom(30, 1, height)).toBe(30.5);
    expect(stepFrom(80, 10, height)).toBe(80);
    expect(stepFrom(0.1, -1, height)).toBe(0.1);
  });
});
