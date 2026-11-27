/**
 * Corre un generador de simulaciones en un Web Worker y, si no hay Worker
 * (o no carga), en el hilo principal de a pedazos para no congelar la
 * interfaz. El Worker responde `{type: "progress" | "done", value}` o
 * `{type: "error", message}`.
 */

/** Tiempo máximo de trabajo por tarea en el hilo principal (ms). */
const MAIN_THREAD_SLICE_MS = 12;

export interface GeneratorJob<P, R> {
  /** Crea el Worker; puede lanzar si el entorno no lo permite. */
  createWorker: () => Worker;
  /** Mensaje que recibe el Worker. */
  message: unknown;
  /** El mismo trabajo, para el hilo principal. */
  createGenerator: () => Generator<P, R>;
  onProgress: (progress: P) => void;
  onDone: (result: R) => void;
  onError: (message: string) => void;
}

/** Arranca el trabajo; devuelve la función que lo detiene. */
export function startGeneratorJob<P, R>(job: GeneratorJob<P, R>): () => void {
  let stopped = false;
  let worker: Worker | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const message = (problem: unknown) => (problem instanceof Error ? problem.message : "No se pudo completar la búsqueda.");

  const runHere = () => {
    let generator: Generator<P, R>;
    try {
      generator = job.createGenerator();
    } catch (problem) {
      job.onError(message(problem));
      return;
    }

    const step = () => {
      if (stopped) return;
      try {
        const deadline = performance.now() + MAIN_THREAD_SLICE_MS;
        let result = generator.next();
        while (!result.done && performance.now() < deadline) {
          job.onProgress(result.value);
          result = generator.next();
        }
        if (result.done) {
          job.onDone(result.value);
          return;
        }
        job.onProgress(result.value);
        timer = setTimeout(step, 0);
      } catch (problem) {
        job.onError(message(problem));
      }
    };
    timer = setTimeout(step, 0);
  };

  try {
    worker = job.createWorker();
  } catch {
    worker = null;
  }

  if (worker) {
    worker.onmessage = event => {
      if (stopped) return;
      const data = event.data;
      if (data.type === "progress") job.onProgress(data.value);
      if (data.type === "done") {
        worker?.terminate();
        worker = null;
        job.onDone(data.value);
      }
      if (data.type === "error") {
        worker?.terminate();
        worker = null;
        job.onError(data.message);
      }
    };
    // Si el Worker no carga, el trabajo sigue en el hilo principal.
    worker.onerror = () => {
      if (stopped) return;
      worker?.terminate();
      worker = null;
      runHere();
    };
    worker.postMessage(job.message);
  } else {
    runHere();
  }

  return () => {
    stopped = true;
    worker?.terminate();
    worker = null;
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
