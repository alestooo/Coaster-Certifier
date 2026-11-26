import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  // Compila los módulos `.svelte.ts` (runes) que usan las pruebas de la interfaz.
  plugins: [svelte()],
  test: {
    include: ["tests/**/*.test.js"],
    environment: "node",
    // Las pruebas simulan recorridos completos: en compus lentas 5 s (el valor por defecto) no alcanza.
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/physics/**/*.js"],
      reporter: ["text", "html"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80
      }
    }
  }
});
