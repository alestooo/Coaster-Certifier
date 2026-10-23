import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de extremo a extremo con Playwright.
 *
 *   npm run e2e           → headless sobre el build de producción
 *   npm run e2e:headed    → con ventana visible (usa el Chrome instalado)
 *   npm run e2e:ui        → explorador interactivo de Playwright
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "output/playwright-report" }]],
  outputDir: "output/e2e-results",
  use: {
    baseURL: "http://localhost:4173",
    channel: "chrome",
    viewport: { width: 1500, height: 1000 },
    locale: "es-CR",
    screenshot: "on",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1500, height: 1000 } } }]
});
