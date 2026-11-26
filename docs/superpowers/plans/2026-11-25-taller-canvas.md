# Taller centrado en el lienzo: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el asistente de 3 pantallas y el laboratorio con panel lateral por un taller de una sola pantalla. En el taller se diseña arrastrando la propia pista, la auditoría vive sobre la vía y los paneles aparecen solo a pedido.

**Architecture:**
- La lógica de diseño (borrador, commit throttled, deshacer, masas) sale de `Simulation.svelte` a una clase `DesignSession`.
- La cámara gana encuadre ajustado, zoom/paneo y proyección inversa. `renderSimulation` devuelve la cámara usada para que una capa DOM posicione manijas y pines.
- Las manijas y la prueba de impacto son funciones puras en `src/lib`, probadas con Vitest.
- La pantalla `Workshop.svelte` solo compone barra, lienzo, panel derecho y telemetría.

**Tech Stack:** Svelte 5 (runes), TypeScript/JS con JSDoc, Vite 8, Vitest 5, Playwright (Chrome), Canvas 2D, Chart.js 4, lucide-svelte.

**Spec:** `docs/superpowers/specs/2026-11-25-taller-canvas-design.md`

## Global Constraints

- `src/physics/` no cambia y sigue sin DOM.
- Deben quedar en verde, al final de cada tarea: `npm test`, `npm run check` (0 errores), `npm run headless` (exit 0) y `npm run e2e`.
- Textos en el español de la interfaz actual («Arrastrá», «Reproducí»), con decimales con coma vía `formatNumber` de `src/ui/format.ts`.
- La escala es real: no hay exageración vertical.
- Dependencias: no se agrega ninguna nueva.
- Commits: solo cuando el dueño lo pida; los pasos «Checkpoint» corren la batería, no hacen commit. Push a `main` redespliega Vercel, así que se confirma antes.
- Responsive desde 390 px:
  - en ≤ 700 px el panel derecho es hoja inferior (máx. 60 vh);
  - la telemetría arranca plegada en ≤ 700 px y abierta en escritorio.
- Accesibilidad:
  - las manijas son `button` con `role="slider"`, `aria-label`, `aria-valuenow`, `aria-valuetext`, y se mueven con flechas (Shift = ×10);
  - Esc cierra el panel;
  - se respeta `prefers-reduced-motion` (sin animación de cámara).
- Estilos con `<style>` del componente. En `src/styles/*.css` no se usa `:global(...)`, porque es CSS plano.
- Verificación visual: capturas con Playwright revisadas antes de reportar.

## Review Focus

1. **Arrastrar una manija más allá de lo construible** (la colina no cabe, el loop choca): la manija se detiene en el último valor válido, explica por qué y nunca deja la app en error. Lo cubre `proposeDrag` en la Tarea 2.
2. **Abrir o cerrar el panel o redimensionar con zoom activo:** las manijas siguen pegadas a la vía, porque se posicionan con la cámara del último cuadro. Lo cubre el e2e de la Tarea 9: con el panel abierto, arrastrar F sigue rechazando.
3. **Un arrastre completo:** cuenta como un solo paso de deshacer, y Ctrl+Z dentro de un campo de texto no deshace el diseño. Lo cubren el e2e de la Tarea 9 y la prueba de `DesignSession` en la Tarea 4.
4. **`pointercancel` o pérdida de captura a mitad del arrastre:** la cámara se descongela y queda el último valor válido. Lo cubre el e2e de la Tarea 9 con `dispatchEvent('pointercancel')`.
5. **Cambiar de recorrido con un área seleccionada que el nuevo no tiene** (loop → «Línea»): la selección se limpia y el panel se cierra. Lo cubre el e2e de la Tarea 9.

---

## Fase 1: taller y edición sobre la pista

### Task 1: Cámara con encuadre ajustado, zoom/paneo y proyección inversa

**Files:**
- Modify: `src/ui/renderer/camera.js` (`createCamera`, nuevas `fitBounds`, `frameView`, constantes)
- Modify: `src/ui/renderer/index.js` (`renderSimulation` devuelve `Camera | null`; `Scene.camera` pasa a `CameraView`)
- Test: `tests/camera.test.js`

**Interfaces:**
- Produces:
  - ```js
    /** @typedef {{mode: "fit" | "follow", zoom: number, centerX?: number, centerY?: number}} CameraView */
    ```
  - `Camera` gana `fromX(px: number): number`, `fromY(py: number): number` y `fitScale: number`.
  - `fitBounds(track, lift): {minX, maxX, minY, maxY}` encuadra de A (incluida la cresta de la cadena) a F con `FIT_PAD_M = 4` a los lados y `FIT_PAD_TOP_M = 6` arriba. Sin el relleno de 34 m.
  - `frameView(width, height, track, bounds) → CameraView` devuelve el modo fit con zoom y centro que encuadran `bounds`. Se usa para el zoom a la selección.
  - Exporta `MIN_VIEW_ZOOM = 1` y `MAX_VIEW_ZOOM = 8`. `MIN_ZOOM` y `MAX_ZOOM` siguen para el seguimiento.
  - `renderSimulation(canvas, scene) → Camera | null`.
- Fit con `zoom > 1` y centro dado: `scale = fitScale·zoom` y el centro (m) va al centro del lienzo. Sin centro, se usa el centro de `fitBounds`. El zoom se limita a `[MIN_VIEW_ZOOM, MAX_VIEW_ZOOM]`.
- La capa estática cacheada sigue usando `worldBounds`, que no cambia, para que el escenario se vea al panear.

- [ ] **Step 1: Write the failing tests** in `tests/camera.test.js`:
  - `"la proyección inversa recupera los metros: fromX(toX(x)) ≈ x y fromY(toY(y)) ≈ y"`: se prueba con fit zoom 1, fit zoom 3 con centro y follow, sobre `buildTrack(resolveConfig({mapId:"reference"}))` en 1200×600, con `toBeCloseTo(x, 6)`.
  - `"el encuadre ajustado deja A y F dentro del lienzo y usa más escala que el mundo completo"`: se exige `toX(0) ≥ 0`, `toX(track.endX) ≤ width` y `camera.scale > escala del encuadre anterior`, calculada como `min((w−56)/spanX_mundo, (h−112)/spanY_mundo)`.
  - `"zoom 2 duplica la escala y conserva el centro pedido en el centro del lienzo"`: con `{mode:"fit", zoom:2, centerX:50, centerY:10}` se espera `toX(50) ≈ width/2`, `toY(10) ≈ height/2` y `scale ≈ 2·fitScale`.
  - `"el zoom se limita a [1, 8]"`: con zoom 20 se espera `scale ≈ 8·fitScale`, y con zoom 0,2 se espera `scale ≈ fitScale`.
  - `"frameView encuadra un rectángulo: sus esquinas quedan dentro del lienzo"`: el rectángulo es el del loop, `{minX: loop.x−12, maxX: loop.exitX+12, minY: 0, maxY: loop.height+3}`.
- [ ] **Step 2: Run** `npx vitest run tests/camera.test.js`. Expected: FAIL (`fromX` is not a function / `fitBounds` not exported).
- [ ] **Step 3: Implement** in `camera.js` and `index.js` according to the interfaces above. The legacy mode `"full"` is treated as `"fit"`.
- [ ] **Step 4: Run** `npx vitest run tests/camera.test.js`. Expected: PASS. Then run `npm test`; expected: all tests pass.

### Task 2: Manijas puras (posición y arrastre → parche)

**Files:**
- Create: `src/lib/handles.ts`
- Test: `tests/handles.test.js`

**Interfaces:**
- Consumes: `buildTrack`, `resolveConfig`, `geometryAt`, `hillHalfWidth`, `APPROACH_LENGTH`, `ConfigError`, `assertLoopShape` from `src/physics/index.js`; `limitsOf`, `fieldByKey`, `friendlyConfigMessage` from `src/lib/field-definitions.ts`; `AreaId` from `src/lib/audit.ts`.
- Produces:
  ```ts
  export type HandleId = "start" | "speed" | "loopTop" | "loopRadius" | "crest" | "hillFoot" | "brakeEntry" | "brakeEnd";
  export type HandleAxis = "x" | "y" | "tangent";
  export interface Handle {
    id: HandleId; area: AreaId; axis: HandleAxis;
    key: NumericKey;            // parámetro que modifica
    x: number; y: number;       // posición en metros
    value: number;              // valor actual del parámetro
    name: string;               // aria-label, p. ej. "Cima del loop: altura h_L"
    primary: boolean;           // visible sin selección
    anchor?: { x: number; y: number }; // origen de la flecha v₀ o centro del círculo R
    direction?: { x: number; y: number }; // tangente unitaria en A (eje "tangent")
  }
  export interface DragProposal { value: number; patch: Partial<SimulationConfig>; limited: boolean; reason: string | null }
  export const SPEED_ARROW_M_PER_MPS = 3;
  export function handlesFor(track: Track, config: SimulationConfig): Handle[];
  export function proposeDrag(handle: Handle, point: { x: number; y: number }, config: SimulationConfig): DragProposal;
  export function proposeValue(handle: Handle, value: number, config: SimulationConfig): DragProposal;
  export function handleText(handle: Handle, value: number, config: SimulationConfig): { label: string; detail: string };
  ```
- **Posición de cada manija y mapeo del arrastre.** En las fórmulas de arrastre, x e y son las coordenadas del puntero en metros.

  | Manija | Posición | Arrastre → parámetro |
  |---|---|---|
  | start | (0, H) | `H = y` |
  | speed | A + dirección·v₀·`SPEED_ARROW_M_PER_MPS` | `v₀ = proyección((p − A)·dir)/SPEED_ARROW_M_PER_MPS` |
  | loopTop | marcador C | `h_L = y − base.y` |
  | loopRadius | (C.x + R, C.y − R), centro (C.x, C.y − R) | `R = x − C.x` |
  | crest | marcador D | `h_c = y` |
  | hillFoot | (D.x + w, 0) con w = `hillHalfWidth` | `ρ_c = (x − D.x)²/(6·h_c)` |
  | brakeEntry | (`track.brakeX`, 0) | `W = x − APPROACH_LENGTH` |
  | brakeEnd | (`track.endX`, 0) | `d_f = x − track.brakeX` |

- **Qué manijas existen por recorrido:**
  - todas: `start`, `speed`, `brakeEntry`, `brakeEnd`;
  - `loop` y `reference`: además `loopTop` y `loopRadius`;
  - `valley` y `reference` con `hillHeight > 0`: además `crest` y `hillFoot`.
- **Manijas primarias:** start, loopTop, crest, brakeEntry y brakeEnd. Las demás son secundarias.
- **`proposeValue`:**
  1. Limita el valor a `limitsOf(key)`; para el loop limita además la forma: `2R ≤ h_L ≤ 20R`.
  2. Para la colina en arrastre usa h_c ≥ 0,5 m: la colina no desaparece a mitad del gesto.
  3. Redondea al `step` del campo.
  4. Comprueba con `buildTrack(resolveConfig({...config, ...patch}))`. Si lanza error, busca por bisección (12 iteraciones) el valor construible más lejano entre `handle.value` y el pedido. Devuelve `limited: true` y como `reason` el `friendlyConfigMessage` del error.
- **`handleText`:**
  - `label` es «h_L = 21,5 m», con el símbolo y la unidad de `fieldByKey`.
  - `detail` es el `hint` del campo evaluado con el valor propuesto, o `""`.

- [ ] **Step 1: Write the failing tests** in `tests/handles.test.js`:
  - `"el anexo tiene las ocho manijas y cada una está sobre su punto"`. Los ids son los 8 de la tabla. Además:
    - `start` en (0, H);
    - `loopTop.y ≈ config.loopHeight`;
    - `brakeEnd.x ≈ track.endX`;
    - `loopRadius.x − loopTop.x ≈ config.loopTopRadius`.
  - `"«Línea» no tiene manijas de loop ni de colina"`.
  - `"arrastrar F 10 m a la izquierda acorta la zona de frenado 10 m"`: `proposeDrag(brakeEnd, {x: endX − 10, y: 0}).patch.brakingLength ≈ d_f − 10` y `limited: false`.
  - `"subir la cima del loop respeta h_L ≤ 20R"`: con R = 1 y el puntero en y = 50, se espera `value = 20` y `limited: true`.
  - `"el radio de la cima no supera h_L/2"`: con el puntero en x = C.x + 100, se espera `value = h_L/2`.
  - `"una colina que no cabe se detiene en el último ancho construible y explica por qué"`. El escenario es `reference` con W = 160 y el pie arrastrado a x = 1000. Se espera:
    - `limited: true`;
    - `reason` coincide con `/colina/i`;
    - `buildTrack({...config, ...patch})` no lanza.
  - `"arrastrar la flecha v₀ a lo largo de la tangente fija v₀ = largo/3"`.
  - `"proposeValue respeta el paso del campo"`: H = 20,26 da 20,5, porque el paso es 0,5.
  - `"handleText muestra símbolo, coma decimal y unidad"`: el resultado es «h_L = 21,5 m».
- [ ] **Step 2: Run** `npx vitest run tests/handles.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `src/lib/handles.ts` according to the interfaces above.
- [ ] **Step 4: Run** `npx vitest run tests/handles.test.js`. Expected: PASS.

### Task 3: Prueba de impacto y límites por área

**Files:**
- Create: `src/lib/track-hit.ts`
- Test: `tests/track-hit.test.js`

**Interfaces:**
- Consumes: `areaForSection` from `src/lib/audit.ts`; `focusRanges` from `src/lib/track-focus.ts`.
- Produces:
  ```ts
  export function nearestTrackPoint(track: Track, x: number, y: number): { distance: number; gap: number; x: number; y: number };
  export function areaAtDistance(track: Track, distance: number): AreaId;   // ≥ brakeStart → "braking"; aproximación → "braking"
  export function areaBounds(track: Track, area: AreaId): { minX: number; maxX: number; minY: number; maxY: number } | null;
  ```
- `nearestTrackPoint` recorre `track.points` (polilínea) proyectando sobre cada segmento. Para los loops, que se superponen, gana el punto de menor distancia euclídea.
- `areaBounds` es la caja de los puntos de `focusRanges(track, area)` más 3 m de margen, o `null` si el área no tiene tramos.

- [ ] **Step 1: Write the failing tests** in `tests/track-hit.test.js`:
  - `"un punto en la cima del loop pertenece al loop"`.
  - `"un punto sobre la recta final pertenece al frenado"`.
  - `"un punto sobre la caída inicial pertenece a la salida"`.
  - `"gap mide la distancia en metros a la vía"`: el punto es (x, y + 2) sobre una recta y se espera gap ≈ 2.
  - `"areaBounds del loop contiene el loop y es null para criteria"`.
- [ ] **Step 2: Run** `npx vitest run tests/track-hit.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/lib/track-hit.ts`.
- [ ] **Step 4: Run** `npx vitest run tests/track-hit.test.js`. Expected: PASS.

### Task 4: `DesignSession`, historial del runner a ≤ 10 Hz y bucle de cuadros bajo demanda

**Files:**
- Modify: `vitest.config.js` (agregar `plugins: [svelte()]` para compilar `.svelte.ts` con runes)
- Create: `src/lib/design-session.svelte.ts` (lógica movida desde `src/screens/Simulation.svelte`: `commit`, `scheduleCommit`, `commitNow`, `scheduleHistory`, `flushPending`, `restore`, undo/redo, masas, `loadScenario`, `applyRecommendation`)
- Create: `src/lib/frame-loop.ts`
- Modify: `src/lib/simulation-runner.svelte.ts` (`#flush` agrupado)
- Test: `tests/design-session.test.js`, `tests/frame-loop.test.js`, `tests/runner.test.js`

**Interfaces:**
- Produces:
  ```ts
  export class DesignSession {
    constructor(config: ConfigInput, passengers: Passenger[]);
    readonly runner: SimulationRunner; readonly audit: LiveAudit;
    draft: SimulationConfig; cartMass: number; masses: number[]; passengers: Passenger[];
    errorField: string; errorMessage: string;
    readonly canUndo: boolean; readonly canRedo: boolean;
    patch(partial: Partial<SimulationConfig>): void;       // pausa, throttle 120 ms
    commitNow(): boolean;
    loadTemplate(mapId: MapId): void;                      // conserva masas y reglas; un paso de deshacer
    loadScenario(id: ScenarioId): void;
    applyRecommendation(next: SimulationConfig): void;
    setCartMass(value: number): void; setPassengerMass(index: number, value: number): void;
    setPassengers(passengers: Passenger[]): void;           // cambia cantidad → carritos y masas
    undo(): void; redo(): void;
    destroy(): void;
  }
  export interface FrameLoop { invalidate(): void; setActive(active: boolean): void; destroy(): void }
  export function createFrameLoop(draw: (elapsedSeconds: number) => void, raf?: typeof requestAnimationFrame, caf?: typeof cancelAnimationFrame): FrameLoop;
  ```
- Constantes que se conservan: `COMMIT_THROTTLE_MS = 120`, `HISTORY_SETTLE_MS = 600`, `CART_MASS_LIMITS = [1, 10000]`.
- Runner: `HISTORY_FLUSH_INTERVAL_S = 0.1` de tiempo real. `tick` publica `history` solo al cumplirse el intervalo o al terminar. `pause`, `stepOnce`, `runToEnd` y `scrubTo` publican de inmediato.
- `createFrameLoop`:
  - activo: cuadros continuos con `elapsed` real, y 0 en el primero;
  - inactivo: cada `invalidate()` agenda un solo cuadro (varios `invalidate` en el mismo tick dan un cuadro) con `elapsed = 0`.

- [ ] **Step 1: Write the failing tests.**
  - `tests/runner.test.js`, `"durante la reproducción el historial se publica a lo sumo 10 veces por segundo"`: 60 `tick(1/60)` producen ≤ 11 referencias distintas de `runner.history`. Después de `pause()` se cumple `history.at(-1).time ≈ runner.state.time` (±`SAMPLE_INTERVAL`).
  - `tests/frame-loop.test.js`, con un `raf` falso que encola callbacks:
    - `"inactivo, tres invalidate seguidos dibujan un solo cuadro"`;
    - `"activo, dibuja en cada cuadro y al desactivar se detiene"`.
  - `tests/design-session.test.js`, con `vi.useFakeTimers()`:
    - `"un cambio se simula tras 120 ms"`: después de `patch({brakingLength: 30})` y `advanceTimersByTime(130)` se espera `runner.config.brakingLength === 30`.
    - `"un valor fuera de rango deja el último diseño válido y explica el error"`: `patch({loopHeight: 500})` deja `errorField === "loopHeight"` y `runner.config.loopHeight` sin cambios.
    - `"varios cambios seguidos se deshacen en un solo paso"`: tres `patch` a 50 ms, `advanceTimersByTime(700)`, un `undo()`, y se espera el valor inicial.
    - `"loadTemplate cambia el recorrido y se puede deshacer"`.
  - `LiveAudit` usa `Worker`. En Node se sustituye con `vi.stubGlobal("Worker", undefined)`, que activa el respaldo en el hilo principal que ya existe.
- [ ] **Step 2: Run** `npx vitest run tests/runner.test.js tests/frame-loop.test.js tests/design-session.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Agregar el plugin svelte a `vitest.config.js`.
  - Crear `frame-loop.ts`.
  - Agrupar `#flush` en el runner.
  - Mover la lógica a `DesignSession`. `Simulation.svelte` la consume temporalmente hasta la Tarea 5.
- [ ] **Step 4: Run** `npm test && npm run check`. Expected: todo en verde, incluidas las 108 pruebas anteriores.

### Task 5: Pantalla `Workshop` y flujo Menú → Taller

**Files:**
- Create: `src/screens/Workshop.svelte` (composición: `WorkshopBar`, `Stage`, `SidePanel`, `TelemetryDrawer`; atajos Ctrl+Z / Ctrl+Shift+Z / Esc movidos desde `Simulation.svelte`)
- Create: `src/components/workshop/WorkshopBar.svelte`, `src/components/workshop/TemplatePicker.svelte`
- Modify: `src/App.svelte` (pantallas `"menu" | "workshop"`; sesión inicial `mapId: "reference"`)
- Delete: `src/screens/Simulation.svelte`, `src/screens/Setup.svelte`, `src/components/TopNav.svelte`, `src/styles/setup.css`, `src/styles/top-nav.css`

**Interfaces:**
- Consumes: `DesignSession` (Task 4), `MAPS`, `SCENARIO_CARDS`, `TrackThumbnail`.
- `WorkshopBar` props:
  ```ts
  { mapId: string; passengerSummary: string; canUndo: boolean; canRedo: boolean;
    report: AuditReport | null; status: AuditStatus; invalid: boolean;
    onHome(): void; onTemplate(mapId: MapId): void; onScenario(id: ScenarioId): void;
    onPanel(mode: "verdict" | "rules" | "passengers"): void; onGuide(): void; onUndo(): void; onRedo(): void }
  ```
- La píldora de dictamen muestra «Aprueba», «No aprueba: …» o «Auditando…», con `role="status"` y `aria-live="polite"`. Los botones de deshacer y rehacer se llaman «Deshacer» y «Rehacer».
- `TemplatePicker` usa la API nativa `popover` (`popovertarget`), que cierra al tocar fuera y con Esc. Tiene dos secciones: «Recorridos», con miniatura y nombre, y «Casos de prueba», con los escenarios.
- La pantalla de avatares (`Passengers.svelte`) se abre como capa a pantalla completa sobre el taller, sin desmontarlo; `onStart` y `onBack` cierran la capa. El diseño no se pierde.

- [ ] **Step 1: Implement** the components and `App.svelte`. The Menu's «Jugar» opens the workshop directly.
- [ ] **Step 2: Run** `npm run check`. Expected: 0 errors.
- [ ] **Step 3: Verify in the browser** with a screenshot script in the scratchpad (1440×900). Expected:
  - Menu → Workshop in a single click;
  - the pill shows «Aprueba» with the annex;
  - choosing «Loop» in the picker changes the map;
  - Ctrl+Z goes back.

### Task 6: Lienzo a pantalla completa con cámara interactiva, reproducción y zoom

**Files:**
- Create: `src/components/workshop/Stage.svelte`, `src/components/workshop/PlaybackPill.svelte`, `src/components/workshop/ZoomControls.svelte`
- Delete: `src/components/lab/StagePanel.svelte`, `src/components/lab/TransportBar.svelte`

**Interfaces:**
- Consumes: `renderSimulation → Camera`, `CameraView`, `frameView`, `MAX_VIEW_ZOOM` (Task 1); `createFrameLoop` (Task 4); `nearestTrackPoint`, `areaAtDistance`, `areaBounds` (Task 3).
- `Stage` props:
  ```ts
  { session: DesignSession; selectedArea: AreaId | null; onSelect(area: AreaId | null): void; children?: Snippet<[Camera]> }
  ```
- `Stage` mantiene `view: CameraView` y expone la última `Camera` al snippet, que dibuja manijas y luego pines.
- Interacciones del lienzo:

  | Gesto | Resultado |
  |---|---|
  | Rueda | zoom ×1,15 por paso, anclado al cursor |
  | Arrastre del fondo (> 4 px) | paneo |
  | Clic (sin mover) | `nearestTrackPoint`; si `gap·scale ≤ 14 px`, `onSelect(areaAtDistance)`, si no `onSelect(null)` |
  | Doble clic en el fondo | encuadrar |

- Al cambiar `selectedArea` a un área con `areaBounds`, la cámara anima 300 ms (ease-out) hacia `frameView`. No anima con `prefers-reduced-motion`.
- Bucle: `setActive(runner.running || animando || arrastrando)`. Cualquier cambio de escena o de `view` llama a `invalidate()`. Un `ResizeObserver` también invalida.
- `PlaybackPill`, abajo a la izquierda: reproducir/pausar, reiniciar, línea de tiempo (`input range`) con t y tramo, y velocidad (menú corto ¼× a 4×).
- `ZoomControls`, abajo a la derecha: −, encuadrar, +, seguir al tren (alternable).
- Al reproducir con zoom, la cámara pasa a seguimiento solo si el usuario lo pidió.

- [ ] **Step 1: Implement** `Stage`, `PlaybackPill` and `ZoomControls`; mount them in `Workshop`.
- [ ] **Step 2: Measure idle CPU** with a CDP script in the scratchpad (`Performance.getMetrics`, `TaskDuration` over 5 s). Expected: < 3 % idle, versus 22,7 % before.
- [ ] **Step 3: Take screenshots** at 1440×900 and 390×844. Expected: the track fills the width and the overlays don't cover A or F.

### Task 7: Capa de manijas con arrastre, etiqueta de valor, teclado y edición en el lugar

**Files:**
- Create: `src/components/workshop/HandleLayer.svelte`

**Interfaces:**
- Consumes: `handlesFor`, `proposeDrag`, `proposeValue`, `handleText` (Task 2); `Camera` from the `Stage` snippet; `session.patch`.
- Props:
  ```ts
  { camera: Camera; handles: Handle[]; selectedArea: AreaId | null; hidden: boolean; config: SimulationConfig;
    onDragState(dragging: boolean): void; onPatch(patch: Partial<SimulationConfig>): void; onSelect(area: AreaId): void }
  ```
- **Elemento y visibilidad:** cada manija es `<button role="slider">`, posicionada con `transform: translate(toX(x), toY(y))`. Las secundarias solo aparecen si `handle.area === selectedArea`. Con `hidden` (reproduciendo) no aparece ninguna.
- **Arrastre:**
  - `pointerdown` llama a `setPointerCapture`, a `onDragState(true)` (el `Stage` congela su cámara) y a `onSelect(handle.area)`.
  - `pointermove` convierte con `camera.fromX/fromY`, llama a `proposeDrag` y luego a `onPatch(patch)`.
  - `pointerup`, `pointercancel` y `lostpointercapture` llaman a `onDragState(false)`.
- **Etiqueta flotante:** durante el arrastre o el foco muestra `handleText(...).label` y `detail`. Si `limited`, agrega `reason` en ámbar.
- **Teclado:** flechas ± `step`, Shift ×10, vía `proposeValue`. Enter o doble clic muestran un `input type=number` en el lugar: Enter confirma con `proposeValue` y Esc cancela.
- **Guías:** el círculo de R (punteado) y la flecha v₀ se dibujan como un SVG absoluto dentro de la capa, solo si su área está seleccionada.
- El `Stage` usa `handlesFor(session.runner.track, session.runner.config)`.

- [ ] **Step 1: Implement** `HandleLayer` and mount it in the `Stage` snippet.
- [ ] **Step 2: Verify with Playwright** (scratchpad):
  - drag F to the left until the pill shows «No aprueba»;
  - drag the hill foot beyond its limit and check that the amber reason appears;
  - ArrowUp ×4 on C raises h_L by 2 m.
  - Look at the screenshot.

### Task 8: Panel derecho (selección, dictamen, reglas, pasajeros) con campos arrastrables

**Files:**
- Create: `src/components/workshop/SidePanel.svelte`, `src/components/workshop/SelectionPanel.svelte`, `src/components/workshop/RulesPanel.svelte`, `src/components/workshop/ScrubField.svelte`
- Modify: `src/components/lab/VerdictPanel.svelte` (sin cambios de lógica; se monta en el panel)
- Modify: `src/components/lab/TrainPanel.svelte` (botón «Personalizar avatares» abre la capa de la Tarea 5)
- Delete: `src/components/lab/Inspector.svelte`, `src/components/lab/SettingsPanel.svelte`, `src/components/lab/AuditSummary.svelte`, `src/components/lab/FieldControl.svelte`, `src/components/lab/InstrumentCluster.svelte`, `src/components/lab/Gauge.svelte`

**Interfaces:**
- `SidePanel` props:
  ```ts
  { mode: PanelMode | null; title: string; onClose(): void; children: Snippet }
  ```
  - `PanelMode = "selection" | "verdict" | "rules" | "passengers"`;
  - es `aside` con `aria-label={title}`;
  - Esc cierra, salvo que el foco esté en un input con edición en curso;
  - en ≤ 700 px es hoja inferior.
- `ScrubField` props: `{ field: FieldDefinition; config: SimulationConfig; error: string; onInput(value: number): void }`.
  - Arrastrar horizontalmente la etiqueta (`cursor: ew-resize`, pointer capture) suma `step` cada 4 px; Shift ×10.
  - El número es editable.
  - Una barra fina muestra la posición dentro de `limitsOf`.
  - Muestra el `hint`, o el error con `role="alert"`.
- `SelectionPanel` props: `{ area: AreaId; draft; report; errorField; errorMessage; onPatch }`.
  - Arriba muestra el estado del área (`report.areas[area]`).
  - Debajo, los campos de `visibleGroups(draft)` de esa área.
  - En `braking` agrega un segmentado con `BRAKE_OPTIONS` y la distancia necesaria (`report.braking`).
- `RulesPanel` muestra `CONTACT_OPTIONS` (segmentado), los campos de `criteria` y un `<details>` «Precisión numérica» con los de `numeric`.
- Workshop: `onSelect(area)` abre `selection`; `onSelect(null)` lo cierra solo si estaba en `selection`. Cambiar de recorrido limpia una selección que ya no existe.

- [ ] **Step 1: Implement** the panels and mount them in `Workshop`.
- [ ] **Step 2: Run** `npm run check`. Expected: 0 errors; `rg "FieldControl|InstrumentCluster|SettingsPanel" src` returns no imports.
- [ ] **Step 3: Take screenshots** of each panel at 1440×900 and 390×844.

### Task 9: Telemetría plegable, e2e del nuevo flujo y cierre de la fase

**Files:**
- Create: `src/components/workshop/TelemetryDrawer.svelte`
- Modify: `src/components/lab/ChartsDock.svelte` (prop `active: boolean`; sin actualizar con el panel plegado)
- Modify: `src/components/lab/ChartCard.svelte` (actualización ≤ 10 Hz con `HISTORY_FLUSH_INTERVAL_S` heredado del runner; no requiere temporizador propio)
- Rewrite: `tests/e2e/flujo-certificacion.spec.ts` → `tests/e2e/taller.spec.ts`
- Modify: `README.md` («Interfaz») y `docs/ARQUITECTURA.md` (flujo de datos del taller)

**Interfaces:**
- `TelemetryDrawer` props: `{ runner: SimulationRunner; open: boolean (bindable) }`.
  - El encabezado tiene lecturas de v, n (g), E y t con `font-variant-numeric: tabular-nums`, actualizadas desde `runner.history.at(-1)`, que ya va a ≤ 10 Hz.
  - Debajo va `ChartsDock` con `active={open}`.
  - Abierta por defecto si `matchMedia("(min-width: 701px)")`.

- [ ] **Step 1: Write the e2e tests** in `tests/e2e/taller.spec.ts`:
  - `"el taller abre directo con el anexo y aprueba"`;
  - `"arrastrar F a la izquierda rechaza por frenado y un Ctrl+Z lo recupera"`;
  - `"con el panel abierto, arrastrar F sigue sobre la vía y rechaza"`;
  - `"las flechas sobre la cima del loop suben h_L de a 0,5 m"`;
  - `"un valor escrito fuera de rango muestra el error y mantiene el último diseño válido"`;
  - `"pointercancel a mitad del arrastre deja un diseño válido"`;
  - `"pasar de un loop seleccionado a «Línea» cierra el panel y quita las manijas del loop"`;
  - `"el loop circular rechaza por fuerza g y una alternativa verificada lo aprueba"`, todavía vía `FailureDialog`;
  - `"cambiar la masa de un pasajero vuelve a auditar"`;
  - `"«Personalizado» abre el editor y arrastrar un punto vuelve a auditar"`;
  - `"sin desborde horizontal en 1440, 1024, 700 y 390 px y sin errores de consola"`.
- [ ] **Step 2: Run** `npm run e2e`. Expected: all pass. Inspect the screenshots in `output/e2e-results`.
- [ ] **Step 3: Implement** `TelemetryDrawer` and the `active` prop. Update README and ARQUITECTURA.
- [ ] **Step 4: Checkpoint** with `npm test && npm run check && npm run headless && npm run e2e`. Expected: all green. Report to the owner with screenshots and the before/after CPU numbers. Commit only if the owner asks.

---

## Fase 2: auditoría sobre la vía

> Hallazgo previo: el motor detiene el recorrido en el primer incumplimiento (`status: "rejected"`). La reproducción ya se pausa ahí; la fase solo agrega que el pin lo señale.

### Task 10: Perfil de fuerza g por tramo y tramos de color

**Files:**
- Create: `src/lib/load-profile.ts`
- Test: `tests/load-profile.test.js`

**Interfaces:**
- Produces:
  ```ts
  export interface LoadBin { from: number; to: number; min: number; max: number }
  export type LoadTone = "comfort" | "near" | "over" | "float";
  export interface RibbonRun { tone: LoadTone; from: number; to: number; points: { x: number; y: number; angle: number }[] }
  export const LOAD_BIN_M = 0.5;
  export function loadProfile(history: SimulationState[], track: Track, binSize?: number): LoadBin[];
  export function loadTone(bin: Pick<LoadBin, "min" | "max">, config: SimulationConfig): LoadTone;
  export function ribbonRuns(profile: LoadBin[], track: Track, config: SimulationConfig): RibbonRun[];
  ```
- **`loadProfile`:**
  - Recorre los pares consecutivos del historial.
  - Cada par aporta `min` y `max` de sus dos cargas a todos los tramos de `binSize` que cubre, así no hay huecos a alta rapidez.
  - Los regresos (rebote del resorte) también suman.
  - Devuelve los tramos con datos, en orden.
- **`loadTone`:** el límite inferior es `strict ? 0 : minLoad`. La prioridad es esta:

  | Tono | Condición |
  |---|---|
  | over | `max > maxLoad` o `min < inferior` (estricto: `min ≤ 0`) |
  | near | `max ≥ 0,9·maxLoad` |
  | float | `min < 0,2` |
  | comfort | todo lo demás |

- **`ribbonRuns`:** une los tramos contiguos del mismo tono. Los puntos salen de `track.points` dentro de `[from, to]` más los extremos con `geometryAt`.

- [ ] **Step 1: Write the failing tests:**
  - `"el anexo aprobado no tiene tramos excedidos y el perfil cubre del inicio a la detención"`;
  - `"el loop circular tiene tramos excedidos dentro del loop"`;
  - `"no quedan huecos entre tramos consecutivos aunque el tren avance más de 0,5 m por muestra"`;
  - `"loadTone ordena excede > cerca > flotación > cómoda"`, con los valores exactos de la tabla;
  - `"ribbonRuns une tramos contiguos del mismo tono"`.
- [ ] **Step 2:** Run `npx vitest run tests/load-profile.test.js`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.

### Task 11: Franja de fuerza g en el lienzo y leyenda

**Files:**
- Modify: `src/ui/renderer/track.js` (nueva `drawLoadRibbon`; se quita `drawAuditPins`)
- Modify: `src/ui/renderer/index.js` (`Scene.ribbon?: RibbonRun[]`, `Scene.ghostTrack?: Track`; nueva `drawGhostTrack`)
- Modify: `src/ui/renderer/palette.js` (colores `loadComfort`, `loadNear`, `loadOver`, `loadFloat`, `ghost`)
- Create: `src/components/workshop/LoadLegend.svelte`
- Modify: `Stage.svelte`, `Workshop.svelte`

**Interfaces:**
- **`drawLoadRibbon`:** dibuja cada `RibbonRun` desplazada 0,9 m hacia el interior de la vía con `offsetPoint`, 5 px de grosor y extremos redondeados, después de la capa estática y antes del tren.
- **`drawGhostTrack`:** dibuja `ghostTrack.points` punteado, en verde, de 3 px.
- **Perfil:** se calcula con el historial del resultado auditado y solo si `result.key` coincide con la configuración visible. Si se está editando y no hay resultado vigente, no hay franja.
- **`LoadLegend`:**
  - píldora abajo al centro con los cuatro tonos, el límite vigente y un botón que muestra u oculta la franja (`aria-pressed`);
  - en ≤ 700 px queda solo el botón con un punto de color.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Take screenshots of the annex (no red) and the circular loop (red on the loop) at 1440×900. Expected: the band can be read without covering the rails.

### Task 12: Pines DOM y popover de correcciones con vista fantasma

**Files:**
- Create: `src/lib/fix-search.svelte.ts` (búsqueda en Worker con respaldo en el hilo principal)
- Create: `src/lib/fix-text.ts` (títulos, cambios y porqués extraídos de `FailureDialog.svelte`)
- Create: `src/components/workshop/IssuePins.svelte`, `src/components/workshop/FixPopover.svelte`
- Modify: `src/components/lab/VerdictPanel.svelte` (sin `FailureDialog`; cada problema y el botón «Ver dónde falla» llaman a `onShowIssue(index)`)
- Delete: `src/components/FailureDialog.svelte`
- Test: `tests/fix-text.test.js`, `tests/fix-search.test.js`

**Interfaces:**
- Produces:
  ```ts
  export interface FixOption { config: SimulationConfig; changes: FixChange[]; time: number; maxLoad: number; minLoad: number }
  export interface FixChange { key: string; label: string; unit: string; before: number | null; after: number | null }
  export class FixSearch { status: "idle" | "searching" | "done" | "error"; tested: number; total: number; options: FixOption[]; reason: string;
    start(config: SimulationConfig): void; stop(): void }
  export function fixTitle(option: FixOption): string;          // «Aumentar altura del loop», «Combinar ajustes del recorrido»
  export function changeText(change: FixChange): string;        // «h_L: 21,5 → 24 m»
  export function changeReason(change: FixChange): string;      // porqué físico (texto actual de FailureDialog)
  ```
- **`FixSearch`:**
  - Crea `recommendation.worker.js` y, sin Worker, recorre `recommendationSearch` en el hilo principal por lotes con `setTimeout(0)`.
  - Un `start` nuevo cancela el anterior.
  - Los resultados se memorizan por `JSON.stringify(config)`: reabrir el popover del mismo diseño no repite la búsqueda.
- **`IssuePins`:**
  - Muestra un `<button>` por `report.issues[i]`, en `(toX(x), toY(y))`, con pulso CSS y `aria-label="Problema: {title}"`.
  - El pin elegido abre `FixPopover`, anclado y acotado al lienzo.
  - Se ocultan durante la reproducción.
  - Cuando la reproducción termina rechazada, el pin hace un «ping» de 2 s.
- **`FixPopover`:**
  - Muestra el título y el detalle del problema y el porqué de `explainFailure(result.final, config).explanation`.
  - Muestra «Correcciones verificadas» con progreso («Comprobando 12 de 160…»).
  - Cada opción tiene su título, sus cambios y dos botones:
    - «Ver»: alterna la pista fantasma, y también se activa al pasar el cursor;
    - «Aplicar»: llama a `session.applyRecommendation` y cierra el popover.
  - Esc o ✕ lo cierran.
- **Workshop:** guarda `openIssue: number | null` y `ghost: SimulationConfig | null`. Un cambio de diseño cierra el popover.

- [ ] **Step 1: Write the failing tests:**
  - `fix-text`: `"un solo cambio que aumenta se titula «Aumentar …»"`, `"varios cambios se titulan «Combinar ajustes del recorrido»"` y `"changeText usa símbolo, coma decimal y unidad"`;
  - `fix-search`, sin Worker: `"el loop circular encuentra al menos una corrección que aprueba"`, cuyo `options[0].config` debe aprobar con `runSimulation`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Move the texts from `FailureDialog` to `fix-text.ts` without rewriting them.
- [ ] **Step 4:** Run `npm test` and `npm run check`. Expected: all green.

### Task 13: Lectura al pasar el cursor

**Files:**
- Create: `src/lib/probe.ts`
- Create: `src/components/workshop/TrackProbe.svelte`
- Modify: `Stage.svelte`
- Test: `tests/probe.test.js`

**Interfaces:**
- Produces:
  ```ts
  export interface ProbeReadout { distance: number; time: number; speed: number; load: number; normalKn: number; section: string }
  export function probeAt(history: SimulationState[], track: Track, distance: number): ProbeReadout | null;
  export function probeLines(readout: ProbeReadout | null): string[];
  ```
- **`probeAt`:** se calcula con `interpolateAtDistance` (primer paso por ese punto); devuelve `null` si el tren no llega.
- **`probeLines`:**
  - con lectura: `["s = 84,2 m · t = 3,1 s", "v = 14,2 m/s · 3,12 g · N = 17,8 kN"]`;
  - con `null`: `["El tren no llega hasta aquí"]`.
- **`TrackProbe`:** punto sobre la vía y etiqueta. Aparece solo sin reproducción, arrastre ni paneo, con el cursor a ≤ 14 px de la vía y con un resultado vigente.

- [ ] **Step 1: Write the failing tests:**
  - `"la lectura en la cima del loop coincide con el resumen del punto C"`;
  - `"más allá de la detención no hay lectura"`;
  - `"probeLines da formato con coma decimal y unidades"`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.

### Task 14: e2e, documentación y cierre de la fase

**Files:**
- Modify: `tests/e2e/taller.spec.ts`
- Modify: `README.md`, `docs/ARQUITECTURA.md`

- [ ] **Step 1: Update the e2e tests:**
  - `"el loop circular muestra un pin; su popover ofrece correcciones verificadas, «Ver» dibuja la pista fantasma y «Aplicar» aprueba (Ctrl+Z vuelve)"`;
  - `"pasar el cursor por la vía muestra v, g y N"`;
  - `"la leyenda oculta y muestra la franja de fuerza g"`.
- [ ] **Step 2:** Run `npm run e2e`. Expected: all pass.
- [ ] **Step 3: Checkpoint.** Run `npm test && npm run check && npm run headless && npm run e2e`. Expected: all green. Then take and check screenshots and measure idle CPU (expected 0 %).

## Fase 3: personalizado sobre el lienzo y pasajeros en el panel

> Los pendientes menores que aparezcan se anotan en `docs/superpowers/pendientes.md` (pedido del dueño); los importantes se corrigen dentro de la fase.

### Task 15: Operaciones puras sobre los puntos del trazado personalizado

**Files:**
- Create: `src/lib/custom-points.ts`
- Test: `tests/custom-points.test.js`

**Interfaces:**
- Produces:
  ```ts
  export interface PointEdit { points: TrackPoint[]; limited: boolean; reason: string | null }
  export interface PointHandle { id: string; kind: "point" | "loopTop" | "loopRadius"; index: number; x: number; y: number; fixed: boolean; anchor?: { x: number; y: number } }
  export const CUSTOM_TEMPLATES: { id: string; label: string; build: (H: number) => TrackPoint[] }[];   // Valle, Doble colina, Loop central (movidas del editor)
  export function movePoint(config: SimulationConfig, index: number, x: number, y: number): PointEdit;      // x, y en metros
  export function insertPoint(config: SimulationConfig, x: number, y: number): { points: TrackPoint[]; index: number } | { error: string };
  export function removePoint(config: SimulationConfig, index: number): TrackPoint[] | null;
  export function setPointLoop(config: SimulationConfig, index: number, height: number, radius: number): PointEdit;
  export function toggleLoop(config: SimulationConfig, index: number): PointEdit;
  export function pointHandles(track: Track, config: SimulationConfig): PointHandle[];
  ```
- **Coordenadas:** los puntos son relativos (`x·W`, `y·H`).
- **`movePoint`:**
  - Los extremos no se mueven.
  - `x` se limita entre los vecinos ± `CUSTOM_LIMITS.minSpacing`; `y` a `[0, 1]`.
  - Si el trazado no se construye, se biseca el desplazamiento hasta el último construible, y `reason` lleva el mensaje legible.
- **`insertPoint`:**
  - Ubica el punto entre sus vecinos.
  - Da error con 9 puntos o si no hay separación.
- **`removePoint`:** no borra extremos y mantiene al menos 3 puntos.
- **`setPointLoop`:**
  - Respeta `2R ≤ h_L ≤ 20R` y los rangos de configuración.
  - Admite un máximo de 3 loops; el error dice «Ya hay 3 loops».
  - La altura se biseca si el loop no cabe.
- **`toggleLoop`:** agrega un loop de `min(12, 0,55·H)` m con R = h_L/4, o lo quita.
- **`pointHandles`:**
  - Una manija por punto, con los extremos `fixed`.
  - Por cada punto con loop, las manijas de cima y radio, con la cima tomada del k-ésimo marcador `loop-top`.

- [ ] **Step 1: Write the failing tests:**
  - límites de `movePoint` y extremos fijos;
  - loop que choca → `limited` con motivo y trazado construible;
  - `insertPoint` en orden, máximo 9 y separación;
  - `removePoint` con extremos y mínimo;
  - cuarto loop rechazado;
  - forma del loop limitada;
  - `pointHandles` del personalizado por defecto y con un loop.
- [ ] **Step 2: Run the tests.** Expected: FAIL. Then implement.
- [ ] **Step 3: Run the tests again.** Expected: PASS.

### Task 16: Editar el personalizado sobre el lienzo

**Files:**
- Create: `src/components/workshop/PointLayer.svelte` (manijas 2D, manijas de loop y mini barra del punto elegido), `src/components/workshop/PointPanel.svelte` (x, y, loop h_L/R, borrar, plantillas)
- Modify: `Stage.svelte` (doble clic en la vía del personalizado inserta un punto; en los demás recorridos encuadra), `Workshop.svelte` (`selectedPoint`)
- Delete: `src/components/TrackEditor.svelte`, `src/styles/track-editor.css`, el modal del editor y el botón «Editar puntos»

**Interfaces:**
- Consumes: Task 15. Cada arrastre usa `session.beginGesture/endGesture` y `session.patch({ customPoints }, { discardInvalid: true })`.
- **Selección:** elegir un punto abre el panel `selection` con `PointPanel` («Punto 3 de 5»).
- **Mini barra:** flota sobre el punto elegido, con «Agregar loop» / «Quitar loop» y «Borrar punto».
- **Esc:** deselecciona.
- **Teclado:** cada manija de punto es `role="button"`; las flechas la mueven 1 m (Shift: 10 m) y Supr la borra.

- [ ] **Step 1: Write the e2e tests:**
  - «Personalizado: arrastrar un punto vuelve a auditar y un Ctrl+Z lo deshace»;
  - «doble clic sobre la vía agrega un punto»;
  - «la mini barra agrega un loop con sus manijas y borra un punto».
- [ ] **Step 2: Run the tests.** Expected: FAIL. Then implement.
- [ ] **Step 3: Run the tests again.** Expected: PASS; take screenshots at 1440 and 390.

### Task 17: Pasajeros y avatares dentro del panel

**Files:**
- Create: `src/components/workshop/PassengerEditor.svelte` (compacto, carga diferida con `import()` desde el panel)
- Delete: `src/screens/Passengers.svelte`, `src/components/lab/TrainPanel.svelte`, `src/styles/passengers.css` (antes, comprobar qué clases usan otros componentes)
- Modify: `Workshop.svelte`, `src/main.ts`

**Interfaces:**
- **Contenido del panel «Tren y pasajeros»:**
  - masa del carrito;
  - cantidad de pasajeros (1 a 4);
  - asientos con avatar, donde tocar uno lo elige;
  - para el pasajero elegido: avatar con reacciones (tranquilo / 0 g / 5 g), nombre, pestañas Rostro · Cabello · Ropa · Accesorios y masa.
- **Cambios:** llegan como `session.setPassengers(...)`; arrastrar la masa es un solo paso de deshacer.

- [ ] **Step 1: Write the e2e tests:**
  - «el panel de pasajeros cambia la cantidad, el peinado y la masa sin salir del taller»;
  - ajustar la prueba existente de masa y avatares.
- [ ] **Step 2: Run the tests.** Expected: FAIL. Then implement.
- [ ] **Step 3: Run the tests again.** Expected: PASS; take screenshots at 1440 and 390.

### Task 18: Cierre de la fase

- [ ] **Checkpoint:** run `npm test && npm run check && npm run headless && npm run e2e`. Expected: all green.
- [ ] Update README §7 and ARQUITECTURA.
- [ ] Measure idle CPU (expected 0 %).
- [ ] Run a fresh review.
- [ ] Record minors in `pendientes.md`.

## Fase 4: recursos y cierre

> Los pendientes menores se anotan en `docs/superpowers/pendientes.md`. Al cerrar la fase se atacan todos (pedido del dueño).

**Medición inicial (build del 25/11, antes de la fase):**
- JS principal: 497,8 KB (168,5 KB gzip). Incluye el taller, Chart.js, el reporte y la guía aunque el menú no los use.
- Imágenes del menú: 2,7 MB (logo PNG de 1254 px: 2,0 MB; GIF de fondo: 712 KB).
- Íconos de instalación: 624 KB (sin uso en la carga normal).

### Task 19: Imágenes livianas

**Files:**
- Create:
  - `public/assets/images/coaster-certifier-logo.webp` (512 px, calidad 82);
  - `public/assets/backgrounds/coaster-menu-fondo.mp4` (H.264, CRF 28, `+faststart`, sin audio);
  - `public/assets/backgrounds/coaster-menu-fondo-poster.webp` (primer cuadro, calidad 70).
- Modify:
  - `src/screens/Menu.svelte`: `<video>` de fondo y logo WebP con `width`/`height`;
  - `src/app.css`: el fondo pasa del GIF al póster y al degradado;
  - `index.html`: precarga del póster;
  - `public/site.webmanifest`: nombre de la app;
  - `public/android-chrome-*.png` y `public/apple-touch-icon.png`, cuantizados a 256 colores.
- Delete: `coaster-certifier-logo.png` y `coaster-menu-fondo.gif`, solo si nada más los usa.
- Test: `tests/assets.test.js` y e2e en `tests/e2e/taller.spec.ts`.

**Interfaces:**
- **Presupuesto:** `MENU_IMAGE_BUDGET_BYTES = 300 * 1024` suma lo que el menú descarga: logo, póster, video y los favicons que enlaza `index.html`.
- **Video de fondo:** `muted loop playsinline autoplay`, `aria-hidden`, `poster`, `object-fit: cover`.
- **Movimiento reducido:** con `prefers-reduced-motion: reduce` no se monta el `<video>` y queda el póster.
- **Taller:** el menú se desmonta al entrar al taller, así que ahí no se decodifica nada.

- [ ] **Step 1: Write the failing tests:**
  - `tests/assets.test.js`:
    - «lo que descarga el menú pesa menos de 300 KB»: lee `index.html` y `Menu.svelte`, toma las rutas `/assets/...` y `/favicon*` y suma sus tamaños en `public/`.
    - «el menú no usa GIF ni PNG grandes»: ninguna imagen referenciada pesa más de 150 KB.
  - e2e:
    - «el menú muestra el logo y el video de fondo»: el `img.menu-logo` tiene `naturalWidth > 0`; el `video` tiene `poster` y `muted`.
    - «con movimiento reducido el menú no reproduce video»: con `page.emulateMedia({ reducedMotion: "reduce" })` hay 0 `video`.
- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Encode the assets with ffmpeg and Pillow, then update the components.**
- [ ] **Step 4: Run the tests again.** Expected: PASS; take screenshots of the menu at 1440 and 390.

### Task 20: Carga bajo demanda

**Files:**
- Create: `src/lib/lazy-module.svelte.ts`
- Modify:
  - `src/App.svelte`: `Workshop` diferido, precargado en reposo desde el menú;
  - `src/screens/Workshop.svelte`:
    - `ReportDialog`, `Guide` y `PassengerEditor` diferidos;
    - `retryPassengerEditor` pasa a `LazyModule`;
  - `src/components/workshop/Stage.svelte`: `FixPopover` diferido;
  - `src/components/workshop/TelemetryDrawer.svelte`: `ChartCard` y Chart.js diferidos.
- Test: `tests/lazy-module.test.js`, e2e.

**Interfaces:**
- Produces:
  ```ts
  export class LazyModule<T> {
    constructor(loader: () => Promise<T>, importUrl?: (url: string) => Promise<T>);
    promise: Promise<T> | null;          // $state; null hasta el primer load()
    load(): Promise<T>;                  // idempotente: una sola descarga
    retry(error: unknown): void;         // usa retryUrl(error, n) y, si no hay URL, el loader
  }
  ```
- **Diálogos:** `ReportDialog` y `Guide` se montan la primera vez que se piden y se abren al montarse (`open()` en `onMount` del envoltorio), así que no hay un clic perdido.
- **Errores de carga:** cada `{#await}` tiene `{:catch}` con «Reintentar».
- **Precarga del taller:** se precarga con `requestIdleCallback`, o `setTimeout` de 1500 ms si no existe. Así «Diseñar y certificar» abre al instante.

- [ ] **Step 1: Write the failing tests:**
  - `tests/lazy-module.test.js`:
    - «load descarga una sola vez»;
    - «retry pide la URL con ?retry=n cuando el error la trae»;
    - «retry vuelve al loader cuando el error no trae URL».
  - e2e:
    - «el menú no descarga el taller ni Chart.js»: se registran las peticiones `*.js` hasta que el menú está visible; ninguna es `Workshop-*` ni `chart*`.
    - «el reporte y la guía se descargan al pedirlos y abren al primer clic».
- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests again.** Expected: PASS. Then `npm run build` and record the chunk sizes; expected: the main JS is smaller than 120 KB gzip.

### Task 21: Código y CSS muertos

**Files:** se definen tras el relevamiento. Se usa un script de un solo uso en `.superpowers/` que lista:
- módulos de `src/` que nadie importa;
- exportaciones sin uso fuera de `src/physics/`;
- clases de `src/app.css` y `src/styles/*.css` que no aparecen en ningún `.svelte`, `.ts`, `.js` ni `index.html`;
- variables CSS sin uso.

**Interfaces:** ninguna nueva. Lo borrado no rompe `npm test`, `npm run check` (0 warnings), `npm run headless` ni el e2e.

- [ ] **Step 1: Run the survey script** and record the list in the ledger.
- [ ] **Step 2: Delete** the code and CSS that are confirmed unused. Before deleting each class, check it with `grep` (it can be built dynamically, e.g. `class:` or template strings).
- [ ] **Step 3: Checkpoint.** Run `npm test && npm run check && npm run headless && npm run e2e`. Expected: all green.

### Task 22: Medición, documentación y cierre

- [ ] Measure CPU with CDP while idle and while playing (expected: 0 % idle).
- [ ] Measure bundle and images, and compare against the initial measurement.
- [ ] Replace the screenshots in `docs/img`:
  - taller;
  - correcciones;
  - personalizado;
  - pasajeros;
  - teléfono;
  - reporte.
- [ ] Update README and `docs/ARQUITECTURA.md` (carga diferida, recursos y mediciones).
- [ ] Run the full e2e.
- [ ] Run a fresh review of the phase.
- [ ] Fix the important findings with tests; record the minors in `pendientes.md`.
