/** Utilidades de descarga e impresión. Solo se usan desde la interfaz. */

export function downloadText(filename: string, text: string, mime = "text/plain"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(filename: string, value: unknown): void {
  downloadText(filename, JSON.stringify(value, null, 2), "application/json");
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const anchor = document.createElement("a");

  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

/** Nombre de archivo seguro con marca de tiempo. */
export function stampedName(base: string, extension: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${base}-${stamp}.${extension}`;
}
