# Arquitectura

```
┌──────────────────────────── Interfaz (Svelte 5) ────────────────────────────┐
│ screens/Setup → Passengers → Simulation                                      │
│   Simulation.svelte  (orquestador)                                           │
│     ├─ lib/simulation-runner.svelte.ts   bucle de animación, historial       │
│     ├─ components/lab/SettingsPanel      parámetros (lib/field-definitions)  │
│     ├─ components/lab/StagePanel ──────► ui/renderer/* (Canvas 2D)           │
│     ├─ components/lab/ChartsPanel ─────► ui/charts/*   (Chart.js)            │
│     ├─ components/lab/VerdictPanel ────► FailureDialog ─► Web Worker         │
│     ├─ components/lab/MetricsPanel                         │                 │
│     └─ components/lab/ReportDialog ────► ui/export (CSV/JSON/PDF)            │
└──────────────────────────────────────────┬───────────────────┼───────────────┘
                                           ▼                   ▼
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
5. **Eventos exactos.** El integrador localiza por bisección los puntos de retorno y las entradas a la zona de frenado, por lo que el dictamen no depende del paso de reporte.

## Flujo de datos en la interfaz

```
SettingsPanel (borrador) ──Aplicar──► resolveConfig ──► buildTrack ──► createInitialState
                                                                          │
      requestAnimationFrame ──► runner.tick(Δt) ──► step() × n ──► state, history
                                                                          │
                       StagePanel ◄── renderSimulation(canvas, scene) ◄───┤
                       ChartsPanel ◄── updatePhysicsChart(history) ◄──────┤
                       MetricsPanel ◄── viewState (actual o línea de tiempo)
                       VerdictPanel ◄── evaluateRun(history) (al detenerse)
                       ReportDialog ◄── verdict.summary, toCsv(history)
```

## Decisiones

- **RK4 con subpasos ≤ 1 ms** en lugar de Euler: permite verificar la conservación de la energía a 1e-4 y que las pruebas analíticas con aceleración constante sean exactas.
- **Loop en lágrima parametrizado por (h_L, R)**: reproduce los parámetros del anexo y permite demostrar numéricamente que un loop circular siempre supera 5 g (Tabla 5 del anexo: 6,6 g) mientras una lágrima de igual altura aprueba.
- **Colina construida a partir de (h_c, ρ_c)**: el radio en la cresta es exacto (`ρ_c = w²/6h_c`), por lo que `n_D = 1 − v_D²/(g·ρ_c)` se puede comprobar analíticamente.
- **Dos modelos de contacto**: estricto (`N > 0`, plan del Avance 1) y ruedas de seguridad (anexo: `N` puede ser negativa fuera del loop, `n ≥ −1 g`).
- **Recomendaciones verificadas**: las alternativas se calculan con la física del fallo (energía, curvatura, frenado) y luego se comprueban simulando el recorrido completo; nunca se ofrece una sin verificar.
