import { describe, test, expect } from "vitest";
import { OptimizerJob } from "../src/lib/optimizer.svelte.ts";
import { resolveConfig, findScenario } from "../src/physics/index.js";

/** Espera a que el trabajo termine (o falle). */
async function settle(job, timeoutMs = 50_000) {
  const start = Date.now();
  while (job.status === "running" && Date.now() - start < timeoutMs) await new Promise(resolve => setTimeout(resolve, 20));
}

describe("Trabajo del optimizador", () => {
  test("sin Worker corre en el hilo principal, informa el progreso y termina con un resultado verificado", async () => {
    // Arrange: en Node no hay Worker.
    const job = new OptimizerJob();
    const config = resolveConfig(findScenario("certification").config);

    // Act
    job.start(config, { objective: "height", variables: ["initialHeight"], budget: 30 });
    expect(job.status).toBe("running");
    await settle(job);

    // Assert
    expect(job.status).toBe("done");
    expect(job.progress?.tested).toBeGreaterThan(0);
    expect(job.result?.ok).toBe(true);
    expect(job.result?.config.initialHeight).toBeLessThan(config.initialHeight);
  }, 60_000);

  test("detener corta la búsqueda y no deja resultado", async () => {
    const job = new OptimizerJob();

    job.start(resolveConfig(findScenario("certification").config), { objective: "maxLoad", variables: ["initialHeight"], budget: 300 });
    job.stop();
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(job.status).toBe("idle");
    expect(job.result).toBeNull();
  });
});
