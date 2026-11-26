import { describe, test, expect, vi } from "vitest";
import { FixSearch } from "../src/lib/fix-search.svelte.ts";
import { findScenario, resolveConfig, runSimulation } from "../src/physics/index.js";

describe("Búsqueda de correcciones verificadas", () => {
  test("el loop circular encuentra al menos una corrección que aprueba, sin Worker", async () => {
    // Arrange
    const config = resolveConfig(findScenario("circular-loop").config);
    const search = new FixSearch();

    // Act
    search.start(config);
    await vi.waitFor(() => expect(search.status).toBe("done"), { timeout: 60_000, interval: 50 });

    // Assert
    expect(search.options.length).toBeGreaterThan(0);
    expect(search.tested).toBeGreaterThan(0);
    expect(runSimulation(search.options[0].config).verdict.approved).toBe(true);

    // Reabrir con el mismo diseño no repite la búsqueda.
    const options = search.options;
    search.start(config);
    expect(search.status).toBe("done");
    expect(search.options).toBe(options);
    search.stop();
  }, 90_000);

  test("al dejar de mirar (popover cerrado) la búsqueda en el hilo principal se detiene", async () => {
    // Arrange: sin Worker (Node), la búsqueda corre en el hilo principal.
    const config = resolveConfig(findScenario("circular-loop").config);
    const search = new FixSearch();
    search.start(config);
    await vi.waitFor(() => expect(search.tested).toBeGreaterThan(0), { timeout: 30_000, interval: 10 });

    // Act
    search.leave();
    const tested = search.tested;
    await new Promise(resolve => setTimeout(resolve, 200));

    // Assert
    expect(search.status).toBe("idle");
    expect(search.tested).toBe(tested);
  }, 60_000);
});
