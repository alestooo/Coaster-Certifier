# Taller de diseño centrado en el lienzo

Fecha: 2026-11-25 · Estado: aprobado (enfoque A) · Alcance: interfaz de la app web (`src/`, salvo `src/physics/`)

## Intención

Coaster-Certifier es un **creador de montañas rusas con una capa que las audita, certifica y propone ajustes usando física**. La interfaz actual es un formulario con una animación al lado:

- 3 pantallas antes de ver física;
- 70 controles en el laboratorio;
- la pista ocupa ≈ 6 % de la pantalla;
- la forma se edita con sliders lejos de la vía;
- la auditoría vive en un panel de texto;
- 23 % de CPU en reposo;
- 2,5 MB de imágenes.

El dueño del proyecto pidió:

- menos ruido;
- manipulación directa sobre el lienzo (arrastrar, subir, bajar);
- herramientas en el lienzo;
- menús que se desplieguen sin tapar la vista;
- optimizar recursos;
- que la app "se parezca a una herramienta pensada para su propósito".

Su definición de robustez: «mayor libertad, claridad y resiliencia», no más botones ni más texto.

## Objetivos

1. **Una sola pantalla de trabajo, el taller.** El lienzo es el protagonista y ocupa todo el ancho, salvo cuando hay un panel abierto.
2. **Diseñar arrastrando la propia pista.** Cada parámetro geométrico tiene una manija con restricción de movimiento. El valor se ve mientras se arrastra y la auditoría responde en vivo.
3. **La auditoría se ve sobre la vía:**
   - franja de fuerza g con leyenda fija;
   - pines donde falla, con correcciones verificadas, vista previa y aplicación deshacible;
   - lectura v/g/N al pasar el cursor.
4. **Interfaz contextual.** Los paneles aparecen solo con selección o a pedido, uno a la vez, y se cierran con Esc.
5. **Recursos.**
   - ≈ 0 % de CPU en reposo (redibujo bajo demanda);
   - gráficas ≤ 10 Hz y solo si están visibles;
   - diálogos cargados bajo demanda;
   - imágenes < 300 KB en total.

## No objetivos

- No cambia la librería de física (`src/physics/`), salvo exportaciones puras si hicieran falta. Sigue sin DOM.
- No se agregan funciones de física nuevas: lo que se audita es lo mismo.
- No hay vista 3D ni editor libre de curvas: los trazados siguen siendo los del anexo más el personalizado por puntos.

## Antiobjetivos

Cualquiera de estos haría fallar el trabajo aunque funcione:

- reemplazar 70 controles por 70 íconos;
- paneles flotantes grandes sobre la pista (Figma los probó y los retiró);
- deformar la escala para que la pista "se vea más grande": se dibuja en metros;
- perder algo que la rúbrica exige:
  - parámetros ajustables;
  - ≥ 1 gráfica en tiempo real con ejes y unidades;
  - dictamen;
  - CSV;
  - `npm test`;
  - `npm run headless`;
- romper deshacer o el CSV a resolución completa.

## Restricciones

- Svelte 5 con runes, TypeScript/JS con JSDoc, Canvas 2D, Chart.js y lucide-svelte. Sin dependencias nuevas salvo que ahorren código real.
- Deben seguir funcionando:
  - `npm test` y `npm run headless`;
  - `npm run check` sin errores;
  - `npm run e2e`;
  - los comandos del README.
- Español rioplatense neutro de la interfaz actual («Arrastrá», «Reproducí»), con decimales con coma.
- Responsive desde 360 px. En móvil los paneles son hojas inferiores.
- Accesible: las manijas son elementos DOM enfocables que se mueven con flechas, con `aria-label` y valor. Los pines son botones. Se respeta `prefers-reduced-motion`.
- Commit solo cuando el dueño lo pida. Push a `main` redespliega Vercel, así que se confirma antes.

## Enfoques considerados

| | Enfoque | Qué cambia | Costo / riesgo | Decisión |
|---|---|---|---|---|
| **A** | Taller único con el lienzo como protagonista | Se eliminan el asistente de 3 pasos y el panel lateral fijo. Se edita sobre la vía y la auditoría vive en la vía. | El cambio más grande; reescribe la interfaz del laboratorio y reutiliza motor, renderer, auditoría, worker y correcciones | **Elegido**: es el único que convierte la app en herramienta de diseño |
| B | Mantener el asistente y rehacer solo el laboratorio | Igual que A dentro del laboratorio | Siguen dos pantallas de formulario antes de diseñar | Descartado |
| C | Incremental: manijas y overlays sobre el laboratorio actual | Panel lateral intacto | Lo más seguro, pero no resuelve el ruido | Descartado |

## Diseño

### Flujo

La secuencia de pantallas pasa a ser **Menú → Taller**. Se eliminan la pantalla de selección de recorrido (`Setup`) y la barra de pasos (`TopNav`).

El taller arranca con el **Recorrido del anexo** y los pasajeros por defecto, y la auditoría en vivo calcula el dictamen de inmediato.

Elegir otro recorrido, cargar un escenario o editar pasajeros se hace desde la barra superior del taller, sin salir de él.

### Disposición

```
┌ ◉  Recorrido del anexo ▾   👥 2 · 582 kg   ↶ ↷   ⚙  ?          ● APRUEBA ▾ ┐  barra 48 px
│                                                               ┊ Panel        │
│   A↕            C↕ ◯R                                         ┊ (selección / │
│    ╲           ╭─╮            D↕ ↔                            ┊  dictamen /  │
│     ╲__________╰─╯___________╱‾╲_____ E▬▬▬▬▬▬▬▬▬F↔            ┊  reglas /    │
│   franja g sobre la vía           ⚠ pin                       ┊  pasajeros)  │
│  [▶ ↺ ━━━●━━━ 1×]     leyenda g ▭▭▭▭           [− ⤢ + ⌖]      ┊  Esc cierra  │
├ Telemetría ▾  v 19,5 m/s · 4,69 g · E 114 kJ  [gráfica en vivo]  ─────────────┤  plegable
```

- **Barra superior (48 px):**
  - inicio (logo);
  - selector de recorrido (popover con miniaturas a escala y la sección «Casos de prueba» con los escenarios de referencia);
  - chip de pasajeros, que abre el panel Pasajeros;
  - deshacer y rehacer;
  - ⚙ «Reglas y precisión», que abre ese panel;
  - ? para la guía;
  - **píldora de dictamen**, que abre el panel Dictamen.
- **Lienzo:** ocupa todo el espacio restante. Lleva superpuestos:
  - abajo a la izquierda, la píldora de reproducción (reproducir/pausar, reiniciar, línea de tiempo, velocidad);
  - abajo a la derecha, el zoom (−, encuadrar, +, seguir al tren);
  - abajo al centro, la leyenda de fuerza g (fase 2).
- **Panel derecho (≈ 340 px, uno solo a la vez):**
  - modos: `selección`, `dictamen`, `reglas`, `pasajeros`;
  - cerrado por defecto; se cierra con Esc o ✕;
  - al cerrarse, el lienzo recupera el ancho;
  - en ≤ 700 px es una hoja inferior (máx. 60 vh).
- **Telemetría inferior:**
  - plegable; abierta por defecto en escritorio, en modo compacto (lecturas más una gráfica en vivo de ≈ 180 px) porque la rúbrica exige la gráfica;
  - se expande a la grilla de gráficas;
  - en móvil arranca plegada.

### Cámara

- **Encuadre por defecto «ajustado»:** de A a F con márgenes mínimos, sin el relleno de 34 m a la derecha. La rampa de la cadena se recorta si no entra.
- **Zoom y paneo:**
  - zoom con rueda, pellizco o botones, de 1× a 8× sobre el encuadre;
  - paneo arrastrando el fondo;
  - «encuadrar» vuelve al ajuste;
  - «seguir al tren» se mantiene.
- **Zoom a la selección:** al seleccionar el loop o la colina, la cámara se anima hasta encuadrarlos, como «zoom to selection» en herramientas CAD.
- **Cámara congelada durante el arrastre:** la manija queda bajo el cursor. Al soltar, la cámara se anima al nuevo encuadre.
- **Proyección inversa:** la cámara expone `fromX` y `fromY` (píxeles → metros). `renderSimulation` devuelve la cámara usada para que la capa DOM posicione manijas y pines.

### Manijas sobre la pista (recorridos predefinidos)

| Manija | Posición | Movimiento | Parámetro |
|---|---|---|---|
| A | cima inicial (0, H) | vertical | H |
| Flecha v₀ | vector tangente en A, largo ∝ v₀ | a lo largo de la tangente | v₀ |
| C | cima del loop | vertical | h_L |
| Círculo R | círculo osculador en C (centro en C.y − R); manija en (C.x + R, C.y − R) | horizontal | R |
| D | cresta de la colina | vertical | h_c |
| Pie de la colina | (centro + w, 0) | horizontal | ρ_c = w²/(6·h_c) |
| E | inicio del frenado | horizontal | W (estira el trazado) |
| F | fin de la zona de frenado | horizontal | d_f |

- **Mientras se arrastra**, una etiqueta junto a la manija muestra el valor («h_L = 21,5 m») y una consecuencia física («necesita ≥ 7,0 m/s en la cima»). La pista se redibuja en cada movimiento, porque `buildTrack` está memorizado y es rápido. La auditoría corre con el commit throttled de 120 ms que ya existe.
- **Resiliencia:**
  - el valor se limita a `CONFIG_LIMITS` y a la forma válida del loop (5 % ≤ 2R/h_L ≤ 100 %);
  - si la geometría resultante no es construible (por ejemplo, la colina no cabe), la manija se detiene en el último valor válido y la etiqueta explica por qué;
  - nunca queda un estado roto.
- **Teclado:** Tab enfoca la manija; las flechas mueven un paso y Shift multiplica por 10. Doble clic o Enter abren un campo numérico en el lugar.
- **Visibilidad:**
  - las manijas principales (A, C, D, E, F) se ven siempre como puntos discretos;
  - las secundarias (R, pie de la colina, v₀) aparecen con la selección de su parte;
  - durante la reproducción se ocultan todas.
- **Personalizado (fase 3):**
  - manija 2D por cada punto;
  - las manijas del loop (C, R) se aplican sobre cada loop;
  - una mini barra sobre el punto seleccionado ofrece agregar/quitar loop y borrar punto;
  - doble clic sobre la vía inserta un punto;
  - reemplaza el modal del editor.

### Selección e inspector

- **Clic sobre la vía:** el tramo más cercano determina el área (`start`, `layout`, `loop`, `hill`, `braking`), que se selecciona. El área se resalta con el brillo ámbar existente y se abre el panel `selección` con sus pocos valores.
- **Clic sobre el cielo:** deselecciona.
- **Campos del panel:** son numéricos «arrastrables», como en Figma o Blender: arrastrar la etiqueta cambia el valor y clic en el número permite escribirlo. Llevan unidad, una pista calculada y una barra fina que muestra el rango. Reemplazan los sliders.
- **Contenido por área** (sale de `FIELD_GROUPS`):
  - salida: H, v₀;
  - trazado: W, μ;
  - loop: h_L, R;
  - colina: h_c, ρ_c;
  - frenado: sistema (segmentado frenos/resorte), d_f, a_f o k, c, x_máx, y la distancia necesaria.
  - Arriba va el estado del área según la auditoría.
- **Panel `reglas`:** contacto (siempre apoyado / ruedas anti-levantamiento), n_máx, n_mín, v_mín y la sección plegada «Precisión numérica» (dt, Δt, t_máx).
- **Panel `dictamen`:**
  - título y titular;
  - cuatro datos (fuerza g máx/mín, rapidez máx, distancia de frenado);
  - lista de problemas: cada uno lleva a su pin y selecciona su área;
  - «Informe completo» y exportar CSV/JSON.
- **Panel `pasajeros`:**
  - fase 1: masas (carrito y pasajeros) más un enlace a la pantalla de avatares;
  - fase 3: el editor de avatares dentro del panel, cargado bajo demanda.

### Auditoría sobre la vía (fase 2)

- **Franja de fuerza g:** una banda de color se dibuja pegada a la vía con la fuerza g extrema registrada en cada tramo de 0,5 m (`loadProfile`, función pura en `src/lib`).
  - Escala fija de −1 a +5 g (o los límites vigentes) con leyenda.
  - Colores:

    | Condición | Color |
    |---|---|
    | cómodo | verde |
    | ≥ 90 % del límite | ámbar |
    | fuera de límite | rojo |
    | flotación (n < 0,2 g, sin bajar del límite) | azul |

- **Pines:** son botones DOM, con el pulso hecho en CSS y no en el canvas. Al pulsar uno se abre un popover anclado con:
  - el problema y su porqué físico;
  - hasta 3 correcciones verificadas por el worker de recomendaciones existente;
  - en cada corrección, «ver», que dibuja la pista corregida como fantasma verde punteado, y «aplicar», que se puede deshacer.
  - Reemplaza al `FailureDialog` modal.
- **Lectura al pasar el cursor:** cerca de la vía (≤ 14 px) aparece un punto sobre la vía y una etiqueta con s, v, n (g) y N, interpolados del historial auditado por distancia (primer paso por ese punto). Reemplaza al tablero de instrumentos cuando no se reproduce.
- **Pausa automática:** durante la reproducción, el tren se detiene en el primer incumplimiento y el pin late.

### Rendimiento y recursos

- **Redibujo bajo demanda.** El bucle `requestAnimationFrame` corre solo mientras:
  - se reproduce;
  - se arrastra;
  - se anima la cámara.
  - En cualquier otro caso, un cambio de escena pide un único cuadro.
  - La cadena animada y el pulso del pin dejan de exigir cuadros continuos (el pin pasa a CSS).
- **Historial del runner:** `#flush` se agrupa a ≤ 10 Hz durante la reproducción, sin copiar el arreglo en cada cuadro. El tren sigue dibujándose con `runner.state` en cada cuadro.
- **Gráficas:** se actualizan a ≤ 10 Hz y solo si la telemetría está abierta.
- **Lecturas numéricas:** ≤ 10 Hz, con cifras tabulares de ancho fijo para no provocar layout.
- **Carga bajo demanda:**
  - `ReportDialog`;
  - `Guide`;
  - el editor de avatares;
  - el popover de correcciones;
  - la grilla de gráficas.
- **Imágenes:**
  - el logo de 2 MB pasa a WebP de ≤ 512 px;
  - el ícono de navegación usa el tamaño que corresponde;
  - el GIF del menú (700 KB) pasa a WebM/MP4 o WebP animado con póster;
  - meta: < 300 KB en total.

### Lo que se elimina al terminar

Se eliminan:

- `Setup.svelte`, `TopNav.svelte`;
- `Inspector.svelte` (pestañas), `SettingsPanel.svelte`, `TransportBar.svelte`, `InstrumentCluster.svelte`;
- `TrackEditor.svelte` (modal), `FailureDialog.svelte`;
- los estilos asociados.

La lógica útil se mueve antes de borrar:

- el worker de recomendaciones;
- las plantillas del editor;
- las lecturas.

## Fases

Cada fase deja la app funcionando, probada y desplegable.

1. **Taller y edición sobre la pista:**
   - flujo Menú → Taller;
   - barra superior;
   - lienzo completo con cámara (ajuste, zoom, paneo, seguir, zoom a la selección, proyección inversa);
   - manijas de recorridos predefinidos;
   - selección e inspector con campos arrastrables;
   - paneles dictamen, reglas y pasajeros (masas);
   - telemetría inferior con la gráfica existente;
   - píldora de reproducción y zoom;
   - redibujo bajo demanda;
   - throttling de historial y gráficas.
   - Mientras tanto, `FailureDialog`, el modal del editor y la pantalla de pasajeros siguen accesibles.
2. **Auditoría sobre la vía:**
   - franja g y leyenda;
   - pines DOM con popover de correcciones, vista fantasma y aplicación;
   - lectura al pasar el cursor;
   - pausa automática.
   - Se retira `FailureDialog`.
3. **Personalizado sobre el lienzo y paneles:**
   - manijas de puntos y loops;
   - mini barra;
   - inserción de puntos;
   - pasajeros con avatares en el panel;
   - telemetría compacta y expandida.
   - Se retiran el modal del editor y la pantalla de pasajeros.
4. **Recursos y cierre:**
   - imágenes;
   - carga bajo demanda;
   - borrado del código muerto;
   - medición de CPU antes y después con CDP;
   - README, `docs/ARQUITECTURA.md` y capturas nuevas;
   - e2e completo.

## Verificación

- **Pruebas unitarias** (Vitest) para la lógica pura nueva, en `src/lib` o `src/ui` sin DOM:
  - ida y vuelta de la proyección de cámara;
  - posiciones de las manijas;
  - arrastre → parche de configuración con límites y geometría inválida;
  - prueba de impacto (punto → tramo → área);
  - `loadProfile`;
  - interpolación por distancia.
- **e2e** (Playwright, Chrome), reescrito al nuevo flujo:
  - el anexo aprueba;
  - arrastrar F hacia la izquierda rechaza por frenado y deshacer lo recupera;
  - un valor escrito inválido se maneja;
  - con el loop circular aparece un pin, se aplica una corrección y aprueba;
  - se arrastra un punto del personalizado;
  - se editan los pasajeros;
  - no hay desborde horizontal en 1440, 1024, 700 y 390 px;
  - no hay errores de consola.
- **Capturas** de cada fase revisadas antes de reportar.
- **CPU en reposo** medida con CDP (`Performance.getMetrics`), con meta < 3 %.

## Decisiones tomadas por el implementador

Son ajustables:

- **Encuadre ajustado A→F sin relleno derecho, a escala real.** No se usa exageración vertical: la escala es un requisito del dueño.
- **Manijas como DOM superpuesto y no como hit-testing en canvas:** accesibilidad, cursor, foco y pruebas e2e más simples.
- **Un solo panel derecho con modos** en lugar de varios drawers y popovers. La única excepción es el selector de recorrido, que es una lista corta.
- **Campos arrastrables con barra de rango** en lugar de sliders completos en el inspector.
- **Telemetría abierta por defecto en escritorio y plegada en móvil**, por la rúbrica.
- **Pines y su pulso en DOM/CSS:** evita redibujos continuos del canvas.
