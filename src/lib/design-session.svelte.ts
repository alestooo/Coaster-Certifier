/**
 * Sesión de diseño del taller.
 *
 * Reúne el borrador editable, la validación, la simulación interactiva,
 * la auditoría en vivo y el historial de deshacer. Cada cambio pausa la
 * reproducción, se valida y se audita tras una breve espera (los arrastres
 * se agrupan); un valor inválido nunca reemplaza al último diseño válido.
 */
import { resolveConfig, buildTrack, ConfigError, DEFAULT_CONFIG } from "../physics/index.js";
import { SimulationRunner } from "./simulation-runner.svelte";
import { LiveAudit } from "./live-audit.svelte";
import { createHistory, record, undo, redo, canUndo, canRedo, type DesignHistory } from "./design-history";
import { friendlyConfigMessage } from "./field-definitions";
import { scenarioConfig, type ScenarioId } from "../game/scenarios";
import type { MapId } from "../game/maps";
import {
  CART_MASS,
  DEFAULT_PASSENGER_MASS,
  MIN_PASSENGER_MASS,
  MAX_PASSENGER_MASS,
  calculateCartCount,
  type Passenger
} from "../game/passengers";
import type { ConfigInput, SimulationConfig, Track } from "./types";

/** Espera máxima entre un cambio y su simulación (ms): agrupa los arrastres. */
export const COMMIT_THROTTLE_MS = 120;
/** Pausa tras la cual una serie de cambios cuenta como un solo paso de deshacer (ms). */
export const HISTORY_SETTLE_MS = 600;
export const CART_MASS_LIMITS = [1, 10000] as const;

/** Parámetros de forma que se reinician al cambiar de recorrido. */
const GEOMETRY_KEYS = [
  "initialHeight",
  "initialSpeed",
  "trackWidth",
  "loopHeight",
  "loopTopRadius",
  "hillHeight",
  "hillCrestRadius",
  "brakingLength",
  "customPoints"
] as const;

interface Design {
  config: SimulationConfig;
  cartMass: number;
  passengers: Passenger[];
}

function copyConfig(source: SimulationConfig): SimulationConfig {
  return { ...source, customPoints: source.customPoints.map(point => ({ ...point })) };
}

function copyPassengers(source: readonly Passenger[]): Passenger[] {
  return source.map(passenger => ({ ...passenger }));
}

function geometryDefaults(): Partial<SimulationConfig> {
  const defaults = DEFAULT_CONFIG as SimulationConfig;
  return Object.fromEntries(GEOMETRY_KEYS.map(key => [key, defaults[key]])) as Partial<SimulationConfig>;
}

export class DesignSession {
  readonly runner: SimulationRunner;
  readonly audit = new LiveAudit();

  draft = $state.raw<SimulationConfig>(resolveConfig());
  cartMass = $state(CART_MASS);
  passengers = $state.raw<Passenger[]>([]);
  errorField = $state("");
  errorMessage = $state("");

  /**
   * Borrador construido al instante (sin esperar el commit) para que la pista
   * y las manijas sigan al puntero; null si el borrador no es válido.
   */
  preview = $derived.by((): { config: SimulationConfig; track: Track } | null => {
    try {
      this.#assertMasses();
      const config = resolveConfig({ ...this.draft, mass: this.#totalMass() });
      return { config, track: buildTrack(config) };
    } catch {
      return null;
    }
  });

  #history = $state.raw<DesignHistory<Design>>(createHistory<Design>({ config: resolveConfig(), cartMass: CART_MASS, passengers: [] }));
  #lastValid: Design;
  #commitTimer: ReturnType<typeof setTimeout> | null = null;
  #historyTimer: ReturnType<typeof setTimeout> | null = null;
  /** Durante un gesto (arrastre) los cambios se acumulan en un solo paso de deshacer. */
  #inGesture = false;

  constructor(config: ConfigInput, passengers: readonly Passenger[]) {
    this.passengers = copyPassengers(passengers);
    this.runner = new SimulationRunner({ ...config, mass: this.#totalMass() });
    this.draft = copyConfig(this.runner.config);
    this.#lastValid = this.#snapshot(this.runner.config);
    this.#history = createHistory(this.#lastValid);
    this.audit.request(this.runner.config);
  }

  get masses(): number[] {
    return this.passengers.map(passenger => passenger.mass);
  }

  get cartCount(): number {
    return calculateCartCount(this.passengers);
  }

  get canUndo(): boolean {
    return canUndo(this.#history);
  }

  get canRedo(): boolean {
    return canRedo(this.#history);
  }

  /**
   * Modifica el borrador; se valida y simula tras `COMMIT_THROTTLE_MS`.
   * Con `discardInvalid` (manijas del lienzo), si otro campo quedó inválido
   * el cambio se aplica sobre el último diseño válido en lugar de bloquearse.
   */
  patch(partial: Partial<SimulationConfig>, options: { discardInvalid?: boolean } = {}): void {
    this.runner.pause();

    if (options.discardInvalid && this.errorMessage) {
      this.cartMass = this.#lastValid.cartMass;
      this.passengers = copyPassengers(this.#lastValid.passengers);
      this.draft = { ...copyConfig(this.#lastValid.config), ...partial };
    } else {
      this.draft = { ...this.draft, ...partial };
    }

    this.#scheduleCommit();
  }

  /** Empieza un gesto continuo: todo lo que cambie hasta `endGesture` es un solo paso de deshacer. */
  beginGesture(): void {
    this.#flushPending();
    this.#inGesture = true;
  }

  /** Termina el gesto: aplica lo pendiente y lo registra como un paso. */
  endGesture(): void {
    if (!this.#inGesture) return;

    this.#inGesture = false;
    if (this.#commitTimer) this.commitNow();
    if (this.#historyTimer) clearTimeout(this.#historyTimer);
    this.#historyTimer = null;
    this.#history = record(this.#history, this.#lastValid);
  }

  /** Valida el borrador ya mismo; devuelve si quedó aplicado. */
  commitNow(): boolean {
    this.#clearCommitTimer();
    return this.#commit();
  }

  /** Cambia de recorrido con su forma por defecto; conserva reglas, frenos y masas. */
  loadTemplate(mapId: MapId): void {
    this.#flushPending();
    this.runner.pause();
    this.draft = copyConfig(resolveConfig({ ...this.draft, ...geometryDefaults(), mapId }));
    this.#commitAndRecord();
  }

  /** Carga un escenario de referencia de la librería con las masas por defecto. */
  loadScenario(id: ScenarioId): void {
    this.#flushPending();
    this.runner.pause();
    this.draft = copyConfig(resolveConfig(scenarioConfig(id)));
    this.cartMass = CART_MASS;
    this.passengers = this.passengers.map(passenger => ({ ...passenger, mass: DEFAULT_PASSENGER_MASS }));
    this.#commitAndRecord();
  }

  applyRecommendation(next: SimulationConfig): void {
    this.#flushPending();
    this.runner.pause();
    this.draft = copyConfig(next);
    this.#commitAndRecord();
  }

  setCartMass(value: number): void {
    this.runner.pause();
    this.cartMass = value;
    this.#scheduleCommit();
  }

  setPassengerMass(index: number, value: number): void {
    this.runner.pause();
    this.passengers = this.passengers.map((passenger, position) => (position === index ? { ...passenger, mass: value } : passenger));
    this.#scheduleCommit();
  }

  /** Reemplaza a los pasajeros (cantidad, avatares y masas). */
  setPassengers(passengers: readonly Passenger[]): void {
    this.runner.pause();
    this.passengers = copyPassengers(passengers);
    this.#scheduleCommit();
  }

  undo(): void {
    this.#flushPending();
    if (!canUndo(this.#history)) return;
    this.#history = undo(this.#history);
    this.#restore(this.#history.present);
  }

  redo(): void {
    this.#flushPending();
    if (!canRedo(this.#history)) return;
    this.#history = redo(this.#history);
    this.#restore(this.#history.present);
  }

  destroy(): void {
    this.#clearCommitTimer();
    if (this.#historyTimer) clearTimeout(this.#historyTimer);
    this.#historyTimer = null;
    this.audit.destroy();
  }

  #snapshot(config: SimulationConfig): Design {
    return { config: copyConfig(config), cartMass: this.cartMass, passengers: copyPassengers(this.passengers) };
  }

  #totalMass(): number {
    return this.cartCount * this.cartMass + this.passengers.reduce((sum, passenger) => sum + passenger.mass, 0);
  }

  #assertMasses(): void {
    const [minCart, maxCart] = CART_MASS_LIMITS;
    const invalidCart = !Number.isFinite(this.cartMass) || this.cartMass < minCart || this.cartMass > maxCart;
    const invalidPassenger = this.passengers.some(
      ({ mass }) => !Number.isFinite(mass) || mass < MIN_PASSENGER_MASS || mass > MAX_PASSENGER_MASS
    );

    if (invalidCart || invalidPassenger) {
      throw new ConfigError(
        `Cada pasajero debe pesar entre ${MIN_PASSENGER_MASS} y ${MAX_PASSENGER_MASS} kg y cada carrito entre ${minCart} y ${maxCart} kg.`,
        "mass"
      );
    }
  }

  #commit(): boolean {
    try {
      this.#assertMasses();

      const next = resolveConfig({ ...this.draft, mass: this.#totalMass() });
      buildTrack(next);

      this.errorField = "";
      this.errorMessage = "";

      if (JSON.stringify(next) !== JSON.stringify(this.runner.config)) {
        this.runner.apply(next);
      }

      this.#lastValid = this.#snapshot(next);
      this.audit.request(next);
      this.#scheduleHistory();
      return true;
    } catch (problem) {
      this.errorField = problem instanceof ConfigError ? problem.field : "";
      this.errorMessage =
        problem instanceof ConfigError
          ? friendlyConfigMessage(problem.field, problem.message)
          : problem instanceof Error
            ? problem.message
            : "Configuración inválida.";
      return false;
    }
  }

  /** Aplica el borrador y lo registra como un paso propio de deshacer. */
  #commitAndRecord(): void {
    if (this.commitNow()) this.#flushPending();
  }

  #scheduleCommit(): void {
    if (this.#commitTimer) return;

    this.#commitTimer = setTimeout(() => {
      this.#commitTimer = null;
      this.#commit();
    }, COMMIT_THROTTLE_MS);
  }

  #clearCommitTimer(): void {
    if (this.#commitTimer) clearTimeout(this.#commitTimer);
    this.#commitTimer = null;
  }

  #scheduleHistory(): void {
    if (this.#historyTimer) clearTimeout(this.#historyTimer);
    if (this.#inGesture) {
      this.#historyTimer = null;
      return;
    }

    this.#historyTimer = setTimeout(() => {
      this.#historyTimer = null;
      this.#history = record(this.#history, this.#lastValid);
    }, HISTORY_SETTLE_MS);
  }

  /** Cierra los cambios pendientes para que deshacer actúe sobre el último paso real. */
  #flushPending(): void {
    if (this.#commitTimer) this.commitNow();

    if (this.#historyTimer) {
      clearTimeout(this.#historyTimer);
      this.#historyTimer = null;
      this.#history = record(this.#history, this.#lastValid);
    }
  }

  #restore(design: Design): void {
    this.runner.pause();
    this.draft = copyConfig(design.config);
    this.cartMass = design.cartMass;
    this.passengers = copyPassengers(design.passengers);
    this.commitNow();
  }
}
