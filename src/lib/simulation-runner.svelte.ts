import {
  resolveConfig,
  buildTrack,
  createInitialState,
  step,
  evaluateRun
} from "../physics/index.js";

import type { ConfigInput, SimulationConfig, SimulationState, Track, Verdict } from "./types";

/** Intervalo entre muestras guardadas en el historial (s). */
export const SAMPLE_INTERVAL = 0.02;

/** Tiempo real máximo consumido por cuadro para evitar saltos (s). */
const MAX_FRAME_ELAPSED = 0.05;

/** Multiplicadores de velocidad de reproducción disponibles. */
export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/**
 * Controlador de la simulación interactiva.
 *
 * Mantiene la configuración activa, el estado físico, el historial
 * muestreado y el dictamen. No contiene ecuaciones: solo orquesta las
 * llamadas a la librería de física.
 */
export class SimulationRunner {
  config = $state.raw<SimulationConfig>(resolveConfig());
  track = $state.raw<Track>(buildTrack(this.config));
  state = $state.raw<SimulationState>(createInitialState(this.config));
  history = $state.raw<SimulationState[]>([this.state]);

  running = $state(false);
  playbackSpeed = $state<PlaybackSpeed>(1);
  scrubIndex = $state<number | null>(null);

  #accumulator = 0;
  #lastSample = 0;
  #pending: SimulationState[] = [];

  constructor(input: ConfigInput = {}) {
    this.apply(input);
  }

  /** Estado que se muestra: el actual o el seleccionado en la línea de tiempo. */
  get viewState(): SimulationState {
    if (this.scrubIndex !== null && this.history[this.scrubIndex]) {
      return this.history[this.scrubIndex];
    }

    return this.state;
  }

  get isFinished(): boolean {
    return this.state.status !== "running";
  }

  get canStart(): boolean {
    return !this.running && !this.isFinished;
  }

  /** Dictamen del recorrido observado hasta ahora (solo cuando está detenido). */
  verdict: Verdict | null = $derived.by(() => {
    if (this.running) return null;

    try {
      return evaluateRun(this.history, this.config);
    } catch {
      return null;
    }
  });

  /** Valida y activa una configuración nueva, reiniciando el recorrido. */
  apply(input: ConfigInput): SimulationConfig {
    const config = resolveConfig(input);
    const track = buildTrack(config);
    const initial = createInitialState(config);

    this.running = false;
    this.config = config;
    this.track = track;
    this.state = initial;
    this.history = [initial];
    this.#resetClock();

    return config;
  }

  reset(): void {
    this.running = false;
    this.state = createInitialState(this.config);
    this.history = [this.state];
    this.#resetClock();
  }

  start(): void {
    if (!this.canStart) return;

    this.scrubIndex = null;
    this.running = true;
  }

  pause(): void {
    this.running = false;
    this.#flush();
  }

  toggle(): void {
    if (this.running) {
      this.pause();
    } else {
      this.start();
    }
  }

  /** Avanza un único paso de reporte (para inspección paso a paso). */
  stepOnce(): void {
    if (this.isFinished) return;

    this.pause();
    this.#advance(this.config.timeStep);
    this.#flush();
  }

  /** Ejecuta el recorrido completo de inmediato, sin animación. */
  runToEnd(): void {
    this.pause();

    const maxSteps = Math.ceil(this.config.maxTime / this.config.timeStep) + 2;

    for (let index = 0; index < maxSteps && !this.isFinished; index++) {
      this.#advance(this.config.timeStep);
    }

    this.#flush();
  }

  /** Avanza la simulación según el tiempo real transcurrido (s). */
  tick(elapsedSeconds: number): void {
    if (!this.running) return;

    this.#accumulator += Math.min(elapsedSeconds, MAX_FRAME_ELAPSED) * this.playbackSpeed;

    const { timeStep } = this.config;

    while (this.#accumulator >= timeStep) {
      this.#advance(timeStep);
      this.#accumulator -= timeStep;

      if (this.isFinished) {
        this.running = false;
        this.#accumulator = 0;
        break;
      }
    }

    this.#flush();
  }

  /** Selecciona un instante del historial para inspeccionarlo. */
  scrubTo(index: number | null): void {
    if (index === null) {
      this.scrubIndex = null;
      return;
    }

    this.pause();
    this.scrubIndex = Math.max(0, Math.min(this.history.length - 1, Math.round(index)));
  }

  #advance(dt: number): void {
    const next = step(this.state, this.config, dt);

    this.state = next;

    if (next.time - this.#lastSample >= SAMPLE_INTERVAL - 1e-9 || next.status !== "running") {
      this.#pending.push(next);
      this.#lastSample = next.time;
    }
  }

  #flush(): void {
    if (!this.#pending.length) return;

    this.history = [...this.history, ...this.#pending];
    this.#pending = [];
  }

  #resetClock(): void {
    this.#accumulator = 0;
    this.#lastSample = 0;
    this.#pending = [];
    this.scrubIndex = null;
  }
}
