import { test, expect, type Page, type Locator } from "@playwright/test";

/** Entra al taller desde el menú y espera el primer dictamen. */
async function openWorkshop(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Diseñar y certificar/ }).click();
  await expect(verdict(page)).toContainText(/Aprobado|Rechazado/, { timeout: 15_000 });
}

const verdict = (page: Page) => page.locator(".bar .verdict");
const handle = (page: Page, name: RegExp) => page.getByRole("slider", { name });
const brakeEnd = (page: Page) => handle(page, /Fin de la zona de frenado/);
const brakeEntry = (page: Page) => handle(page, /Inicio de la zona de frenado/);

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Elemento sin caja");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Arrastra la manija F hasta quedar a `gap` px de E. */
async function dragBrakeEndTowardsEntry(page: Page, gap = 14) {
  const from = await center(brakeEnd(page));
  const to = await center(brakeEntry(page));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x + gap, from.y, { steps: 12 });
  await page.mouse.up();
}

/** Clic sobre la vía, a mitad de la zona de frenado. */
async function selectBraking(page: Page) {
  const e = await center(brakeEntry(page));
  const f = await center(brakeEnd(page));
  await page.mouse.click((e.x + f.x) / 2, e.y);
  await expect(page.getByRole("complementary", { name: "Frenado" })).toBeVisible();
}

async function chooseInPicker(page: Page, name: RegExp) {
  await page.getByRole("button", { name: /Trazado del anexo|Loop|Bajada simple|Valle|Plano|Personalizado/ }).first().click();
  await page.getByRole("dialog", { name: "Trazados y escenarios" }).getByRole("button", { name }).click();
}

test.describe("Taller de diseño", () => {
  test("el taller abre directo con el anexo, se reproduce y aprueba", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await openWorkshop(page);
    await expect(verdict(page)).toContainText("Aprobado");
    await expect(page.getByRole("button", { name: /Trazado del anexo/ })).toBeVisible();

    // La reproducción avanza el tiempo y luego se completa al instante.
    const time = page.locator(".pill .time");
    await page.getByRole("button", { name: "Reproducir" }).click();
    await expect(time).not.toHaveText("t = 0,0 s", { timeout: 5_000 });
    await page.getByRole("button", { name: "Pausar" }).click();
    await page.getByRole("button", { name: "Saltar al final" }).click();

    await verdict(page).click();
    const panel = page.getByRole("complementary", { name: "Dictamen" });
    await expect(panel.locator(".badge", { hasText: "APROBADO" })).toBeVisible();
    await panel.getByRole("button", { name: "Ver informe de certificación" }).click();
    await expect(page.getByRole("heading", { name: /Informe de certificación/ })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("arrastrar F a la izquierda rechaza por frenado y un Ctrl+Z lo recupera", async ({ page }) => {
    await openWorkshop(page);

    await dragBrakeEndTowardsEntry(page);

    await expect(verdict(page)).toContainText(/Rechazado: no se detiene a tiempo/);
    await expect(page.getByRole("complementary", { name: "Frenado" })).toContainText(/necesita \d+ m/);

    await page.keyboard.press("Control+z");
    await expect(verdict(page)).toContainText("Aprobado");
    await expect(brakeEnd(page)).toHaveAttribute("aria-valuenow", "60");
  });

  test("con el panel abierto, arrastrar F sigue sobre la vía y rechaza", async ({ page }) => {
    await openWorkshop(page);
    await page.getByRole("button", { name: /Reglas/ }).click();
    await expect(page.getByRole("complementary", { name: "Reglas y precisión" })).toBeVisible();

    const stage = await page.locator(".stage").boundingBox();
    const f = await center(brakeEnd(page));
    expect(stage && f.x < stage.x + stage.width).toBe(true);

    await dragBrakeEndTowardsEntry(page);
    await expect(verdict(page)).toContainText(/Rechazado/);
  });

  test("las flechas sobre la cima del loop suben h_L de a 0,5 m", async ({ page }) => {
    await openWorkshop(page);
    const top = handle(page, /Cima del loop/);

    await top.focus();
    for (let index = 0; index < 4; index++) await page.keyboard.press("ArrowUp");

    await expect(top).toHaveAttribute("aria-valuenow", "23.5");
    await expect(top).toHaveAttribute("aria-valuetext", "Altura del loop: 23,5 m");
  });

  test("un valor escrito fuera de rango muestra el error y mantiene el último diseño válido", async ({ page }) => {
    await openWorkshop(page);
    await selectBraking(page);

    const length = page.locator("#field-brakingLength");
    await length.fill("500");
    await length.press("Enter");

    await expect(page.getByRole("complementary", { name: "Frenado" }).getByRole("alert")).toHaveText(
      /Largo de frenado: debe estar entre 1 y 150 m/
    );
    await expect(verdict(page)).toContainText(/valor inválido/i);
    await expect(brakeEnd(page)).toHaveAttribute("aria-valuenow", "60");
  });

  test("pointercancel a mitad del arrastre deja un diseño válido", async ({ page }) => {
    await openWorkshop(page);
    const f = brakeEnd(page);
    const from = await center(f);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 40, from.y, { steps: 4 });
    await f.dispatchEvent("pointercancel", { pointerId: 1, bubbles: true });
    await page.mouse.up();

    await expect(f).not.toHaveClass(/active/);
    await expect(verdict(page)).toContainText(/Aprobado|Rechazado/);
    await expect(verdict(page)).not.toContainText(/inválido/i);
    const value = Number(await f.getAttribute("aria-valuenow"));
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThan(80);
  });

  test("rehacer hasta un recorrido sin la colina elegida suelta la selección", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /^Bajada simple ¿/);
    await page.keyboard.press("Control+z");
    const crest = page.getByRole("button", { name: /^Cresta de la colina/ });
    await expect(crest).toBeVisible();

    // Clic en la vía junto a D (no sobre su manija): elige la colina.
    const at = await center(crest);
    await page.mouse.click(at.x + 30, at.y + 1);
    await expect(page.getByRole("complementary", { name: "Colina" })).toBeVisible();

    // Rehacer «Bajada simple»: la colina ya no existe; ni su panel ni su barra quedan abiertos.
    await page.keyboard.press("Control+Shift+z");
    await expect(page.getByRole("complementary", { name: "Colina" })).toHaveCount(0);
    await expect(page.getByRole("toolbar", { name: /^Colina/ })).toHaveCount(0);
  });

  test("soltar una manija no cambia el encuadre si el trazado sigue entrando", async ({ page }) => {
    await openWorkshop(page);
    // Con E elegido el panel queda abierto: el lienzo no cambia de ancho durante la medición.
    const e = brakeEntry(page);
    await e.click();
    await expect(page.getByRole("complementary", { name: "Recta final" })).toBeVisible();
    await page.waitForTimeout(700);

    const a = page.getByRole("slider", { name: /Cima de la subida A/ });
    const b = page.getByRole("button", { name: /^Punto 2:/ });
    const beforeA = await center(a);
    const beforeB = await center(b);

    // E 20 m a la izquierda: el trazado se achica, pero sigue entrando en la vista.
    const from = await center(e);
    const pxPerMeter = (from.x - beforeB.x) / (328 - 80);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 20 * pxPerMeter, from.y, { steps: 8 });
    await page.mouse.up();
    await expect(e).toHaveAttribute("aria-valuetext", /308,0 m/);
    await page.waitForTimeout(700);

    // Misma escala (distancia A–B) y misma posición de A en pantalla.
    const afterA = await center(a);
    const afterB = await center(b);
    expect(Math.abs(afterA.x - beforeA.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterA.y - beforeA.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterB.x - afterA.x - (beforeB.x - beforeA.x))).toBeLessThanOrEqual(1);
  });

  test("arrastrar E a la izquierda solo acorta la recta final: el loop, la colina y A no se mueven y F se corre con E", async ({ page }) => {
    await openWorkshop(page);
    const e = brakeEntry(page);
    await e.click();
    await expect(page.getByRole("complementary", { name: "Recta final" })).toBeVisible();
    await page.waitForTimeout(700);

    const fixed = {
      A: page.getByRole("slider", { name: /Cima de la subida A/ }),
      C: handle(page, /Cima del loop/),
      D: page.getByRole("button", { name: /^Cresta de la colina/ })
    };
    const before = Object.fromEntries(await Promise.all(Object.entries(fixed).map(async ([name, locator]) => [name, await center(locator)])));
    const eBefore = await center(e);
    const fBefore = await center(brakeEnd(page));

    await page.mouse.move(eBefore.x, eBefore.y);
    await page.mouse.down();
    await page.mouse.move(eBefore.x - 60, eBefore.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(700);

    for (const [name, locator] of Object.entries(fixed)) {
      const after = await center(locator);
      expect(Math.abs(after.x - before[name].x), name).toBeLessThanOrEqual(1);
      expect(Math.abs(after.y - before[name].y), name).toBeLessThanOrEqual(1);
    }
    const eShift = (await center(e)).x - eBefore.x;
    const fShift = (await center(brakeEnd(page))).x - fBefore.x;
    expect(eShift).toBeLessThan(-30);
    expect(Math.abs(fShift - eShift)).toBeLessThanOrEqual(1);
  });

  test("arrastrar E más allá del borde derecho reencuadra al soltar: A y F quedan a la vista", async ({ page }) => {
    await openWorkshop(page);
    const e = brakeEntry(page);
    const from = await center(e);
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("Sin viewport");

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(viewport.width - 4, from.y, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByRole("complementary", { name: "Recta final" })).toBeVisible();
    await page.waitForTimeout(900);

    const stage = await page.locator(".stage canvas").boundingBox();
    if (!stage) throw new Error("Lienzo sin caja");
    const a = await center(page.getByRole("slider", { name: /Cima de la subida A/ }));
    const f = await center(brakeEnd(page));
    expect(a.x).toBeGreaterThan(stage.x);
    expect(f.x).toBeLessThan(stage.x + stage.width);
  });

  test("cambiar de recorrido con una parte encuadrada llega al encuadre nuevo sin un salto final", async ({ page }) => {
    await openWorkshop(page);
    // Las áreas (salida y frenado) se encuadran con zoom; los elementos no.
    await selectBraking(page);
    await page.waitForTimeout(600);

    // Posición de F en cada cuadro mientras la cámara vuelve al encuadre.
    await page.evaluate(() => {
      const samples: number[] = [];
      (window as unknown as { samples: number[] }).samples = samples;
      const record = () => {
        const f = document.querySelector('[aria-label^="Fin de la zona de frenado"]');
        if (f) samples.push(f.getBoundingClientRect().x);
        if (samples.length < 120) requestAnimationFrame(record);
      };
      requestAnimationFrame(record);
    });
    // El loop circular encuadra distinto que el anexo: un destino calculado con la pista vieja saltaba ~180 px al final.
    await chooseInPicker(page, /Loop circular/);
    await page.waitForTimeout(2000);

    const samples = await page.evaluate(() => (window as unknown as { samples: number[] }).samples);
    const moves = samples.slice(1).map((x, index) => Math.abs(x - samples[index])).filter(move => move > 0.5);
    // Con una animación que frena, el último movimiento es chico; un salto al final no.
    expect(moves.at(-1) ?? 0).toBeLessThan(8);
  });

  test("en un teléfono bajo, la parte elegida se encuadra por encima de la hoja del panel", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openWorkshop(page);

    // Tocar la vía entre E y F elige el frenado y lo encuadra; la hoja ocupa hasta el 60 % del alto.
    const e = await center(brakeEntry(page));
    const f = await center(brakeEnd(page));
    await page.mouse.click((e.x + f.x) / 2, e.y);
    const sheet = page.getByRole("complementary", { name: "Frenado" });
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(900);

    const top = (await sheet.boundingBox())?.y ?? 0;
    expect((await center(brakeEntry(page))).y).toBeLessThan(top);
    expect((await center(brakeEnd(page))).y).toBeLessThan(top);
  });

  test("pasar de un loop seleccionado a «Bajada simple» cierra el panel y quita las manijas del loop", async ({ page }) => {
    await openWorkshop(page);

    await handle(page, /Cima del loop/).click();
    await expect(page.getByRole("complementary", { name: "Loop" })).toBeVisible();

    await chooseInPicker(page, /^Bajada simple ¿/);

    await expect(page.getByRole("complementary", { name: "Loop" })).toHaveCount(0);
    await expect(handle(page, /Cima del loop/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Bajada simple/ })).toBeVisible();
  });

  test("el loop circular muestra un pin; su popover ofrece correcciones verificadas, «Mostrar en la pista» previsualiza y «Aplicar» aprueba", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /Loop circular/);
    await expect(verdict(page)).toContainText(/Rechazado: fuerza g demasiado alta/);

    // Desde el dictamen se llega al mismo pin.
    await verdict(page).click();
    await page.getByRole("complementary", { name: "Dictamen" }).getByRole("list", { name: "Incumplimientos" }).getByRole("button").first().click();
    const popover = page.getByRole("dialog", { name: /Problema: Fuerza g demasiado alta/ });
    await expect(popover).toBeVisible();
    await popover.getByRole("button", { name: "Cerrar problema" }).click();
    await expect(popover).toHaveCount(0);

    // Y directamente desde el pin sobre la vía.
    await page.getByRole("button", { name: /^Problema: Fuerza g demasiado alta/ }).click();
    const see = popover.getByRole("button", { name: "Mostrar en la pista" }).first();
    await expect(see).toBeVisible({ timeout: 30_000 });

    await see.click();
    await expect(see).toHaveAttribute("aria-pressed", "true");

    await popover.getByRole("button", { name: "Aplicar" }).first().click();
    await expect(verdict(page)).toContainText("Aprobado");
    await expect(popover).toHaveCount(0);

    await page.keyboard.press("Control+z");
    await expect(verdict(page)).toContainText(/Rechazado/);
  });

  test("todo el popover de correcciones se puede alcanzar, aun con «Por qué pasa» abierto", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkshop(page);
    await chooseInPicker(page, /Loop sin energía/);
    await page.getByRole("button", { name: /^Problema:/ }).first().click();

    const popover = page.getByRole("dialog", { name: /^Problema:/ });
    await expect(popover.getByRole("button", { name: "Aplicar" }).first()).toBeVisible({ timeout: 30_000 });
    await popover.getByText("Por qué pasa").click();

    // El lienzo recorta (overflow: hidden) y el usuario no puede desplazarlo: el popover debe caber
    // entero dentro de él; si su contenido es más alto, se desplaza por dentro.
    const box = await popover.boundingBox();
    const stage = await page.locator(".stage").boundingBox();
    expect(box && stage && box.y + box.height <= stage.y + stage.height + 1).toBe(true);
    expect(await page.locator(".stage").evaluate(element => element.scrollTop)).toBe(0);
  });

  test("Esc cierra primero el popover (aunque haya un panel abierto) y devuelve el foco al pin", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /Loop circular/);
    await page.getByRole("button", { name: /Reglas/ }).click();

    const pin = page.getByRole("button", { name: /^Problema:/ }).first();
    await pin.click();
    const popover = page.getByRole("dialog", { name: /^Problema:/ });
    await expect(popover).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Reglas y precisión" })).toBeVisible();
    await expect(pin).toBeFocused();
  });

  test("en el teléfono, ver dónde falla desde el dictamen cierra la hoja y muestra el popover", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkshop(page);
    await chooseInPicker(page, /Loop circular/);

    await verdict(page).click();
    await page.getByRole("complementary", { name: "Dictamen" }).getByRole("list", { name: "Incumplimientos" }).getByRole("button").first().click();

    await expect(page.getByRole("complementary", { name: "Dictamen" })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: /^Problema:/ })).toBeInViewport();
  });

  test("cambiar la masa de un pasajero cierra el popover y su vista previa", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /Loop circular/);
    await page.getByRole("button", { name: /2 pasajeros, \d+ kg/ }).click();
    await page.getByRole("button", { name: /^Problema:/ }).first().click();
    const popover = page.getByRole("dialog", { name: /^Problema:/ });
    await expect(popover).toBeVisible();

    const ana = page.getByRole("complementary", { name: "Tren y pasajeros" }).getByLabel("Masa de Ana");
    await ana.fill("90");
    await ana.press("Enter");

    // El popover no debe volver cuando llega el dictamen del diseño nuevo.
    await expect(page.getByRole("button", { name: /2 pasajeros, \d+ kg/ })).toContainText("590");
    await page.waitForTimeout(1500);
    await expect(popover).toHaveCount(0);
  });

  test("la lectura de la sonda entra completa cerca del borde derecho", async ({ page }) => {
    await openWorkshop(page);
    const f = await center(brakeEnd(page));

    await page.mouse.move(f.x - 30, f.y - 1);

    const card = page.locator(".probe .card");
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    const stage = await page.locator(".stage").boundingBox();
    expect(box && stage && box.x + box.width <= stage.x + stage.width).toBe(true);
  });

  test("un problema abierto durante la reproducción sigue abierto cuando la reproducción termina", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /Loop circular/);
    await expect(verdict(page)).toContainText(/Rechazado/);

    await page.getByRole("button", { name: "Reproducir" }).click();
    await verdict(page).click();
    await page.getByRole("complementary", { name: "Dictamen" }).getByRole("list", { name: "Incumplimientos" }).getByRole("button").first().click();
    const popover = page.getByRole("dialog", { name: /Problema:/ });
    await expect(popover).toBeVisible();

    // El loop circular se detiene en el loop: la reproducción termina sola en pocos segundos.
    await expect(page.getByRole("button", { name: "Reproducir" })).toBeVisible({ timeout: 20_000 });
    await expect(popover).toBeVisible();
  });

  test("deshacer con el teclado quita la lectura de la pista vieja", async ({ page }) => {
    await openWorkshop(page);
    await dragBrakeEndTowardsEntry(page);
    await expect(verdict(page)).toContainText("Rechazado");

    const e = await center(brakeEntry(page));
    await page.mouse.move(e.x - 60, e.y - 1);
    await expect(page.locator(".probe")).toHaveCount(1);

    await page.keyboard.press("Control+z");
    await expect(verdict(page)).toContainText("Aprobado");
    await expect(page.locator(".probe")).toHaveCount(0);
  });

  test("pasar el cursor por la vía muestra v, g y N en ese punto", async ({ page }) => {
    await openWorkshop(page);
    const e = await center(brakeEntry(page));

    await page.mouse.move(e.x - 60, e.y - 1);

    const probe = page.locator(".probe .card");
    await expect(probe).toContainText("Recta");
    await expect(probe).toContainText(/v = \d+,\d m\/s · \d+,\d\d g · N = \d+,\d kN/);
  });

  test("en pantallas medianas la leyenda se reduce al botón con un punto de color", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await openWorkshop(page);

    await expect(page.getByRole("list", { name: "Colores de la franja de fuerza g" })).toBeHidden();
    await expect(page.locator(".legend .swatch")).toBeVisible();
  });

  test("la leyenda oculta y muestra la franja de fuerza g", async ({ page }) => {
    await openWorkshop(page);
    const toggle = page.getByRole("button", { name: "Fuerza g", exact: true });
    const colors = page.getByRole("list", { name: "Colores de la franja de fuerza g" });

    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(colors).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(colors).toHaveCount(0);
  });

  test("el panel de pasajeros cambia la cantidad, el peinado y la masa sin salir del taller", async ({ page }) => {
    await openWorkshop(page);
    await dragBrakeEndTowardsEntry(page, 60);
    const designed = await brakeEnd(page).getAttribute("aria-valuenow");

    await page.getByRole("button", { name: /2 pasajeros, 582 kg/ }).click();
    const panel = page.getByRole("complementary", { name: "Tren y pasajeros" });

    // Tres pasajeros: dos carritos (2 × 425 kg) más 75 + 82 + 64 kg.
    await panel.getByRole("radio", { name: "3 pasajeros" }).click();
    await expect(page.getByRole("button", { name: /3 pasajeros, 1\s?071 kg/ })).toBeVisible();

    await panel.getByRole("button", { name: /^Luis/ }).click();
    await panel.getByRole("tab", { name: "Cabello" }).click();
    const long = panel.getByRole("button", { name: "Largo" });
    await long.click();
    await expect(long).toHaveAttribute("aria-pressed", "true");

    const mass = panel.getByLabel("Masa de Luis");
    await mass.fill("90");
    await mass.press("Enter");
    await expect(page.getByRole("button", { name: /3 pasajeros, 1\s?079 kg/ })).toBeVisible();

    // Todo pasó dentro del panel: no hay otra pantalla y el diseño sigue igual.
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(brakeEnd(page)).toHaveAttribute("aria-valuenow", designed ?? "");
  });

  test("en el trazado del anexo, el punto del loop se arrastra en 2D, se vuelve a auditar y un Ctrl+Z lo deshace", async ({ page }) => {
    await openWorkshop(page);
    const point = page.getByRole("button", { name: /^Punto 2:/ });
    await expect(point).toHaveAccessibleName(/x 80,0 m, altura 0,0 m/);

    const from = await center(point);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 30, from.y - 25, { steps: 8 });
    await page.mouse.up();

    // Se movió en las dos direcciones a la vez.
    await expect(point).not.toHaveAccessibleName(/x 80,0 m/);
    await expect(point).not.toHaveAccessibleName(/altura 0,0 m/);
    await expect(verdict(page)).toContainText(/Aprobado|Rechazado/);

    await page.keyboard.press("Control+z");
    await expect(point).toHaveAccessibleName(/x 80,0 m, altura 0,0 m/);
  });

  test("la mini barra agrega una colina después de un punto, la borra y un Ctrl+Z la devuelve en un paso", async ({ page }) => {
    await openWorkshop(page);
    const crests = page.getByRole("button", { name: /^Cresta de la colina/ });
    await expect(crests).toHaveCount(1);

    await page.getByRole("button", { name: /^Punto 2:/ }).click();
    await page.getByRole("toolbar", { name: "Punto 2" }).getByRole("button", { name: "Agregar colina" }).click();
    await expect(crests).toHaveCount(2);

    // La colina nueva queda elegida: su barra la borra.
    await page.getByRole("toolbar", { name: /^Colina/ }).getByRole("button", { name: "Borrar colina" }).click();
    await expect(crests).toHaveCount(1);

    await page.keyboard.press("Control+z");
    await expect(crests).toHaveCount(2);
    await expect(verdict(page)).toContainText(/Aprobado|Rechazado/);
  });

  test("doble clic sobre la vía del anexo agrega un punto", async ({ page }) => {
    await openWorkshop(page);
    const points = page.getByRole("button", { name: /^Punto \d+:/ });
    await expect(points).toHaveCount(1);

    // Punto 2 está en x = 80 m y la manija E en 328 m: se hace doble clic en la recta final, cerca de 300 m.
    const point = await center(page.getByRole("button", { name: /^Punto 2:/ }));
    const e = await center(brakeEntry(page));
    const pxPerMeter = (e.x - point.x) / (328 - 80);
    await page.mouse.dblclick(e.x - 28 * pxPerMeter, e.y);

    await expect(points).toHaveCount(2);
    // Los puntos se numeran por su lugar en el trazado (A, el loop, la colina…): el nuevo es el 4.
    await expect(page.getByRole("button", { name: /^Punto 4: x (29\d|30\d)/ })).toBeVisible();
  });

  test("tocar el loop abre su panel con sliders de x, altura, h_L y R, y el slider de R sigue h_L/2", async ({ page }) => {
    await openWorkshop(page);

    // Clic sobre la vía del loop, junto a su cima (no sobre la manija).
    const top = await center(handle(page, /Cima del loop/));
    await page.mouse.click(top.x + 14, top.y + 4);
    const panel = page.getByRole("complementary", { name: "Loop" });
    await expect(panel).toBeVisible();
    for (const name of ["Posición horizontal", "Altura", "Altura del loop", "Radio en la cima"]) {
      await expect(panel.getByRole("slider", { name, exact: true })).toBeVisible();
    }

    const height = panel.getByRole("textbox", { name: "Altura del loop" });
    await height.fill("14");
    await height.press("Enter");
    await panel.getByRole("slider", { name: "Radio en la cima" }).focus();
    await page.keyboard.press("End");
    await expect(panel.getByRole("textbox", { name: "Radio en la cima" })).toHaveValue("7,00");
  });

  test("μ se edita desde el panel de la salida (A)", async ({ page }) => {
    await openWorkshop(page);

    // Clic sobre la caída inicial, entre A y el punto del loop.
    const a = await center(page.getByRole("slider", { name: /Cima de la subida A/ }));
    const b = await center(page.getByRole("button", { name: /^Punto 2:/ }));
    await page.mouse.click(a.x + (b.x - a.x) * 0.3, a.y + (b.y - a.y) * 0.3);
    const panel = page.getByRole("complementary", { name: "Salida" });
    await expect(panel).toBeVisible();

    const friction = panel.getByRole("textbox", { name: /Fricción/ });
    await friction.fill("0,02");
    await friction.press("Enter");
    await expect(friction).toHaveValue("0,020");
    await expect(panel).toContainText(/la fricción disipa \d+ %/);
  });

  test("la mini barra agrega un lanzador, su panel cambia la potencia y cada cosa se deshace en un paso", async ({ page }) => {
    await openWorkshop(page);
    const boosters = page.getByRole("button", { name: /^Lanzador 1: inicio/ });
    await expect(boosters).toHaveCount(0);

    await page.getByRole("button", { name: /^Punto 2:/ }).click();
    await page.getByRole("toolbar", { name: "Punto 2" }).getByRole("button", { name: "Agregar lanzador" }).click();
    await expect(boosters).toHaveCount(1);
    const panel = page.getByRole("complementary", { name: "Lanzador" });
    await expect(panel).toBeVisible();

    const power = panel.getByRole("textbox", { name: "Potencia" });
    await expect(power).toHaveValue("300");
    await power.fill("450");
    await power.press("Enter");
    await expect(power).toHaveValue("450");
    await expect(verdict(page)).toContainText(/Aprobado|Rechazado/);

    // Fuera del campo (dentro, Ctrl+Z deshace el texto): el primero devuelve la potencia; el segundo quita el lanzador.
    await power.press("Escape");
    await page.keyboard.press("Control+z");
    await expect(boosters).toHaveCount(1);
    await page.keyboard.press("Control+z");
    await expect(boosters).toHaveCount(0);
  });

  test("el lanzador se dibuja sobre su tramo, se recorre entero y no hay errores de consola", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await openWorkshop(page);

    await page.getByRole("button", { name: /^Punto 2:/ }).click();
    await page.getByRole("toolbar", { name: "Punto 2" }).getByRole("button", { name: "Agregar frenos de ajuste" }).click();
    await expect(page.getByRole("button", { name: /^Frenos de ajuste 1: inicio/ })).toHaveCount(1);
    await expect(verdict(page)).toContainText(/Aprobado|Rechazado/);

    // Reproducir un rato (el tren cruza la zona) y saltar al final.
    await page.getByRole("button", { name: "Reproducir" }).click();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Pausar" }).click();
    await page.getByRole("button", { name: "Saltar al final" }).click();

    expect(errors).toEqual([]);
  });

  test("la potencia de la subida en «Salida» sigue a la masa del tren", async ({ page }) => {
    await openWorkshop(page);
    const openStart = async () => {
      const a = await center(page.getByRole("slider", { name: /Cima de la subida A/ }));
      const b = await center(page.getByRole("button", { name: /^Punto 2:/ }));
      await page.mouse.click(a.x + (b.x - a.x) * 0.3, a.y + (b.y - a.y) * 0.3);
      const panel = page.getByRole("complementary", { name: "Salida" });
      await expect(panel).toBeVisible();
      return (await panel.getByRole("status").filter({ hasText: /kW/ }).textContent()) ?? "";
    };
    const before = await openStart();

    // Tres pasajeros: el tren pasa de 582 kg a 1 071 kg.
    await page.getByRole("button", { name: /2 pasajeros, 582 kg/ }).click();
    await page.getByRole("complementary", { name: "Tren y pasajeros" }).getByRole("radio", { name: "3 pasajeros" }).click();
    await expect(page.getByRole("button", { name: /3 pasajeros, 1\s?071 kg/ })).toBeVisible();
    await page.keyboard.press("Escape");

    const after = await openStart();
    expect(after).not.toBe(before);
  });

  test("la estimación muestra el ciclo y los pasajeros por hora y cambia con el tiempo en la estación", async ({ page }) => {
    await openWorkshop(page);
    await page.getByRole("button", { name: /Estimación/ }).click();
    const panel = page.getByRole("complementary", { name: "Estimación" });
    const capacity = panel.getByText(/pasajeros\/h/);
    await expect(capacity).toBeVisible();
    await expect(panel).toContainText(/kWh/);
    await expect(panel).toContainText(/Columnas/);
    const before = await capacity.textContent();

    const station = panel.getByRole("textbox", { name: "Tiempo en la estación" });
    await station.fill("120");
    await station.press("Enter");

    await expect(capacity).not.toHaveText(before ?? "");
    const value = (text: string | null) => Number((text ?? "").replace(/\D/g, ""));
    expect(value(await capacity.textContent())).toBeLessThan(value(before));
  });

  test("con tres pasajeros el tren tiene dos carros y el informe lo dice", async ({ page }) => {
    await openWorkshop(page);
    await page.getByRole("button", { name: /2 pasajeros, 582 kg/ }).click();
    await page.getByRole("complementary", { name: "Tren y pasajeros" }).getByRole("radio", { name: "3 pasajeros" }).click();
    await expect(page.getByRole("button", { name: /3 pasajeros, 1\s?071 kg/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(verdict(page)).toContainText(/Aprobado|Rechazado/);

    await verdict(page).click();
    await page.getByRole("complementary", { name: "Dictamen" }).getByRole("button", { name: "Ver informe de certificación" }).click();
    await expect(page.getByRole("dialog", { name: /Informe de certificación/ })).toContainText(/2 carros · criterios sobre el peor carro/);
  });

  test("se eligen cinco carros con dos pasajeros: los vacíos suman su masa y el informe lo dice", async ({ page }) => {
    await openWorkshop(page);
    await page.getByRole("button", { name: /2 pasajeros, 582 kg/ }).click();
    const panel = page.getByRole("complementary", { name: "Tren y pasajeros" });
    await panel.getByRole("radio", { name: "5 carros" }).click();
    // 5 × 425 kg más 75 + 82 kg.
    await expect(page.getByRole("button", { name: /2 pasajeros, 2\s?282 kg/ })).toBeVisible();
    await expect(panel).toContainText(/5 carritos/);
    await page.keyboard.press("Escape");
    await expect(verdict(page)).toContainText(/Aprobado|Rechazado/);

    await verdict(page).click();
    await page.getByRole("complementary", { name: "Dictamen" }).getByRole("button", { name: "Ver informe de certificación" }).click();
    await expect(page.getByRole("dialog", { name: /Informe de certificación/ })).toContainText(/5 carros · criterios sobre el peor carro/);
  });

  test("quitar la subida desde «Salida» deja A sin cadena y un Ctrl+Z la devuelve", async ({ page }) => {
    await openWorkshop(page);
    const a = await center(page.getByRole("slider", { name: /Cima de la subida A/ }));
    const b = await center(page.getByRole("button", { name: /^Punto 2:/ }));
    await page.mouse.click(a.x + (b.x - a.x) * 0.3, a.y + (b.y - a.y) * 0.3);
    const panel = page.getByRole("complementary", { name: "Salida" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("status").filter({ hasText: /kW/ })).toBeVisible();

    await panel.getByRole("radio", { name: "Sin subida (lanzada)" }).click();
    await expect(panel.getByRole("status").filter({ hasText: /Sin subida por cadena/ })).toBeVisible();
    await expect(verdict(page)).toContainText(/Aprobado|Rechazado/);

    // Deshacer no cierra «Salida»: la subida vuelve con su motor.
    await page.keyboard.press("Control+z");
    await expect(panel.getByRole("status").filter({ hasText: /kW/ })).toBeVisible();
  });

  test("Personalizado: arrastrar un punto sobre la pista vuelve a auditar y un Ctrl+Z lo deshace", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /^Personalizado Hasta/);

    // Se edita sobre la pista, sin abrir un editor aparte.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const point = page.getByRole("button", { name: /^Punto 3:/ });
    await expect(point).toHaveAccessibleName(/altura 7,0 m/);
    const from = await center(point);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y - 30, { steps: 6 });
    await page.mouse.up();

    await expect(point).not.toHaveAccessibleName(/altura 7,0 m/);
    await expect(verdict(page)).toContainText(/Aprobado|Rechazado/);
    await page.keyboard.press("Control+z");
    await expect(point).toHaveAccessibleName(/altura 7,0 m/);
  });

  test("Personalizado: deshacer un borrado no deja elegido otro punto en su lugar", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /^Personalizado Hasta/);
    const points = page.getByRole("button", { name: /^Punto \d+:/ });

    await page.getByRole("button", { name: /^Punto 2:/ }).click();
    await page.getByRole("button", { name: "Borrar punto" }).click();
    await expect(points).toHaveCount(2);
    await page.getByRole("button", { name: /^Punto 2:/ }).click();
    await expect(page.getByRole("toolbar", { name: "Punto 2" })).toBeVisible();

    await page.keyboard.press("Control+z");
    await expect(points).toHaveCount(3);
    await expect(page.getByRole("toolbar", { name: /^Punto/ })).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: /Punto/ })).toHaveCount(0);
  });

  test("Personalizado: un clic en el cielo suelta el punto elegido", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /^Personalizado Hasta/);
    await page.getByRole("button", { name: /^Punto 3:/ }).click();
    await expect(page.getByRole("toolbar", { name: "Punto 3" })).toBeVisible();

    const box = await page.locator(".stage canvas").boundingBox();
    if (!box) throw new Error("Lienzo sin caja");
    await page.mouse.click(box.x + box.width / 2, box.y + 60);

    await expect(page.getByRole("toolbar", { name: /^Punto/ })).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: /Punto/ })).toHaveCount(0);
  });

  test("Personalizado: un punto que no se puede agregar avisa (también en el teléfono) y el aviso se va al editar", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /^Personalizado Hasta/);

    // Punto 4 en x = 120 m, el final en 160 m y su manija E en 168 m: a 1 m del final, lejos de toda manija,
    // aparece «Está demasiado cerca de otro elemento».
    const point = await center(page.getByRole("button", { name: /^Punto 4:/ }));
    const e = await center(brakeEntry(page));
    const pxPerMeter = (e.x - point.x) / (168 - 120);
    await page.mouse.dblclick(e.x - 9 * pxPerMeter, e.y);
    const warning = page.locator(".hint.warn");
    await expect(warning).toContainText("demasiado cerca");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(warning).toBeVisible();

    await page.getByRole("button", { name: /^Punto 3:/ }).focus();
    await page.keyboard.press("ArrowUp");
    await expect(warning).toHaveCount(0);
  });

  test("Personalizado: las manijas del loop responden al teclado", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /^Personalizado Hasta/);
    await page.getByRole("button", { name: /^Punto 3:/ }).click();
    await page.getByRole("button", { name: "Agregar loop" }).click();

    const top = handle(page, /Cima del loop/);
    const radius = handle(page, /Radio en la cima del loop/);
    const height = Number(await top.getAttribute("aria-valuenow"));
    const topRadius = Number(await radius.getAttribute("aria-valuenow"));

    await top.focus();
    await page.keyboard.press("ArrowUp");
    await expect(top).toHaveAttribute("aria-valuenow", String(height + 0.5));
    await radius.focus();
    await page.keyboard.press("ArrowDown");
    await expect(radius).toHaveAttribute("aria-valuenow", String(topRadius - 0.25));
  });

  test("Personalizado: «Agregar punto» de la mini barra agrega uno a mitad de camino y lo elige", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /^Personalizado Hasta/);
    const points = page.getByRole("button", { name: /^Punto \d+:/ });

    await page.getByRole("button", { name: /^Punto 2:/ }).click();
    await page.getByRole("button", { name: "Agregar punto" }).click();

    await expect(points).toHaveCount(4);
    await expect(page.getByRole("toolbar", { name: "Punto 3" })).toBeVisible();
  });

  test("Personalizado: el panel del punto no deja valores viejos ni quita el loop con h_L = 0", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /^Personalizado Hasta/);
    await page.getByRole("button", { name: /^Punto 3:/ }).click();
    const panel = page.getByRole("complementary", { name: "Punto 3" });

    // Un valor fuera de rango se recorta y el campo muestra el recortado, no lo escrito.
    const height = panel.getByRole("textbox", { name: "Altura", exact: true });
    await height.fill("9999");
    await height.press("Enter");
    await expect(height).not.toHaveValue("9999");
    await expect(panel.getByRole("status")).toBeVisible();

    // El motivo es de ese punto: al elegir otro desaparece.
    await page.getByRole("button", { name: /^Punto 2:/ }).click();
    await expect(page.getByRole("complementary", { name: "Punto 2" }).getByRole("status")).toHaveCount(0);

    // h_L = 0 no quita el loop: para eso está «Quitar loop».
    await page.getByRole("button", { name: /^Punto 3:/ }).click();
    await page.getByRole("button", { name: "Agregar loop" }).click();
    // Con loop, el panel del punto pasa a llamarse «Loop».
    const loopHeight = page.getByRole("complementary", { name: "Loop" }).getByRole("textbox", { name: /Altura del loop/ });
    await loopHeight.fill("0");
    await loopHeight.press("Enter");
    await expect(handle(page, /Cima del loop/)).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Loop" }).getByRole("status")).toContainText("Quitar loop");
  });

  test("Personalizado: doble clic sobre la vía agrega un punto", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /^Personalizado Hasta/);
    const points = page.getByRole("button", { name: /^Punto \d+:/ });
    await expect(points).toHaveCount(3);

    const last = await center(page.getByRole("button", { name: /^Punto 4:/ }));
    const e = await center(brakeEntry(page));
    await page.mouse.dblclick((last.x + e.x) / 2, last.y);

    await expect(points).toHaveCount(4);
  });

  test("Personalizado: la mini barra agrega un loop con sus manijas y borra el punto", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /^Personalizado Hasta/);

    await page.getByRole("button", { name: /^Punto 3:/ }).click();
    await page.getByRole("button", { name: "Agregar loop" }).click();
    await expect(handle(page, /Cima del loop/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Quitar loop" })).toBeVisible();

    await page.getByRole("button", { name: "Borrar punto" }).click();
    await expect(page.getByRole("button", { name: /^Punto \d+:/ })).toHaveCount(2);
    await expect(handle(page, /Cima del loop/)).toHaveCount(0);
  });

  test("Personalizado: un doble clic humano, con pausa entre clics, agrega el punto donde se hizo", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /^Personalizado Hasta/);
    const last = await center(page.getByRole("button", { name: /^Punto 4:/ }));
    const e = await center(brakeEntry(page));
    const x = (last.x + e.x) / 2;

    await page.mouse.click(x, last.y);
    await page.waitForTimeout(120);
    await page.mouse.click(x, last.y, { clickCount: 2 });

    // Punto 4 está en x = 120 m y E en 168 m: el nuevo punto queda cerca de 144 m.
    await expect(page.getByRole("button", { name: /^Punto \d+:/ })).toHaveCount(4);
    await expect(page.getByRole("button", { name: /^Punto 5: x 14\d/ })).toBeVisible();
  });

  test("Personalizado: el motivo de un recorte no tapa la mini barra y se borra al elegir otro punto", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /^Personalizado Hasta/);
    await page.getByRole("button", { name: /^Punto 2:/ }).click();
    await page.getByRole("button", { name: "Agregar loop" }).click();

    // El punto 3 se arrastra contra el loop del punto 2: se detiene y explica por qué.
    const from = await center(page.getByRole("button", { name: /^Punto 3:/ }));
    const to = await center(page.getByRole("button", { name: /^Punto 2:/ }));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x + 4, from.y, { steps: 10 });
    await page.mouse.up();

    const reason = page.locator(".elements").getByText(/necesita más espacio/i);
    await expect(reason).toBeVisible();
    const message = await reason.boundingBox();
    for (const name of [/loop$/, "Borrar punto"]) {
      const button = await page.getByRole("toolbar", { name: /^Punto 3/ }).getByRole("button", { name }).boundingBox();
      const overlap = !!button && !!message &&
        message.x < button.x + button.width && button.x < message.x + message.width &&
        message.y < button.y + button.height && button.y < message.y + message.height;
      expect(overlap, `el motivo tapa «${name}»`).toBe(false);
    }

    await page.getByRole("button", { name: /^Punto 4:/ }).click();
    await expect(page.locator(".elements em")).toHaveCount(0);
  });

  test("Personalizado: al agregar un loop, la mini barra no tapa la manija de su cima", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /^Personalizado Hasta/);
    await page.getByRole("button", { name: /^Punto 3:/ }).click();
    await page.getByRole("button", { name: "Agregar loop" }).click();

    const top = handle(page, /Cima del loop/);
    const toolbar = page.getByRole("toolbar", { name: "Punto 3" });
    await expect(top).toBeVisible();
    await expect(toolbar).toBeVisible();
    await page.waitForTimeout(300);
    const a = await top.boundingBox();
    const b = await toolbar.boundingBox();
    if (!a || !b) throw new Error("Sin caja");
    const overlaps = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlaps, `cima ${JSON.stringify(a)} · barra ${JSON.stringify(b)}`).toBe(false);
  });

  for (const [device, width, height] of [["escritorio", 1440, 900], ["teléfono", 390, 844]] as const) {
    test(`Personalizado (${device}): con un loop recién agregado, la base, la cima y el radio se pueden tocar sin taparse`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openWorkshop(page);
      await chooseInPicker(page, /^Personalizado Hasta/);
      await page.getByRole("button", { name: /^Punto 3:/ }).click();
      await page.getByRole("button", { name: "Agregar loop" }).click();
      await expect(handle(page, /Radio en la cima del loop/)).toBeVisible();
      await page.waitForTimeout(300);

      for (const target of [page.getByRole("button", { name: /^Punto 3:/ }), handle(page, /Cima del loop/), handle(page, /Radio en la cima del loop/)]) {
        const at = await center(target);
        const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("aria-label") ?? "", at);
        expect(hit).toBe(await target.getAttribute("aria-label"));
      }
    });
  }

  test("Personalizado: en el teléfono la mini barra entra completa en el lienzo", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkshop(page);
    await chooseInPicker(page, /^Personalizado Hasta/);
    await page.getByRole("button", { name: /^Punto 2:/ }).click();

    const toolbar = await page.getByRole("toolbar", { name: /^Punto 2/ }).boundingBox();
    const stage = await page.locator(".stage").boundingBox();
    expect(toolbar && stage && toolbar.x >= stage.x && toolbar.x + toolbar.width <= stage.x + stage.width).toBe(true);
  });

  test("el informe escribe el resultado con coma decimal y sus botones usan íconos, no glifos de texto", async ({ page }) => {
    await openWorkshop(page);
    await verdict(page).click();
    await page.getByRole("button", { name: "Ver informe de certificación" }).click();
    const report = page.getByRole("dialog", { name: /Informe de certificación/ });
    await expect(report).toBeVisible();

    const result = report.locator("section").filter({ hasText: "1. Resultado" }).locator("ul");
    await expect(result).toContainText("quedó detenido a");
    expect(await result.textContent()).not.toMatch(/\d\.\d/);

    for (const name of [/Imprimir o guardar PDF/]) {
      const button = report.getByRole("button", { name });
      await expect(button.locator("svg")).toHaveCount(1);
      expect(await button.textContent()).not.toMatch(/[⤓🖨✕]/u);
    }
  });

  test("en el teléfono la guía se abre desde el selector de recorridos", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkshop(page);
    await expect(page.getByRole("button", { name: "Guía", exact: true })).toBeHidden();

    await page.getByRole("button", { name: /Trazado del anexo/ }).first().click();
    await page.getByRole("dialog", { name: "Trazados y escenarios" }).getByRole("button", { name: /guía/i }).click();

    await expect(page.getByRole("dialog", { name: "Guía" })).toBeVisible();
  });

  test("una masa vacía no deja «NaN kg» y una fuera de rango queda marcada en su campo", async ({ page }) => {
    await openWorkshop(page);
    await page.getByRole("button", { name: /Tren y pasajeros/ }).click();
    const panel = page.getByRole("complementary", { name: "Tren y pasajeros" });
    const mass = panel.getByRole("textbox", { name: "Masa de Ana" });
    await expect(mass).toBeVisible();
    const before = await mass.inputValue();

    await mass.fill("");
    await mass.press("Enter");
    await expect(panel.getByRole("group", { name: "Pasajeros", exact: true })).not.toContainText("NaN");
    await expect(mass).toHaveValue(before);

    await mass.fill("500");
    await mass.press("Enter");
    await expect(mass).toHaveAttribute("aria-invalid", "true");
    // El mensaje llega con el siguiente commit de la sesión (≤ 120 ms).
    await expect(mass).toHaveAttribute("aria-describedby", /\S/);
    const describedBy = await mass.getAttribute("aria-describedby");
    await expect(page.locator(`#${describedBy}`)).toContainText("entre 20 y 150 kg");
  });

  test("si el editor de pasajeros no carga, el panel lo dice y permite reintentar", async ({ page }) => {
    await page.route(/PassengerEditor[^/]*\.js/, route => route.abort());
    await openWorkshop(page);

    await page.getByRole("button", { name: /Tren y pasajeros/ }).click();
    const panel = page.getByRole("complementary", { name: "Tren y pasajeros" });
    await expect(panel.getByText(/No se pudieron cargar/)).toBeVisible();

    await page.unroute(/PassengerEditor[^/]*\.js/);
    await panel.getByRole("button", { name: "Reintentar" }).click();
    await expect(panel.getByRole("radio", { name: "3 pasajeros" })).toBeVisible();
  });

  test("si la manija desaparece en pleno arrastre (rehacer a «Bajada simple»), el gesto termina al soltar", async ({ page }) => {
    await openWorkshop(page);
    await chooseInPicker(page, /^Bajada simple ¿/);
    await expect(handle(page, /Cima del loop/)).toHaveCount(0);
    await page.keyboard.press("Control+z");
    const top = handle(page, /Cima del loop/);
    await expect(top).toBeVisible();

    // Arrastrar C y, sin soltar, rehacer: el loop (y su manija) desaparece.
    const from = await center(top);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y - 20, { steps: 4 });
    await page.keyboard.press("Control+Shift+z");
    await expect(top).toHaveCount(0);
    await page.mouse.up();

    // Ya sin gesto, la lectura vuelve a aparecer al pasar por la vía.
    await expect(verdict(page)).toContainText(/Aprobado|Rechazado/);
    await page.waitForTimeout(800);
    const e = await center(brakeEntry(page));
    await page.mouse.move(e.x - 60, e.y - 1);
    await expect(page.locator(".probe")).toHaveCount(1);
  });

  test("un arrastre con una pausa en el medio se deshace en un solo paso", async ({ page }) => {
    await openWorkshop(page);
    const from = await center(brakeEnd(page));

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 30, from.y, { steps: 4 });
    await page.waitForTimeout(900);
    await page.mouse.move(from.x - 70, from.y, { steps: 4 });
    await page.mouse.up();
    await expect(brakeEnd(page)).not.toHaveAttribute("aria-valuenow", "60");

    await page.keyboard.press("Control+z");
    await expect(brakeEnd(page)).toHaveAttribute("aria-valuenow", "60");
  });

  test("soltar una manija y volver a tomarla enseguida no mueve la pista bajo el cursor", async ({ page }) => {
    await openWorkshop(page);
    const f = brakeEnd(page);
    const first = await center(f);

    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await page.mouse.move(first.x - 40, first.y, { steps: 4 });
    await page.mouse.up();
    // Al soltar se abre el panel y la cámara se reencuadra (≈ 0,3 s). Se toma F apenas queda quieta: leer su
    // posición y hacer clic son dos acciones separadas, y con la cámara en movimiento el clic puede no caer en F.
    await expect(page.getByRole("complementary", { name: "Frenado" })).toBeVisible();
    await expect.poll(async () => {
      const a = await center(f);
      await page.waitForTimeout(50);
      const b = await center(f);
      return Math.hypot(a.x - b.x, a.y - b.y);
    }).toBeLessThan(0.5);

    const grab = await center(f);
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(grab.x - 30, grab.y, { steps: 3 });
    await page.waitForTimeout(450);
    await page.mouse.move(grab.x - 32, grab.y);

    const now = await center(f);
    expect(Math.abs(now.x - (grab.x - 32))).toBeLessThan(8);
    await page.mouse.up();
  });

  test("escribir en una manija un valor fuera del límite explica el recorte y devuelve el foco", async ({ page }) => {
    await openWorkshop(page);
    // El valor escrito queda en las manijas globales (A, v₀, F); las del trazado tienen su panel.
    const f = brakeEnd(page);

    await f.focus();
    await page.keyboard.press("Enter");
    const input = page.getByRole("textbox", { name: /Fin de la zona de frenado.*escribí el valor/ });
    await input.fill("500");
    await input.press("Enter");

    await expect(f).toBeFocused();
    await expect(page.locator(".handles .label em")).toBeVisible();
  });

  test("el campo del panel tiene un slider: arrastrarlo cambia el valor y un Ctrl+Z lo deshace en un paso", async ({ page }) => {
    await openWorkshop(page);
    await selectBraking(page);

    const panel = page.getByRole("complementary", { name: "Frenado" });
    const slider = panel.getByRole("slider", { name: "Largo de frenado" });
    const box = await slider.boundingBox();
    if (!box) throw new Error("Slider sin caja");
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 8 });
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();

    const input = page.locator("#field-brakingLength");
    await expect(input).not.toHaveValue("60");
    await page.keyboard.press("Control+z");
    await expect(input).toHaveValue("60");
  });

  test("el selector de magnitud de la telemetría se maneja con el teclado y Esc no cambia nada", async ({ page }) => {
    await openWorkshop(page);
    const trigger = page.getByRole("button", { name: /^Magnitud graficada:/ });
    const before = await trigger.getAttribute("aria-label");

    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    const list = page.getByRole("listbox", { name: "Magnitud graficada" });
    await expect(list).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-label", before ?? "");

    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Home");
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-label", /Magnitud graficada: Rapidez/);
  });

  test("un segundo clic sobre un selector o un menú lo cierra", async ({ page }) => {
    await openWorkshop(page);
    const trigger = page.getByRole("button", { name: /^Magnitud graficada:/ });
    const list = page.getByRole("listbox", { name: "Magnitud graficada" });

    await trigger.click();
    await expect(list).toBeVisible();
    await trigger.click();
    await expect(list).toBeHidden();

    await verdict(page).click();
    const download = page.getByRole("button", { name: "Descargar" });
    const menu = page.getByRole("menu", { name: "Descargar" });
    await download.click();
    await expect(menu).toBeVisible();
    await download.click();
    await expect(menu).toBeHidden();
  });

  test("la guía tiene pestañas accesibles", async ({ page }) => {
    await openWorkshop(page);
    await page.getByRole("button", { name: /^Guía/ }).click();
    const tab = page.getByRole("tab", { name: "Criterios" });

    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Modelo" })).toHaveAttribute("aria-selected", "true");
  });

  test("en el teléfono las tablas del informe se desplazan sin cortar texto ni desbordar la página", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkshop(page);
    await verdict(page).click();
    await page.getByRole("button", { name: /informe/i }).first().click();
    const report = page.getByRole("dialog", { name: /Informe/ });
    await expect(report).toBeVisible();

    const scrollers = report.locator(".table-scroll");
    expect(await scrollers.count()).toBeGreaterThan(0);
    const scrolls = await scrollers.first().evaluate(element => element.scrollWidth > element.clientWidth);
    expect(scrolls).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test("cada insignia explica su letra", async ({ page }) => {
    await openWorkshop(page);

    await expect(handle(page, /^Inicio de la zona de frenado E/)).toHaveAttribute("title", /E: Inicio de la zona de frenado/);
    // B va en la manija del punto del loop; la insignia aparece solo cuando las manijas se ocultan.
    await expect(page.getByRole("button", { name: /^Punto 2:/ })).toHaveAttribute("title", /^B: Entrada al loop/);

    await page.getByRole("button", { name: "Puntos A–F" }).click();
    const legend = page.getByRole("list", { name: "Puntos críticos A–F" });
    await expect(legend.getByRole("listitem")).toHaveCount(6);
    await expect(legend).toContainText("Inicio de la zona de frenado");

    await chooseInPicker(page, /^Bajada simple ¿/);
    await expect(legend).toContainText("este trazado no tiene loop");
  });

  test("los campos aceptan coma decimal, la muestran y descartan lo ilegible", async ({ page }) => {
    await openWorkshop(page);
    await handle(page, /Cima del loop/).click();
    const radius = page.getByRole("complementary", { name: "Loop" }).getByRole("textbox", { name: "Radio en la cima" });

    await radius.fill("3,25");
    await radius.press("Enter");
    await expect(radius).toHaveValue("3,25");
    await expect(page.getByRole("complementary", { name: "Loop" }).getByRole("slider", { name: "Radio en la cima" })).toHaveAttribute("aria-valuetext", "3,25 m");

    await radius.fill("abc");
    await radius.press("Enter");
    await expect(radius).toHaveValue("3,25");
  });

  test("el slider del radio sigue el límite dinámico h_L/2", async ({ page }) => {
    await openWorkshop(page);
    await handle(page, /Cima del loop/).click();
    const panel = page.getByRole("complementary", { name: "Loop" });

    // h_L no baja de 2R (5 m → 10 m): con 12 m, el radio llega como mucho a 6 m.
    const height = panel.getByRole("textbox", { name: "Altura del loop" });
    await height.fill("12");
    await height.press("Enter");
    await panel.getByRole("slider", { name: "Radio en la cima" }).focus();
    await page.keyboard.press("End");

    await expect(panel.getByRole("textbox", { name: "Radio en la cima" })).toHaveValue("6,00");
  });

  test("volver al menú y entrar de nuevo conserva el diseño, y el menú no deshace cambios", async ({ page }) => {
    await openWorkshop(page);
    await dragBrakeEndTowardsEntry(page, 60);
    const designed = await brakeEnd(page).getAttribute("aria-valuenow");

    await page.getByRole("button", { name: "Volver al menú" }).click();
    await expect(page.getByRole("button", { name: /Diseñar y certificar/ })).toBeVisible();
    await page.keyboard.press("Control+z");
    await page.getByRole("button", { name: /Diseñar y certificar/ }).click();

    await expect(brakeEnd(page)).toHaveAttribute("aria-valuenow", designed ?? "");
  });

  test("sin desborde horizontal en 1440, 1024, 700 y 390 px y sin errores de consola", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));

    await openWorkshop(page);

    for (const width of [1440, 1024, 700, 390]) {
      await page.setViewportSize({ width, height: 860 });
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `desborde a ${width} px`).toBeLessThanOrEqual(0);
      await expect(verdict(page)).toBeVisible();
      await expect(page.getByRole("button", { name: "Reproducir" })).toBeVisible();
    }

    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });
});

test.describe("Menú", () => {
  test("el menú muestra el logo y un video de fondo silencioso con póster", async ({ page }) => {
    await page.goto("/");

    const logo = page.locator("img.menu-logo");
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

    const video = page.locator(".menu-screen video");
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute("poster", /\.webp$/);
    expect(await video.evaluate(element => (element as HTMLVideoElement).muted)).toBe(true);
  });

  test("si el navegador no deja reproducir el video (iOS en bajo consumo), queda el póster sin controles", async ({ page }) => {
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException("Bloqueado", "NotAllowedError"));
    });
    await page.goto("/");

    await expect(page.locator("img.menu-logo")).toBeVisible();
    await expect(page.locator(".menu-screen video")).toHaveCount(0);
    const background = await page.locator(".menu-screen").evaluate(element => getComputedStyle(element).backgroundImage);
    expect(background).toContain("poster.webp");
  });

  test("una reproducción interrumpida (no bloqueada) no quita el video del menú", async ({ page }) => {
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException("Interrumpida", "AbortError"));
    });
    await page.goto("/");

    await expect(page.locator("img.menu-logo")).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.locator(".menu-screen video")).toHaveCount(1);
  });

  test("con movimiento reducido el menú no reproduce video y queda el póster", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(page.locator("img.menu-logo")).toBeVisible();
    await expect(page.locator(".menu-screen video")).toHaveCount(0);
    const background = await page.locator(".menu-screen").evaluate(element => getComputedStyle(element).backgroundImage);
    expect(background).toContain("poster.webp");
  });
});

/** Textos que solo aparecen en el código de cada pieza diferida. */
const CODE_MARKERS = {
  charts: "Check that a complete date adapter is provided",
  workshop: "Tren y pasajeros",
  report: "Informe de certificación · ",
  guide: "No aprueban (para comparar)"
};

/** Demora artificial de la descarga del informe (ms). */
const REPORT_DELAY_MS = 1500;

/** Junta el código de cada módulo JS que descarga la página. */
function collectCode(page: Page) {
  const bodies: string[] = [];
  page.on("response", async response => {
    if (!response.url().endsWith(".js") && !response.url().includes(".js?")) return;
    bodies.push(await response.text().catch(() => ""));
  });
  return { has: (marker: string) => bodies.some(body => body.includes(marker)) };
}

test.describe("Carga bajo demanda", () => {
  test("si el taller no se descarga (con su CSS y la física), lo dice y «Recargar la página» lo abre con estilos", async ({ page }) => {
    const broken = /(Workshop|physics)-[^/]*\.(js|css)/;
    await page.route(broken, route => route.abort());
    await page.goto("/");
    await page.getByRole("button", { name: /Diseñar y certificar/ }).click();
    await expect(page.getByRole("alert")).toContainText("No se pudo descargar el taller");

    await page.unroute(broken);
    await page.getByRole("button", { name: "Recargar la página" }).click();
    await page.getByRole("button", { name: /Diseñar y certificar/ }).click();
    await expect(verdict(page)).toContainText(/Aprobado|Rechazado/, { timeout: 15_000 });
    expect(await page.locator(".workshop").evaluate(element => getComputedStyle(element).position)).toBe("fixed");
  });

  test("si el informe no se descarga, «Imprimir o guardar PDF» avisa y no imprime una página vacía", async ({ page }) => {
    await page.route(/ReportDialog-[^/]*\.(js|css)/, route => route.abort());
    await openWorkshop(page);
    await page.evaluate(() => {
      window.print = () => {
        document.body.dataset.prints = String(Number(document.body.dataset.prints ?? "0") + 1);
      };
    });

    await verdict(page).click();
    await page.getByRole("button", { name: "Descargar" }).click();
    await page.getByRole("menuitem", { name: "Imprimir o guardar PDF" }).click();

    await expect(page.getByRole("alert")).toContainText("No se pudo descargar el informe");
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.body.dataset.prints ?? "0")).toBe("0");
  });

  test("si el informe falla y vuelve la red, «Reintentar» lo abre con sus estilos", async ({ page }) => {
    const broken = /ReportDialog-[^/]*\.(js|css)/;
    await page.route(broken, route => route.abort());
    await openWorkshop(page);
    await verdict(page).click();
    await page.getByRole("button", { name: "Ver informe de certificación" }).click();
    await expect(page.getByRole("alert")).toContainText("No se pudo descargar el informe");

    await page.unroute(broken);
    await page.getByRole("button", { name: "Reintentar" }).click();
    const dialog = page.getByRole("dialog", { name: /Informe de certificación/ });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(element => getComputedStyle(element).borderRadius)).toBe("20px");
  });

  test("con el taller abierto, las piezas diferidas se precargan: la guía y el informe abren aunque se corte la red", async ({ page }) => {
    const code = collectCode(page);
    await openWorkshop(page);
    await expect.poll(() => code.has(CODE_MARKERS.guide) && code.has(CODE_MARKERS.report), { timeout: 10_000 }).toBe(true);

    await page.context().setOffline(true);
    await page.getByRole("button", { name: "Guía", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Guía" })).toBeVisible();
    await page.keyboard.press("Escape");
    await verdict(page).click();
    await page.getByRole("button", { name: "Ver informe de certificación" }).click();
    await expect(page.getByRole("dialog", { name: /Informe de certificación/ })).toBeVisible();
  });

  test("si falla la precarga en reposo no aparece ningún aviso; aparece recién al pedir la pieza", async ({ page }) => {
    await page.route(/(Guide|ReportDialog)-[^/]*\.js/, route => route.abort());
    await openWorkshop(page);
    await page.waitForTimeout(3000);

    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: "Guía", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "la guía" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "el informe" })).toHaveCount(0);
  });

  test("los avisos de descargas fallidas se apilan sin taparse y se pueden cerrar", async ({ page }) => {
    await page.route(/(Guide|ReportDialog)-[^/]*\.js/, route => route.abort());
    await openWorkshop(page);

    await page.getByRole("button", { name: "Guía", exact: true }).click();
    await verdict(page).click();
    await page.getByRole("button", { name: "Ver informe de certificación" }).click();
    const guide = page.getByRole("alert").filter({ hasText: "la guía" });
    const report = page.getByRole("alert").filter({ hasText: "el informe" });
    await expect(guide).toBeVisible();
    await expect(report).toBeVisible();

    const a = await guide.boundingBox();
    const b = await report.boundingBox();
    if (!a || !b) throw new Error("Aviso sin caja");
    const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlap).toBe(false);

    await guide.getByRole("button", { name: "Cerrar aviso" }).click();
    await expect(guide).toHaveCount(0);
    await expect(report).toBeVisible();
  });

  test("la portada solo enlaza el código del menú: ni el taller, ni Chart.js, ni los diálogos", async ({ request }) => {
    const html = await (await request.get("/")).text();
    const scripts = [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*rel="modulepreload"[^>]*\shref)="([^"]+\.js)"/g)].map(match => match[1]);
    const code = (await Promise.all(scripts.map(async src => (await request.get(src)).text()))).join("\n");

    expect(scripts.length).toBeGreaterThan(0);
    for (const [piece, marker] of Object.entries(CODE_MARKERS)) expect(code.includes(marker), `${piece} en la portada`).toBe(false);
  });

  test("en el teléfono la telemetría arranca plegada y al abrirla dibuja sus gráficas; la guía abre al primer toque", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkshop(page);
    await expect(page.locator(".telemetry canvas")).toHaveCount(0);

    await page.getByRole("button", { name: "Gráficas de telemetría" }).click();
    await expect(page.locator(".telemetry canvas").first()).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Guía", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Guía" })).toBeVisible();
  });

  test("la grilla de telemetría dibuja las siete gráficas sin errores", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));
    await openWorkshop(page);

    await page.getByRole("button", { name: "Saltar al final" }).click();
    await page.getByRole("button", { name: "Todas las gráficas" }).click();
    const canvases = page.locator(".telemetry canvas");
    await expect(canvases).toHaveCount(7);

    // Pasar por una gráfica dibuja el tooltip sin errores.
    const box = await canvases.first().boundingBox();
    if (!box) throw new Error("Gráfica sin caja");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(200);
    expect(errors).toEqual([]);
  });

  test("«PDF» abre el informe antes de imprimir aunque el informe todavía se esté descargando", async ({ page }) => {
    // El informe tarda en llegar: cuando se toca «PDF» todavía no está.
    await page.route(/ReportDialog-[^/]*\.js/, async route => {
      await new Promise(resolve => setTimeout(resolve, REPORT_DELAY_MS));
      await route.continue();
    });
    await page.goto("/");
    await page.getByRole("button", { name: /Diseñar y certificar/ }).click();
    await expect(verdict(page)).toContainText(/Aprobado|Rechazado/, { timeout: 15_000 });
    await page.evaluate(() => {
      window.print = () => {
        document.body.dataset.printedWithReport = String(Boolean(document.querySelector("dialog.report-dialog[open]")));
      };
    });

    await verdict(page).click();
    await page.getByRole("button", { name: "Descargar" }).click();
    await page.getByRole("menuitem", { name: "Imprimir o guardar PDF" }).click();

    await expect(page.locator("body")).toHaveAttribute("data-printed-with-report", "true");
    await expect(page.getByRole("dialog", { name: /Informe de certificación/ })).toBeVisible();
  });
});
