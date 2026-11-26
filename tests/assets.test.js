import { describe, test, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

/** Lo que descarga el menú: imágenes, video y favicons enlazados. */
const MENU_IMAGE_BUDGET_BYTES = 300 * 1024;
/** Ningún recurso del menú debería acercarse al peso del logo PNG original (2 MB). */
const SINGLE_ASSET_LIMIT_BYTES = 150 * 1024;

const ROOT = resolve(import.meta.dirname, "..");
/** Archivos que deciden qué baja la portada. */
const MENU_SOURCES = ["index.html", "src/screens/Menu.svelte", "src/app.css"];
/** Rutas públicas a imágenes, video o íconos dentro de src/href/poster/url(). */
const ASSET_PATH = /["'(](\/(?:assets\/[^"')\s]+|favicon[^"')\s]*))["')]/g;

function menuAssets() {
  const paths = new Set();

  for (const source of MENU_SOURCES) {
    const text = readFileSync(resolve(ROOT, source), "utf8");
    for (const match of text.matchAll(ASSET_PATH)) paths.add(match[1]);
  }

  return [...paths].map(path => ({ path, bytes: statSync(resolve(ROOT, "public", `.${path}`)).size }));
}

describe("Recursos del menú", () => {
  test("lo que descarga el menú pesa menos de 300 KB", () => {
    const assets = menuAssets();
    const total = assets.reduce((sum, asset) => sum + asset.bytes, 0);

    expect(assets.length).toBeGreaterThan(0);
    expect(total, JSON.stringify(assets)).toBeLessThan(MENU_IMAGE_BUDGET_BYTES);
  });

  test("el menú no usa GIF ni imágenes de más de 150 KB", () => {
    const assets = menuAssets();

    expect(assets.filter(asset => asset.path.endsWith(".gif"))).toEqual([]);
    expect(assets.filter(asset => asset.bytes > SINGLE_ASSET_LIMIT_BYTES)).toEqual([]);
  });
});
