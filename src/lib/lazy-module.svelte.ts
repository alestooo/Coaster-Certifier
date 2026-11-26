/**
 * Un módulo que se descarga la primera vez que hace falta.
 *
 * `promise` es reactivo: la plantilla lo usa en `{#await}` y muestra el
 * componente cuando llega, o un aviso con «Reintentar» si la descarga falla.
 * Si una descarga falló (p. ej. una precarga sin red), el próximo `load()`
 * vuelve a intentar en lugar de repetir el error.
 */
import { retryUrl } from "./retry-import";

type Importer<T> = (url: string) => Promise<T>;

const importByUrl = <T>(url: string): Promise<T> => import(/* @vite-ignore */ url) as Promise<T>;

export class LazyModule<T> {
  /** null hasta el primer `load()`. */
  promise = $state<Promise<T> | null>(null);

  #loader: () => Promise<T>;
  #importUrl: Importer<T>;
  #attempts = 0;
  /** Error de la última descarga, si falló. */
  #failure: { error: unknown } | null = null;

  constructor(loader: () => Promise<T>, importUrl: Importer<T> = importByUrl) {
    this.#loader = loader;
    this.#importUrl = importUrl;
  }

  /** Empieza la descarga (una sola vez; de nuevo si la anterior falló) y devuelve su promesa. */
  load(): Promise<T> {
    if (this.#failure) this.retry(this.#failure.error);
    this.promise ??= this.#track(this.#loader());
    return this.promise;
  }

  /** Vuelve a descargar después de un fallo; el navegador recuerda el fallo, así que se cambia la URL. */
  retry(error: unknown): void {
    const url = retryUrl(error, ++this.#attempts);
    this.promise = this.#track(url ? this.#importUrl(url) : this.#loader());
  }

  /**
   * Recuerda si la descarga falla. El fallo lo muestra la plantilla (`{:catch}`);
   * este manejador además evita el aviso de «promesa sin manejar».
   */
  #track(promise: Promise<T>): Promise<T> {
    this.#failure = null;
    promise.catch(error => {
      if (this.promise === promise) this.#failure = { error };
    });
    return promise;
  }
}
