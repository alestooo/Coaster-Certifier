/**
 * Optimización del diseño en segundo plano (Worker, o el hilo principal si
 * no hay): estado, progreso y resultado para el panel «Optimizar».
 */
import { optimizeDesign } from "../physics/index.js";
import { startGeneratorJob } from "./generator-job";
import type { FixChange } from "./fix-text";
import type { SimulationConfig } from "./types";

export type ObjectiveId = "maxLoad" | "margin" | "height" | "length";
export type OptimizerStatus = "idle" | "running" | "done" | "error";

export interface OptimizationOptions {
  objective: ObjectiveId;
  variables: string[];
  annexRanges?: boolean;
  budget?: number;
}

export interface OptimizationProgress {
  phase: "feasibility" | "improve" | "verify";
  tested: number;
  budget: number;
  best: number | null;
}

export interface OptimizationResult {
  ok: boolean;
  objective: ObjectiveId;
  reason: string;
  tested: number;
  improved?: boolean;
  /** Se puede aplicar: tiene cambios y aprueba (mejora, o corrige un diseño que no aprobaba). */
  applicable?: boolean;
  /** El diseño no aprobaba (o aprobaba sin el margen): se partió de una corrección verificada. */
  corrected?: boolean;
  startReason?: "rejected" | "margin" | null;
  before?: number;
  start?: number;
  after?: number;
  improvement?: number;
  config?: SimulationConfig;
  changes?: FixChange[];
  limiting?: { text: string };
  verified?: boolean;
}

export class OptimizerJob {
  status = $state<OptimizerStatus>("idle");
  progress = $state.raw<OptimizationProgress | null>(null);
  result = $state.raw<OptimizationResult | null>(null);
  error = $state("");

  #stop: (() => void) | null = null;

  start(config: SimulationConfig, options: OptimizationOptions): void {
    this.stop();
    this.status = "running";
    this.progress = null;
    this.result = null;
    this.error = "";

    // Copia plana: el Worker no recibe proxies de Svelte.
    const plain = JSON.parse(JSON.stringify(config)) as SimulationConfig;
    const settings = { ...options, variables: [...options.variables] };

    this.#stop = startGeneratorJob<OptimizationProgress, OptimizationResult>({
      createWorker: () => new Worker(new URL("../ui/optimization.worker.js", import.meta.url), { type: "module" }),
      message: { config: plain, options: settings },
      createGenerator: () => optimizeDesign(plain, settings) as Generator<OptimizationProgress, OptimizationResult>,
      onProgress: progress => {
        this.progress = progress;
      },
      onDone: result => {
        this.#stop = null;
        this.result = result;
        this.status = "done";
      },
      onError: message => {
        this.#stop = null;
        this.error = message;
        this.status = "error";
      }
    });
  }

  stop(): void {
    this.#stop?.();
    this.#stop = null;
    if (this.status === "running") this.status = "idle";
  }

  /** Olvida el resultado (el diseño cambió o se descartó). */
  reset(): void {
    this.stop();
    this.status = "idle";
    this.progress = null;
    this.result = null;
    this.error = "";
  }
}
