/**
 * Reintento de módulos cargados con `import()`.
 *
 * El navegador recuerda un `import()` que falló (p. ej. sin conexión o tras
 * un despliegue nuevo) y lo vuelve a rechazar aunque la red ya funcione.
 * Para reintentar se pide la misma URL con un parámetro distinto.
 */
const MODULE_URL = /https?:\/\/\S+?\.js\b/;

/** URL del módulo que falló con un parámetro de reintento, o null si el error no la trae. */
export function retryUrl(error: unknown, attempt: number): string | null {
  const message = error instanceof Error ? error.message : "";
  const url = MODULE_URL.exec(message)?.[0];

  return url ? `${url}?retry=${attempt}` : null;
}
