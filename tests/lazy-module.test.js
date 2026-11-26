import { describe, test, expect } from "vitest";
import { LazyModule } from "../src/lib/lazy-module.svelte.ts";

const MODULE_URL = "http://localhost:4173/assets/ReportDialog-AbC1.js";

describe("Módulos cargados bajo demanda", () => {
  test("load descarga una sola vez y devuelve siempre la misma promesa", async () => {
    let calls = 0;
    const lazy = new LazyModule(async () => {
      calls++;
      return { default: "módulo" };
    });

    expect(lazy.promise).toBeNull();
    const first = lazy.load();
    const second = lazy.load();

    expect(second).toBe(first);
    expect(lazy.promise).toBe(first);
    await expect(first).resolves.toEqual({ default: "módulo" });
    expect(calls).toBe(1);
  });

  test("retry pide la URL del módulo con ?retry=n cuando el error la trae", async () => {
    const asked = [];
    const lazy = new LazyModule(
      () => Promise.reject(new TypeError(`Failed to fetch dynamically imported module: ${MODULE_URL}`)),
      async url => {
        asked.push(url);
        return { default: "recuperado" };
      }
    );

    const error = await lazy.load().catch(problem => problem);
    lazy.retry(error);
    await expect(lazy.promise).resolves.toEqual({ default: "recuperado" });
    lazy.retry(error);

    expect(asked).toEqual([`${MODULE_URL}?retry=1`, `${MODULE_URL}?retry=2`]);
  });

  test("retry vuelve a llamar al loader cuando el error no trae URL", async () => {
    let calls = 0;
    const lazy = new LazyModule(async () => {
      calls++;
      if (calls === 1) throw new Error("sin red");
      return { default: "segunda vez" };
    });

    const error = await lazy.load().catch(problem => problem);
    lazy.retry(error);

    await expect(lazy.promise).resolves.toEqual({ default: "segunda vez" });
    expect(calls).toBe(2);
  });
});

describe("Módulos cargados bajo demanda: después de un fallo", () => {
  test("load vuelve a intentar si la descarga anterior falló (p. ej. una precarga sin red)", async () => {
    let calls = 0;
    const lazy = new LazyModule(async () => {
      calls++;
      if (calls === 1) throw new Error("sin red");
      return { default: "con red" };
    });

    await lazy.load().catch(() => undefined);
    const second = lazy.load();

    await expect(second).resolves.toEqual({ default: "con red" });
    expect(calls).toBe(2);
  });

  test("load no repite una descarga que todavía está en curso", async () => {
    let calls = 0;
    let finish;
    const lazy = new LazyModule(() => {
      calls++;
      return new Promise(resolve => (finish = resolve));
    });

    const first = lazy.load();
    const second = lazy.load();
    finish({ default: "listo" });

    expect(second).toBe(first);
    await expect(second).resolves.toEqual({ default: "listo" });
    expect(calls).toBe(1);
  });
});
