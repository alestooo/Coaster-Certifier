# Arquitectura

```
┌──────────────────────────── Interfaz (Svelte 5) ─────────────────────────────┐
│ screens/Menu ··· screens/Workshop  (taller de una sola pantalla)             │
│   lib/design-session.svelte.ts   borrador, commit ≤ 120 ms, deshacer, masas  │
│     ├─ lib/simulation-runner     reproducción (historial a ≤ 10 Hz)          │
│     └─ lib/live-audit ─────────► ui/audit.worker.js (Web Worker)             │
│   components/ui/  controles comunes (SliderField, NumberField, Select,       │
│     Segmented, Tabs, Disclosure, Dialog, ActionMenu, Button, IconButton,     │
│     Meter, CheckMark, Sym) ◄── lib/ui/* (escala del slider, teclado, menús)  │
│   components/workshop/                                                       │
│     ├─ WorkshopBar + TemplatePicker   trazados, escenarios, dictamen         │
│     ├─ Stage ──────────────────► ui/renderer/* (Canvas 2D, bajo demanda)     │
│     │    ├─ (subida) ──────────► ui/renderer/lift (una polilínea hasta A)    │
│     │    ├─ HandleLayer ───────► lib/handles (manijas puras, en metros)      │
│     │    ├─ LoadLegend · franja ► lib/load-profile (fuerza g por tramo)      │
│     │    │    └─ PointLegend ──► lib/point-legend (qué es cada letra A–F)    │
│     │    ├─ IssuePins ··· FixPopover ► lib/fix-search ► recommendation.worker│
│     │    ├─ TrackProbe ────────► lib/probe (v, g, N en un punto)             │
│     │    └─ PointLayer ────────► lib/custom-points (trazado personalizado)   │
│     ├─ SidePanel: Selection · Point · Rules · VerdictPanel · PassengerEditor │
│     └─ TelemetryDrawer ··· ChartCard ► ui/charts/* (Chart.js)                │
│   lab/ReportDialog ············► ui/export (CSV/JSON/PDF)                    │
│   ··· = se descarga la primera vez que se pide (lib/lazy-module)             │
└──────────────────────────────────────────┬───────────────────────────────────┘
                                           ▼
┌──────────────────────── Librería de física (src/physics) ───────────────────┐
│ config ─► track/{layouts,builder,hermite,loop,line,geometry}                 │
│        ─► dynamics/{kinematics,forces,energy}                                │
│        ─► integration/{rk4,step}   ─► evaluation/{criteria,summary,verdict}  │
│        ─► run.js  ─► export/csv.js ─► recommendations/*  ─► scenarios.js     │
└──────────────────────────────────────────┬───────────────────────────────────┘
                                           ▼
                               scripts/headless.js  ·  tests/*.test.js
```

## Principios

1. **La física no conoce la interfaz.** Ningún archivo de `src/physics/` importa nada de `src/ui`, `src/components`, `src/screens` ni usa `document`, `window`, `canvas` o `requestAnimationFrame`. La misma librería corre en el navegador, en un Web Worker, en Node (headless) y en vitest.
2. **Funciones puras e inmutables.** `step(state, config, dt)` devuelve siempre un objeto nuevo; `resolveConfig` copia la entrada; `buildTrack` memoriza por geometría y devuelve un objeto que nadie modifica.
3. **Una sola fuente de verdad.** `CONFIG_LIMITS` define los rangos usados por la validación y por los controles; `SCENARIOS` alimenta la guía de la interfaz, el script headless y las pruebas; `toCsv` produce el mismo archivo desde la interfaz y desde Node.
4. **Capas pequeñas.** Geometría, dinámica, integración, evaluación y presentación viven en módulos de 100–300 líneas con responsabilidades únicas. La interfaz se divide en componentes por panel.
5. **Eventos exactos.** El integrador localiza por bisección las entradas a la zona de frenado, por lo que el dictamen no depende del paso de reporte. Los puntos de retorno (v = 0) se resuelven en forma cerrada cuando la fuerza que se opone al movimiento detiene al tren dentro del subpaso, que es lo habitual: con fricción de Coulomb, las etapas de RK4 cambiarían el signo de la fricción y se anularían, y la velocidad quedaría fija. Si la velocidad cambia de signo de otra forma, el retorno se localiza por bisección.

## Flujo de datos en la interfaz

```
manija (arrastre) ─► proposeDrag ─► límites + forma del loop + bisección al último trazado construible
campo del panel ─────────────────┐                              │
                                 ▼                              ▼
              DesignSession.patch(borrador) ──► preview = buildTrack(borrador)  (pista y manijas al instante)
                                 │ ≤ 120 ms
                                 ▼
                resolveConfig ──► buildTrack ──válido──► runner.apply + LiveAudit ──► audit.worker: runSimulation
                                 │ inválido                                                   │
                                 └─► mensaje junto al campo; se conserva el último válido     ▼
                                                                        buildAudit (lenguaje claro)
         deshacer / rehacer (design-history, un paso por gesto)                     │
                                                                                    ▼
                         píldora de dictamen · panel de la parte · VerdictPanel · ReportDialog · CSV/JSON

createFrameLoop: requestAnimationFrame solo mientras se reproduce, se arrastra o se anima la cámara;
cualquier otro cambio pide un único cuadro ─► renderSimulation(canvas, escena) ─► Camera
                                                                                      │
                     HandleLayer (DOM) ◄── toX/toY · fromX/fromY ◄────────────────────┘
```

## Decisiones

- **RK4 con subpasos ≤ 1 ms** en lugar de Euler: permite verificar la conservación de la energía a 1e-4 y que las pruebas analíticas con aceleración constante sean exactas.
- **Loop en lágrima parametrizado por (h_L, R)**: reproduce los parámetros del anexo y permite demostrar numéricamente que un loop circular siempre supera 5 g (Tabla 5 del anexo: 6,6 g) mientras una lágrima de igual altura aprueba.
- **Colina construida a partir de (h_c, ρ_c)**: el radio en la cresta es exacto (`ρ_c = w²/6h_c`), por lo que `n_D = 1 − v_D²/(g·ρ_c)` se puede comprobar analíticamente.
- **Dos reglas de contacto**: «siempre apoyado» (`N > 0`, plan del Avance 1) y «ruedas anti-levantamiento» (anexo: `N` puede ser negativa fuera del loop, `n ≥ −1 g`).
- **Auditoría en vivo en lugar de «Aplicar»**: un recorrido completo tarda 30–45 ms, así que cada cambio se simula entero en un Web Worker (solo uno en curso; los cambios intermedios se descartan). El dictamen, el informe y las exportaciones salen siempre del recorrido completo, no de lo que alcanzó a reproducir la animación.
- **Edición sobre el lienzo con manijas DOM**: cada parámetro geométrico tiene una manija con un solo grado de libertad, como en los simuladores de PhET o Desmos. Son botones con `role="slider"`, así que se enfocan, se mueven con el teclado y se prueban con Playwright sin hacer pruebas de impacto en el canvas. La conversión arrastre → parámetro (`lib/handles.ts`) es pura y tiene pruebas.
- **Auditoría dibujada sobre la vía**: el perfil de fuerza g se calcula por tramos de 0,5 m a partir del recorrido auditado. Cada par de muestras cubre todos los tramos que recorre, así no quedan huecos a alta rapidez. El motor detiene el recorrido en el primer incumplimiento, así que la franja termina ahí y el pin lo señala. Las correcciones son las mismas alternativas verificadas de `recommendations/`; se buscan una vez por diseño y se previsualizan como pista fantasma antes de aplicarlas.
- **Redibujo bajo demanda**: el lienzo no tiene bucle continuo; `createFrameLoop` dibuja un cuadro por cambio y solo anima mientras se reproduce, se arrastra o se mueve la cámara. En reposo la CPU queda en 0 %. Mientras la escala cambia en cada cuadro (animación de zoom, pellizco o rueda, hasta 200 ms después del último evento) se estira la última capa estática del mismo trazado en lugar de crear una por cuadro; la capa a la escala nueva se crea al terminar el gesto.
- **Carga bajo demanda** (`lib/lazy-module.svelte.ts`, `lib/workshop-parts.ts`):
  - El menú solo trae su propio código (≈ 30 KB gzip con su CSS).
  - El taller se precarga en reposo mientras se mira el menú.
  - Las gráficas, el informe, la guía, el editor de pasajeros y el popover de correcciones viajan aparte y se precargan en reposo cuando el taller ya está a la vista. Así abren al instante y no dependen de la red, ni de que los archivos de una versión anterior sigan publicados.
  - Cada `import()` pasa por `LazyModule`, que guarda una sola promesa. Si falla, el siguiente pedido reintenta con otra URL, porque el navegador recuerda el `import()` fallido.
  - El CSS de cada componente viaja dentro de su JS (`emitCss: false`): un CSS aparte que falló no se vuelve a pedir.
  - Si falla el taller, se ofrece recargar la página: todavía no hay nada diseñado, y recargar es lo único que repara también los archivos compartidos.
- **Sistema de diseño**: los colores, tipos, espacios, radios y alturas de control son tokens (`src/styles/tokens.css`); los componentes no llevan colores sueltos salvo el arte (avatares, miniaturas, paleta de piel y pelo). Cada tipo de control existe una sola vez en `components/ui/` con su lógica pura en `lib/ui/`, y `tests/ui-architecture.test.js` impide que vuelvan los `<select>` nativos, los campos `type=number`, los glifos de texto y los colores hexadecimales. Las gráficas leen sus colores y su fuente de los mismos tokens (`ui/charts/chart-theme.js`).
- **Números con coma**: todo número que se muestra pasa por `formatNumber` (coma decimal y espacio de miles; `formatSigned` agrega el signo «−»), y todo campo lo lee con `parseDecimal`, que acepta coma o punto. Lo ilegible no cambia el diseño.
- **Escala real**: el tren, los pasajeros (cabeza de 0,23 m, 0,9 m del asiento a la coronilla), la vía, la estación (30 m al final de la zona de frenado) y la feria se dibujan con `camera.scale`, sin mínimos en píxeles. Solo las capas de información (franja de fuerza g, estela, pines) tienen tamaño fijo en pantalla, y rieles y larguero un piso de 1 px para que la vía no desaparezca en el teléfono. Si el tren mide menos de 12 px, un halo con flecha lo señala sin agrandarlo. El suelo dibujado queda 1 m bajo la vía: la vía a nivel apoya en zapatas y el andén queda a la altura del riel.
- **Una sola subida hasta A** (`ui/renderer/lift.js`): una polilínea del suelo hasta A, con un empalme de hasta 2,5 m de radio que no sube más de 0,3 m sobre A. La usan los rieles, la cadena, los trinquetes, los eslabones (a 2 m/s), los soportes, la casa de máquinas, el despeje de los árboles, el encuadre y los carros que todavía están detrás de A.
- **Recursos livianos**: Chart.js registra solo lo que usan las gráficas (líneas, escala lineal, leyenda y tooltip). El menú usa un logo WebP de 512 px y un video MP4 con póster en lugar del PNG de 2 MB y el GIF de 712 KB. `tests/assets.test.js` impide que lo que descarga el menú vuelva a pasar de 300 KB.
- **Recomendaciones verificadas**: las alternativas se calculan con la física del fallo (energía, curvatura, frenado) y luego se comprueban simulando el recorrido completo; nunca se ofrece una sin verificar. Cada escenario de referencia que falla recibe al menos una (prueba en `tests/engine.test.js`).
