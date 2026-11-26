import { runSimulation } from "../physics/index.js";
import { buildAudit, type AuditReport } from "./audit";
import { sampleHistory } from "./sampling";
import type { SimulationConfig, SimulationState, Verdict } from "./types";

export type AuditStatus = "idle" | "working" | "ready" | "error";

export interface AuditResult {
  key: string;
  config: SimulationConfig;
  verdict: Verdict;
  final: SimulationState;
  history: SimulationState[];
  report: AuditReport;
}

interface AuditRequest {
  id: number;
  key: string;
  config: SimulationConfig;
}

interface WorkerReply {
  id: number;
  ok: boolean;
  message?: string;
  verdict?: Verdict;
  final?: SimulationState;
  history?: SimulationState[];
}

/** Tiempo máximo para auditar un diseño antes de abandonar la simulación (ms). */
const AUDIT_TIMEOUT_MS = 15_000;

const TIMEOUT_MESSAGE =
  "La simulación tardó demasiado. Reducí el tiempo máximo simulado o aumentá los pasos en «Precisión numérica».";

/**
 * Auditoría en vivo: cada configuración aplicada se simula completa en
 * un Web Worker. Solo hay una simulación en curso; si llegan cambios
 * mientras tanto, se audita únicamente el último (los intermedios se
 * descartan). Sin Worker disponible, simula en el hilo principal.
 */
export class LiveAudit {
  result = $state.raw<AuditResult | null>(null);
  status = $state<AuditStatus>("idle");
  error = $state("");

  #worker: Worker | null = null;
  #inFlight: AuditRequest | null = null;
  #pending: Omit<AuditRequest, "id"> | null = null;
  #watchdog: ReturnType<typeof setTimeout> | null = null;
  #nextId = 1;

  constructor() {
    this.#worker = this.#createWorker();
  }

  /** Pide auditar una configuración ya validada. */
  request(config: SimulationConfig): void {
    const key = JSON.stringify(config);

    if (this.#inFlight) {
      // Lo que ya se está simulando no se vuelve a encolar.
      this.#pending = key === this.#inFlight.key ? null : { key, config };
      return;
    }

    if (this.result?.key === key) {
      this.status = "ready";
      this.error = "";
      return;
    }

    this.#send(key, config);
  }

  destroy(): void {
    this.#clearWatchdog();
    this.#worker?.terminate();
    this.#worker = null;
  }

  #createWorker(): Worker | null {
    try {
      const worker = new Worker(new URL("../ui/audit.worker.js", import.meta.url), { type: "module" });
      worker.onmessage = event => this.#receive(event.data as WorkerReply);
      worker.onerror = () => this.#fallBackToMainThread();
      return worker;
    } catch {
      return null;
    }
  }

  #send(key: string, config: SimulationConfig): void {
    const request: AuditRequest = { id: this.#nextId++, key, config: JSON.parse(key) };

    this.#inFlight = request;
    this.status = "working";

    if (this.#worker) {
      this.#worker.postMessage({ id: request.id, config: request.config });
      this.#watchdog = setTimeout(() => this.#abandon(request), AUDIT_TIMEOUT_MS);
    } else {
      queueMicrotask(() => this.#receive(this.#simulateHere(request)));
    }
  }

  #simulateHere(request: AuditRequest): WorkerReply {
    try {
      const run = runSimulation(request.config);
      return { id: request.id, ok: true, verdict: run.verdict, final: run.final, history: sampleHistory(run.history) };
    } catch (problem) {
      return { id: request.id, ok: false, message: problem instanceof Error ? problem.message : "No se pudo auditar el diseño." };
    }
  }

  #receive(reply: WorkerReply): void {
    const request = this.#inFlight;

    if (!request || reply.id !== request.id) return;

    this.#clearWatchdog();
    this.#inFlight = null;

    if (reply.ok && reply.verdict && reply.final && reply.history) {
      this.result = {
        key: request.key,
        config: request.config,
        verdict: reply.verdict,
        final: reply.final,
        history: reply.history,
        report: buildAudit(reply.verdict, request.config)
      };
      this.status = "ready";
      this.error = "";
    } else {
      // Nunca se muestra el dictamen de otro diseño como si fuera el actual.
      this.result = null;
      this.status = "error";
      this.error = reply.message ?? "No se pudo auditar el diseño.";
    }

    this.#sendPending();
  }

  #sendPending(): void {
    const next = this.#pending;
    this.#pending = null;

    if (next) this.#send(next.key, next.config);
  }

  /** Una simulación que no responde se descarta y el Worker se reemplaza. */
  #abandon(request: AuditRequest): void {
    if (this.#inFlight?.id !== request.id) return;

    this.#worker?.terminate();
    this.#worker = this.#createWorker();
    this.#receive({ id: request.id, ok: false, message: TIMEOUT_MESSAGE });
  }

  #clearWatchdog(): void {
    if (this.#watchdog) clearTimeout(this.#watchdog);
    this.#watchdog = null;
  }

  /** Si el Worker no carga, la auditoría sigue funcionando en el hilo principal. */
  #fallBackToMainThread(): void {
    this.#clearWatchdog();
    this.#worker?.terminate();
    this.#worker = null;

    const request = this.#inFlight;

    if (request) {
      this.#receive(this.#simulateHere(request));
    }
  }
}
