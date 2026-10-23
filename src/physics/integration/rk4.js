/**
 * Integrador Runge–Kutta de cuarto orden para sistemas y' = f(y).
 * Error local O(dt⁵), error global O(dt⁴).
 *
 * @param {(values: number[]) => number[]} derivative Función f(y).
 * @param {number[]} values Estado y (vector).
 * @param {number} dt Paso (s).
 * @returns {number[]} Nuevo estado (vector nuevo, la entrada no se modifica).
 */
export function rk4(derivative, values, dt) {
  const combine = (/** @type {number[]} */ base, /** @type {number[]} */ slope, /** @type {number} */ factor) =>
    base.map((value, index) => value + slope[index] * factor);

  const k1 = derivative(values);
  const k2 = derivative(combine(values, k1, dt / 2));
  const k3 = derivative(combine(values, k2, dt / 2));
  const k4 = derivative(combine(values, k3, dt));

  return values.map(
    (value, index) =>
      value + (dt * (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index])) / 6
  );
}
