import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  // El CSS de cada componente viaja dentro de su JS: si una pieza diferida se
  // reintenta con otra URL, llega con sus estilos (un CSS aparte que falló no se vuelve a pedir).
  plugins: [svelte({ emitCss: false })],
});