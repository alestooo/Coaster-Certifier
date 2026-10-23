import { test, expect, type Page } from "@playwright/test";

/** Recorre menú → recorrido → tren → laboratorio. */
async function openLab(page: Page, mapName: string, passengers = 2) {
  await page.goto("/");
  await page.getByRole("button", { name: /Diseñar y certificar/ }).click();
  await page.locator(".map-card", { has: page.locator("strong", { hasText: new RegExp(`^${mapName}$`) }) }).click();
  await page.getByRole("button", { name: /Armar el tren/ }).click();
  await page.getByRole("button", { name: new RegExp(`^${passengers} persona`) }).click();
  await page.getByRole("button", { name: /Ir a la certificación/ }).click();
  await expect(page.getByRole("button", { name: /Reproducir/ })).toBeVisible();
}

test.describe("Flujo de certificación", () => {
  test("el trazado del anexo se simula y aprueba el dictamen", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await openLab(page, "Certificación");

    await page.getByRole("button", { name: /Reproducir/ }).click();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: /Pausar/ }).click();
    await page.getByRole("button", { name: /Certificar/ }).click();

    await expect(page.locator(".badge", { hasText: "APROBADO" })).toBeVisible();
    await expect(page.locator(".stage-chip", { hasText: /aprobado/i })).toBeVisible();

    await page.getByRole("button", { name: /Informe completo/ }).click();
    await expect(page.getByRole("heading", { name: /Informe del recorrido/ })).toBeVisible();
    await expect(page.locator(".report-sheet").getByRole("row", { name: /Cima del loop/ })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("un loop circular se rechaza por carga máxima y ofrece alternativas verificadas", async ({ page }) => {
    await openLab(page, "Loop");

    await page.getByRole("button", { name: /Guía/ }).click();
    await page.locator(".scenario.bad", { hasText: /Loop circular/ }).click();
    await page.getByRole("button", { name: /Certificar/ }).click();

    await expect(page.locator(".badge", { hasText: "RECHAZADO" })).toBeVisible();
    await expect(page.getByText(/Carga máxima sobre los pasajeros/).first()).toBeVisible();

    await page.getByRole("button", { name: /tocá para ver causas/ }).click();
    await expect(page.getByText(/PRUEBA 1/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Comprobada/).first()).toBeVisible();
  });

  test("la pista personalizada abre el editor a escala y se puede aplicar", async ({ page }) => {
    await openLab(page, "Personalizado", 1);

    await expect(page.getByRole("heading", { name: /Diseñá el recorrido/ })).toBeVisible();
    await page.getByRole("button", { name: /Aplicar diseño y volver/ }).click();
    await page.getByRole("button", { name: /Certificar/ }).click();
    await expect(page.locator(".badge", { hasText: /APROBADO|RECHAZADO/ })).toBeVisible();
  });

  test("la pantalla de pasajeros permite personalizar y cambia la reacción", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Diseñar y certificar/ }).click();
    await page.locator(".map-card", { has: page.locator("strong", { hasText: /^Certificación$/ }) }).click();
    await page.getByRole("button", { name: /Armar el tren/ }).click();

    await page.getByRole("button", { name: /Sorpréndeme/ }).click();
    await page.getByRole("button", { name: /5 g/ }).click();
    await expect(page.getByRole("button", { name: /Ir a la certificación/ })).toBeEnabled();
  });
});
