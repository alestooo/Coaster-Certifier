# Coaster-Certifier

**Certificador de montañas rusas**: simulador web con librería de física propia, pruebas de validación analítica, dictamen de aprobación o rechazo y ejecución *headless* con exportación a CSV.

Proyecto de Simulación · Física I (FUN-18) · Universidad CENFOTEC · 2026-C3 · **Grupo A**: Alejandro Soto Víquez, Dylan Josué Chaves Hernández y Minor Andrés Mora Vargas. Docente: Andrés Castro Núñez.

- **Aplicación desplegada:** https://coaster-certifier.vercel.app
- **Repositorio público:** https://github.com/alestooo/Coaster-Certifier

---

## 1. Comandos

| Acción | Comando |
| --- | --- |
| Instalar dependencias | `npm install` |
| Ejecutar las pruebas (unitarias + validación analítica) | `npm test` |
| Pruebas con informe de cobertura de la librería | `npm run test:coverage` |
| Ejecución *headless* (escribe `output/certification.csv` y `output/certification.summary.json`) | `npm run headless` |
| *Headless* con otro escenario / paso / carpeta | `npm run headless -- --scenario valley --dt 0.005 --out salida` |
| *Headless* con una configuración propia en JSON | `npm run headless -- --config mi-trazado.json` |
| Listar los escenarios de referencia | `npm run headless -- --list` |
| Servidor de desarrollo | `npm run dev` |
| Compilar para producción | `npm run build` |
| Verificación de tipos (Svelte + JSDoc) | `npm run check` |

Requiere Node.js ≥ 18.17. No usa ningún motor físico de terceros: toda la física está en `src/physics/`. Las únicas librerías externas de la interfaz son Svelte (interfaz) y Chart.js (gráficas).

## 2. Estructura del repositorio

```
src/physics/                 ← LIBRERÍA DE FÍSICA (pura, determinista, sin DOM)
  index.js                   API pública (re-exporta todo lo documentado abajo)
  constants.js               g, límites del anexo, parámetros numéricos
  config.js                  DEFAULT_CONFIG, CONFIG_LIMITS, resolveConfig(), ConfigError
  scenarios.js               escenarios de referencia con dictamen esperado
  track/                     geometría: Hermite, loop en lágrima, plano inclinado, colina, buildTrack(), geometryAt()
  dynamics/                  kinematics.js (fórmulas elementales), forces.js, energy.js
  integration/               rk4.js, step.js (createInitialState, step) con localización de eventos
  evaluation/                criteria.js (incumplimientos), summary.js (extremos, tramos, puntos A–F), verdict.js (dictamen)
  export/csv.js              toCsv() — compartido por el script headless y la interfaz
  recommendations/           búsqueda verificada de alternativas que aprueban
  run.js                     runSimulation(): recorrido completo + dictamen
tests/                       vitest: analytical, track, config, engine, scenarios
scripts/headless.js          ejecución sin interfaz → CSV + JSON + reporte en consola
src/ui/                      renderizado Canvas 2D (renderer/), gráficas Chart.js (charts/), exportación
src/components/, src/screens/, src/lib/, src/game/   interfaz Svelte 5 (consume la librería; nunca implementa ecuaciones)
docs/                        arquitectura y borrador de la entrega
```

La interfaz consume la librería; la librería no sabe que la interfaz existe. Si se borra `src/ui`, `src/components`, `src/screens` y `src/lib`, `npm test` y `npm run headless` siguen funcionando.

## 3. Modelo físico

Tren modelado como **partícula de masa m** sobre una **vía rígida en un plano vertical**, descrita por la coordenada de recorrido `s` (m), la inclinación de la tangente `θ(s)` (rad, positiva subiendo) y la curvatura con signo `κ(s) = dθ/ds` (1/m, positiva en valles y loops, negativa en crestas). Gravedad uniforme `g = 9,81 m/s²`. Unidades del SI en toda la librería.

**Segunda ley de Newton** en el sistema intrínseco (tangente, normal):

```
m·dv/dt = −m·g·sin θ − f − F_freno + F_resorte + F_amortiguador        (tangencial)
N       = m·(g·cos θ + κ·v²)                                              (normal)
```

| Magnitud | Expresión | Función |
| --- | --- | --- |
| Carga sobre los pasajeros (g) | `n = N / (m·g) = cos θ + κ·v²/g` | `loadFactor` |
| Fricción efectiva (rodadura + aire) | `f = μ·|N|`, opuesta al movimiento (estática cuando v = 0) | `frictionMagnitude`, `resistiveForce` |
| Frenos de estación | desaceleración constante `a_f` en E→F; `d_det = v_E²/(2·a_f)`, `t_f = v_E/a_f` | `brakingDistance`, `brakingTime` |
| Resorte de frenado | `F = −k·x`, `E_e = ½·k·x²`; amortiguador opcional `F = −c·v` | `springForce`, `damperForce`, `elasticEnergy` |
| Energías | `E_c = ½·m·v²`, `E_p = m·g·y`, `E_m = E_c + E_p + E_e`, `E_m(t) + E_dis(t) = E_m(0)` | `calculateEnergies` |
| Energía disipada | `dE_dis/dt = |f·v| + |F_freno·v| + |F_amort·v|` integrada junto con el movimiento | `step` |
| Contacto en la cima del loop | `N ≥ 0 ⇔ v_C² ≥ g·R` | `loopTopMinimumSpeed`, `evaluateState` |

**Geometría del trazado**

- Tramos entre nodos: polinomios cúbicos de **Hermite** y(x) con pendiente final nula (valles y crestas suaves, curvatura continua). La coordenada `s` se obtiene de una tabla de longitud de arco de 400 muestras por tramo.
- **Loop en lágrima**: familia con radio de curvatura `ρ(θ) = R_ref·(1 + c·cos θ)`. El usuario fija la altura `h_L` y el radio en la cima `R` (como en el anexo): `R_ref = h_L/2`, `c = 1 − 2R/h_L`, radio en la base `R_B = h_L − R`, longitud `2π·R_ref`, salida desplazada `π·c·R_ref`. Con `R = h_L/2` el loop es circular. Debe cumplirse `h_L ≥ 2R`.
- **Colina** de altura `h_c` y radio de curvatura en la cresta `ρ_c`: dos tramos de Hermite de semiancho `w = √(6·h_c·ρ_c)`, de modo que `ρ_c = w²/(6·h_c)` exactamente.
- **Plano inclinado**: recta de A al suelo (caso con solución cerrada, usado en las pruebas).
- Tras el último nodo: aproximación horizontal de 8 m y zona de frenado de longitud `d_f`.

**Método numérico**

- Integrador **Runge–Kutta 4** sobre el vector `[s, v, E_dis]` con paso ≤ `maxSubstep` (0,001 s por defecto, como propone el anexo) y ≤ 3 % del período del resorte.
- **Localización de eventos por bisección** (35 iteraciones): puntos de retorno `v = 0`, entrada exacta a la zona de frenado, fin de la zona y retorno al inicio. Los frenos de estación se integran de forma cerrada (MRUA) desde la entrada exacta.
- Los criterios se evalúan tras cada subpaso: el instante de un incumplimiento tiene error ≤ 1 ms.
- Funciones **puras y deterministas**: mismo estado + mismo `dt` ⇒ mismo resultado; nunca se modifica la entrada. No hay aleatoriedad.

**Criterios del dictamen** (`evaluateState`, `evaluateRun`)

| Código | Condición | Estado |
| --- | --- | --- |
| `contact` | N > 0 en toda la vía (modelo estricto) | `lost-contact` |
| `loop-contact` | N > 0 dentro del loop (modelo con ruedas de seguridad) | `lost-contact` |
| `max-load` | n ≤ n_máx (+5 g) | `rejected` |
| `min-load` | n ≥ n_mín (−1 g; solo con ruedas de seguridad) | `rejected` |
| `compression` | x ≤ x_máx | `rejected` |
| `overrun` | detención antes del fin de la zona de frenado | `rejected` |
| `min-speed` | v > v_mín (0,5 m/s) en subida antes de E | `stalled` |
| `reverse` | el tren regresa a A y queda retenido | `stalled` |
| `timeout` | detención antes de t_máx (un resorte ideal rebota indefinidamente) | `timeout` |

Un trazado se **aprueba** únicamente si el tren termina detenido dentro de la estación sin ningún incumplimiento. Cada incumplimiento registra condición, instante (s), tramo, posición s (m), posición (x, y), valor con unidad y límite exigido.

## 4. API pública de la librería (`src/physics/index.js`)

Todas las funciones reciben y devuelven unidades del SI. Los objetos de entrada nunca se modifican.

### Configuración

| Función / constante | Recibe | Devuelve |
| --- | --- | --- |
| `DEFAULT_CONFIG` | — | configuración por defecto (congelada) |
| `CONFIG_LIMITS` | — | rangos `[mín, máx]` de cada parámetro numérico |
| `resolveConfig(input?)` | objeto parcial con cualquier subconjunto de parámetros | configuración completa y validada; lanza `ConfigError` (con `.field`) si algo es inválido |
| `assertLoopShape(h_L, R)` | altura del loop (m), radio en la cima (m) | lanza `ConfigError` si `h_L < 2R` o la forma es demasiado extrema |

Parámetros (`SimulationConfig`): `mass` (kg), `gravity` (m/s²), `initialHeight` H (m), `initialSpeed` v₀ (m/s), `trackWidth` W (m), `mapId` (`incline`·`slope`·`valley`·`loop`·`reference`·`custom`), `loopHeight` h_L (m), `loopTopRadius` R (m), `hillHeight` h_c (m), `hillCrestRadius` ρ_c (m), `friction` μ, `brakeMode` (`station`·`spring`), `brakingLength` d_f (m), `brakeDeceleration` a_f (m/s²), `springConstant` k (N/m), `springDamping` c (N·s/m), `maxCompression` x_máx (m), `contactModel` (`strict`·`safety-wheels`), `maxLoad` n_máx (g), `minLoad` n_mín (g), `minSpeed` v_mín (m/s), `maxTime` (s), `timeStep` dt (s), `maxSubstep` Δt (s), `customPoints` (`{x, y}` relativos 0–1, `loopHeight`, `loopTopRadius` en m).

### Trazado

| Función | Recibe | Devuelve |
| --- | --- | --- |
| `buildTrack(config)` | configuración (parcial o completa) | `Track`: `segments`, `sections` (nombre, inicio y fin en m), `markers` (puntos críticos A–F con `distance` en m), `totalLength`, `brakeStart`, `stationStart` (m), `points` para dibujar, `loops`, `maxHeight` |
| `geometryAt(track, s)` | trazado, coordenada s (m) | `{x, y}` (m), `angle` θ (rad), `curvature` κ (1/m), `section`, `kind` |
| `createLoop({x, y, height, topRadius})` / `loopPoint(loop, s)` | base (m), h_L (m), R (m) / distancia local (m) | loop (`reference`, `shape`, `bottomRadius`, `length`, `exitX`) / punto con θ y κ |
| `hermitePoint(a, b, u, slope)` | nodos (m), parámetro 0–1, pendiente inicial | `{x, y, angle, curvature}` |
| `hillHalfWidth(h_c, ρ_c)` | m, m | semiancho w (m) |

### Dinámica y energía (`dynamics/`)

| Función | Recibe | Devuelve |
| --- | --- | --- |
| `calculateForces(track, config, s, v)` | trazado, configuración resuelta, s (m), v (m/s) | `normal`, `friction`, `brake`, `spring`, `damper`, `gravity` (componente tangencial), `tangential` (N); `acceleration` a_t, `normalAcceleration` a_n (m/s²); `load` n (g); `compression` (m); `geometry` |
| `calculateEnergies(config, v, y, x, E_dis)` | configuración, rapidez (m/s), altura (m), compresión (m), disipada (J) | `kinetic`, `gravitational`, `elastic`, `mechanical`, `dissipated`, `initial`, `balanceError` (J) |
| `initialEnergy(config)` | configuración | `m·g·H + ½·m·v₀²` (J) |
| `normalForce(m, g, θ, κ, v)` | kg, m/s², rad, 1/m, m/s | N (N) |
| `loadFactor(N, m, g)` | N, kg, m/s² | n (g) |
| `normalAcceleration(v, κ)` / `tangentialAcceleration(F_t, m)` | m/s, 1/m / N, kg | m/s² |
| `gravityTangential(m, g, θ)` | kg, m/s², rad | −m·g·sin θ (N) |
| `frictionMagnitude(μ, N)` / `resistiveForce(v, F_motriz, límite)` | —, N / m/s, N, N | N (con signo en el segundo caso) |
| `springForce(k, x)` / `damperForce(c, v, x)` | N/m, m / N·s/m, m/s, m | N |
| `kineticEnergy(m, v)` / `potentialEnergy(m, g, h)` / `elasticEnergy(k, x)` | SI | J |
| `brakingDistance(v, a)` / `brakingTime(v, a)` | m/s, m/s² | m / s |
| `loopTopMinimumSpeed(g, R)` / `frictionlessSpeed(g, H, y, v₀)` | m/s², m / m/s², m, m, m/s | m/s |

### Integración (`integration/`)

| Función | Recibe | Devuelve |
| --- | --- | --- |
| `createInitialState(config)` | configuración | `SimulationState` en A: t = 0, s = 0, v = v₀, E_dis = 0 |
| `step(state, config, dt?)` | estado, configuración, intervalo (s; por defecto `timeStep`) | **nuevo** estado tras `dt` (o antes si la simulación termina); si `status ≠ "running"` devuelve el mismo estado |
| `rk4(f, y, dt)` | derivada, vector, paso | vector nuevo |

`SimulationState`: `time` (s), `distance` s (m), `velocity` (m/s, con signo), `speed` (m/s), `position {x, y}` (m), `angle` (rad), `curvature` (1/m), `section`, `kind`, `status`, `events[]`, `springCompression` (m), `load` (g), `tangentialAcceleration` y `normalAcceleration` (m/s²), `forces {normal, tangential, friction, brake, spring, damper, gravity}` (N), `energies {kinetic, gravitational, elastic, mechanical, dissipated, initial, balanceError}` (J).

### Evaluación y dictamen (`evaluation/`)

| Función | Recibe | Devuelve |
| --- | --- | --- |
| `evaluateState(state, config, track)` | estado, configuración, trazado | `null` si cumple; si no, `{status, event}` con el incumplimiento |
| `evaluateRun(history, config)` | historial de estados, configuración | `Verdict`: `approved`, `status`, `violations[]`, `designChecks[]`, `summary`, `reasons[]` |
| `summarizeRun(history, config, track)` | historial, configuración, trazado | extremos (rapidez, carga, normal, aceleraciones, error de balance), `braking` (v_E, d_det, t_f, fuerza, impulso, energía), `sections[]`, `criticalPoints[]` (A–F con t, v, n, N, y) |
| `checkDesignConditions(config)` | configuración | condiciones necesarias del anexo por conservación de la energía: `H + v₀²/2g ≥ h_L + R/2`, `H + v₀²/2g > h_c`, `v_E² ≤ 2·a_f·d_f`, `a_f ≤ 1 g` |
| `interpolateAtDistance(history, s)` | historial, s (m) | `{time, speed, load, normal, height}` interpolados |

### Ejecución, exportación, escenarios y recomendaciones

| Función | Recibe | Devuelve |
| --- | --- | --- |
| `runSimulation(config, {timeStep?, onStep?})` | configuración | `{config, track, history, final, verdict}` del recorrido completo |
| `toCsv(history, {separator?, precision?})` | historial | texto CSV con encabezado (columnas en §6) |
| `SCENARIOS` / `findScenario(id)` | — / identificador | escenarios de referencia con configuración y dictamen esperado |
| `recommendationSearch(config)` | configuración que falló | generador que reporta progreso y devuelve hasta tres configuraciones cercanas **verificadas por simulación** que aprueban |
| `explainFailure(state, config)` | estado final, configuración | título y explicación en lenguaje natural del incumplimiento |

### Correspondencia con el diseño del Avance 1

| Planificada | Implementada |
| --- | --- |
| InicializarEstado | `createInitialState` |
| ObtenerGeometriaPista | `buildTrack` + `geometryAt` |
| CalcularAceleracionTangencial / CalcularAceleracionNormal / CalcularFuerzaCentripeta | `tangentialAcceleration`, `normalAcceleration`, `calculateForces` |
| CalcularFuerzaNormal / VerificarContactoLoop / CalcularFuerzaG | `normalForce`, `evaluateState` (criterios `contact`, `loop-contact`), `loadFactor` |
| CalcularVelocidad / AvanzarEstado | `rk4`, `step` |
| CalcularEnergiaPotencial / Cinetica / Elastica / Mecanica | `potentialEnergy`, `kineticEnergy`, `elasticEnergy`, `calculateEnergies` |
| CalcularFuerzaFriccion / AcumularPerdidasFriccion / VerificarBalanceEnergetico | `frictionMagnitude`, integración de `E_dis` en `step`, `energies.balanceError` |
| CalcularCompresionResorte / CalcularFuerzaResorte / EvaluarFrenado | `calculateForces` (`compression`, `spring`), `summarizeRun().braking`, criterios `overrun`/`compression` |
| EvaluarRecorrido | `evaluateRun` |

## 5. Pruebas de validación

`npm test` ejecuta 67 pruebas (vitest) en cinco archivos. Las de **validación analítica** comparan el motor con soluciones cerradas:

| Escenario | Solución cerrada | Tolerancia declarada y justificación |
| --- | --- | --- |
| Plano inclinado sin fricción | `s = ½·g·sin α·t²`, `v = g·sin α·t`, `t_bajada = √(2L/(g·sin α))`, `v_final = √(2gH)` | 1e-8 en s y v (RK4 es exacto con aceleración constante); 1e-3 s en el tiempo de llegada (interpolación entre muestras de 10 ms) |
| Plano inclinado con fricción | `a = g·(sin α − μ·cos α)`, `E_dis = μ·m·g·cos α·s` | 1e-8 y 1e-6 J (idem) |
| Conservación de la energía (μ = 0) | `E_m(t) = E_m(0)` en valle, colina y loop | 1e-4 relativo (tabla de longitud de arco interpolada linealmente); el anexo exige 1 % |
| Balance con fricción (μ > 0) | `E_m + E_dis = E_m(0)`; `E_dis` no decreciente | 1e-4 relativo |
| Frenos de estación | `v_E = √(2gH)`, `d_det = v_E²/(2a_f)`, `t_f = v_E/a_f`, `Q = ½·m·v_E²` | 1e-3 (entrada localizada por bisección; MRUA cerrada) |
| Resorte ideal | `x_máx = √(2mgH/k)`, `E_e = mgH`, `t_compresión = (π/2)·√(m/k)`, rebote | 1e-3 m, 1e-2 s |
| Cima del loop | caso límite `H = 2,5R` ⇒ `N = 0` rechazado; `H = 2,5R(1+ε)` ⇒ `N_C = 5ε·mg`; `N = m(v²/R − g)` | 1 % |
| Base del loop y cresta | `n_B = 1 + v_B²/(g·R_B)`, `n_D = 1 − v_D²/(g·ρ_c)` con `v_D² = 2g(H − h_c)` | 1 % |
| Independencia de la masa | v(t) idéntica para 500 y 5000 kg; E_dis escala ×10 | 1e-9 |
| Convergencia | subpaso 1 ms frente a 0,25 ms | 1e-5 relativo en v |
| Tabla 5 del anexo | loop circular H = 30 m, v₀ = 2 m/s, h_L = 21,5 m ⇒ 6,6 g en la base | 0,1 g |

Además: pureza (el estado de entrada congelado no se modifica), determinismo (dos ejecuciones idénticas), geometría (longitud `2π·R_ref`, altura `h_L`, radios en cima y base, continuidad de posición y ángulo en cada unión, `ρ_c = w²/(6h_c)`), validación de configuración (todos los rangos, enumerados, forma del loop, puntos personalizados), criterios (cada código de incumplimiento con su registro completo), dictamen, CSV, recomendaciones y los 12 escenarios de referencia con su dictamen esperado.

Cobertura de `src/physics/` con `npm run test:coverage`: ≈ 87 % de líneas.

## 6. Ejecución headless y CSV

`npm run headless` simula el escenario `certification` (trazado del anexo) con paso de reporte de 10 ms, imprime el dictamen, los puntos críticos A–F, los extremos y las condiciones de diseño, y escribe:

- `output/certification.csv` — una fila por estado con las columnas `t_s, s_m, x_m, y_m, v_mps, rapidez_mps, theta_rad, kappa_1pm, a_t_mps2, a_n_mps2, N_N, carga_g, friccion_N, resorte_N, amortiguador_N, freno_N, compresion_m, E_cinetica_J, E_potencial_J, E_elastica_J, E_mecanica_J, E_disipada_J, error_balance_J, tramo, estado` (sufijo = unidad).
- `output/certification.summary.json` — configuración resuelta, dictamen completo, tramos y marcadores.

El código de salida es 0 si el trazado aprueba, 2 si se rechaza y 1 ante una configuración inválida. La interfaz exporta exactamente el mismo CSV desde «Reporte completo → CSV».

## 7. Interfaz

1. **Recorrido**: seis trazados (certificación del anexo con puntos A–F, loop, valle y colina, línea, plano inclinado, personalizado con hasta tres loops y nueve puntos).
2. **Pasajeros**: hasta cuatro personas (dos por carrito), apariencia y masa individual.
3. **Laboratorio**: parámetros con símbolo, unidad, rango y explicación; sistema de frenado y modelo de contacto; masas; **Iniciar / Pausar / Paso / Completar / Reiniciar**, velocidad de reproducción, cámara completa o de seguimiento, línea de tiempo para revisar cualquier instante; capas del dibujo (tramos, puntos críticos, estela de rapidez, fuerzas, indicador g).
4. **Gráficas en tiempo real** (Chart.js, ejes con unidades): rapidez, energías, energía disipada, fuerza normal con N = 0, aceleraciones tangencial y normal, carga con banda [−1, +5] g y energía elástica; eje horizontal en tiempo o posición; marcadores de puntos críticos, tramos e incumplimientos; descarga PNG.
5. **Dictamen** con incumplimientos (condición, instante, tramo, posición, valor, límite), condiciones de diseño y **tres alternativas verificadas** calculadas a partir de la física del fallo.
6. **Reporte completo** imprimible (PDF): resultado, puntos críticos, extremos, frenado, tramos, condiciones de diseño y parámetros; exportación CSV y JSON.

## 8. Supuestos y limitaciones

Partícula sin longitud ni rotación propia; vía rígida sin peralte; gravedad uniforme; fricción efectiva μ·|N| que agrupa rodadura y aire (sin modelo separado de arrastre); subida por cadena fuera del recorrido evaluado (el tren parte de A con v₀); frenos de estación idealizados como desaceleración constante; resorte lineal con amortiguador viscoso opcional. Las uniones entre tramos de Hermite son continuas en posición y pendiente pero pueden tener saltos de curvatura, que se traducen en saltos de la fuerza normal (igual que un cambio brusco de curvatura en una vía real).

## 9. Licencia

MIT.
