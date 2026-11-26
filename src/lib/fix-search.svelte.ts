/**
 * Búsqueda de correcciones verificadas para un diseño que no aprueba.
 *
 * Corre `recommendationSearch` en un Web Worker; si no hay Worker, lo
 * recorre en el hilo principal de a una simulación por tarea para no
 * congelar la interfaz. Los resultados se guardan por diseño: reabrir el
 * popover del mismo trazado no repite la búsqueda.
 */
import { recommendationSearch } from "../physics/index.js";
import type { FixOption } from "./fix-text";
import type { SimulationConfig } from "./types";

export type FixStatus = "idle" | "searching" | "done" | "error";

interface Outcome {
  options: FixOption[];
  reason: string;
  tested: number;
  total: number;
}

interface Progress {
  tested: number;
  total: number;
}

/** Diseños cuyas correcciones se recuerdan. */
const CACHE_SIZE = 8;
/** Tiempo máximo de trabajo por tarea en el hilo principal (ms). */
const MAIN_THREAD_SLICE_MS = 12;

export class FixSearch {
  status = $state<FixStatus>("idle");
  tested = $state(0);
  total = $state(0);
  options = $state.raw<FixOption[]>([]);
  reason = $state("");

  #key = "";
  #run = 0;
  #worker: Worker | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #cache = new Map<string, Outcome>();

  /** Busca correcciones para `config`; si ya se buscaron, las muestra al instante. */
  start(config: SimulationConfig): void {
    const key = JSON.stringify(config);

    if (key === this.#key && this.status !== "idle" && this.status !== "error") return;

    this.stop();
    this.#key = key;

    const cached = this.#cache.get(key);

    if (cached) {
      this.#show(cached);
      return;
    }

    this.status = "searching";
    this.tested = 0;
    this.total = 0;
    this.options = [];
    this.reason = "";

    const run = ++this.#run;
    const plain = JSON.parse(key) as SimulationConfig;

    if (!this.#startWorker(plain, key, run)) this.#searchHere(plain, key, run);
  }

  /**
   * Nadie mira los resultados (se cerró el popover). En el Worker la búsqueda
   * termina en segundo plano y queda guardada para reabrir al instante; en el
   * hilo principal se detiene para no gastar la interfaz.
   */
  leave(): void {
    if (!this.#worker) this.stop();
  }

  stop(): void {
    this.#run++;
    this.#worker?.terminate();
    this.#worker = null;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    if (this.status === "searching") this.status = "idle";
  }

  #show(outcome: Outcome): void {
    this.options = outcome.options;
    this.reason = outcome.reason;
    this.tested = outcome.tested;
    this.total = outcome.total;
    this.status = "done";
  }

  #finish(key: string, run: number, outcome: Outcome): void {
    if (run !== this.#run) return;

    if (this.#cache.size >= CACHE_SIZE) this.#cache.delete(this.#cache.keys().next().value as string);
    this.#cache.set(key, outcome);
    this.#worker?.terminate();
    this.#worker = null;
    this.#show(outcome);
  }

  #fail(run: number, message: string): void {
    if (run !== this.#run) return;

    this.#worker?.terminate();
    this.#worker = null;
    this.reason = message;
    this.status = "error";
  }

  #progress(run: number, progress: Progress): void {
    if (run !== this.#run) return;

    this.tested = progress.tested;
    this.total = progress.total;
  }

  #startWorker(config: SimulationConfig, key: string, run: number): boolean {
    let worker: Worker;

    try {
      worker = new Worker(new URL("../ui/recommendation.worker.js", import.meta.url), { type: "module" });
    } catch {
      return false;
    }

    this.#worker = worker;
    worker.onmessage = event => {
      const data = event.data;
      if (data.type === "progress") this.#progress(run, data);
      if (data.type === "done") this.#finish(key, run, { options: data.recommendations, reason: data.reason, tested: data.tested, total: data.tested });
      if (data.type === "error") this.#fail(run, data.message);
    };
    worker.onerror = () => {
      // Si el Worker no carga, la búsqueda sigue en el hilo principal.
      if (run !== this.#run) return;
      this.#worker?.terminate();
      this.#worker = null;
      this.#searchHere(config, key, run);
    };
    worker.postMessage({ config });
    return true;
  }

  #searchHere(config: SimulationConfig, key: string, run: number): void {
    let search: ReturnType<typeof recommendationSearch>;

    try {
      search = recommendationSearch(config);
    } catch (problem) {
      this.#fail(run, problem instanceof Error ? problem.message : "No se pudo revisar la configuración.");
      return;
    }

    const step = () => {
      if (run !== this.#run) return;

      try {
        const deadline = performance.now() + MAIN_THREAD_SLICE_MS;
        let result = search.next();

        while (!result.done && performance.now() < deadline) {
          this.#progress(run, result.value);
          result = search.next();
        }

        if (result.done) {
          const value = result.value;
          this.#finish(key, run, { options: value.recommendations, reason: value.reason, tested: value.tested, total: value.tested });
          return;
        }

        this.#progress(run, result.value);
        this.#timer = setTimeout(step, 0);
      } catch (problem) {
        this.#fail(run, problem instanceof Error ? problem.message : "No se pudo revisar la configuración.");
      }
    };

    this.#timer = setTimeout(step, 0);
  }
}
