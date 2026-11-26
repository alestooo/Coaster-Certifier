# Pendientes menores del rediseño

Se acumulan durante las fases y se atacan al terminar la fase 4. Cada uno dice qué pasa, dónde y la corrección sugerida.

## Fase 1: taller y edición sobre la pista

- [x] **Arrastre trabado si la manija desaparece a mitad del gesto.** Pasa con Ctrl+Z o Espacio durante el arrastre: `dragging` queda en verdadero y el lienzo redibuja sin parar hasta el próximo arrastre (`HandleLayer.svelte`, `Stage.svelte`). Corrección: escuchar `pointerup` en `window` mientras se arrastra.
  - **Resuelto:** `lib/pointer-release.ts`: al empezar el gesto se escucha también el fin en la ventana (manijas de la pista y del personalizado). Prueba unitaria y e2e «si la manija desaparece en pleno arrastre…».
- [x] **`createFrameLoop` se detiene si `draw` lanza una excepción** (`src/lib/frame-loop.ts`). Corrección: `try/finally` alrededor de `draw`.
  - **Resuelto:** `draw` va en `try/finally`; prueba «si un cuadro falla, el bucle activo sigue pidiendo cuadros».
- [x] **La cámara queda acercada cuando deshacer elimina la parte seleccionada**, y al cambiar de recorrido anima hacia el encuadre viejo y luego salta (`Workshop.svelte`). Corrección: llamar a `leaveFocus` al descartar la selección y encuadrar con la pista nueva.
  - **Resuelto:** descartar una selección que ya no existe devuelve la cámara al encuadre, y la animación recalcula su destino en cada cuadro, así que un cambio de recorrido llega al encuadre nuevo sin saltar (antes, ~180 px al final hacia «Loop circular»). E2e «deshacer hasta un recorrido sin la parte encuadrada…» y «…sin un salto final» (RED con el código original).
- [x] **En el teléfono, la hoja inferior puede tapar la parte enfocada** (`SidePanel.svelte`, `frameView`). Corrección: reservar el alto de la hoja al encuadrar.
  - **Resuelto:** `frameViewAbove` encuadra en lo que la hoja deja visible; `SidePanel` informa su alto cuando es hoja y `Stage` vuelve a encuadrar al aparecer. Pruebas unitarias y e2e «en un teléfono bajo…» (375×667; en 390×844 no llegaba a tapar).
- [x] **Editor de avatares sin Esc, sin manejo de foco y con un segundo `<main>`.** Resuelto en la fase 3: el editor vive en el panel y la prueba e2e verifica que haya un solo `<main>`.
- [x] **La capa estática se reconstruye en cada cuadro durante las animaciones de zoom**, porque la clave de caché incluye la escala (`src/ui/renderer/layers.js`). Corrección: dibujar sin caché mientras dura la animación, o cuantizar la escala.
  - **Resuelto:** mientras la escala cambia en cada cuadro (animación de zoom o pellizco), `getWorldLayer` solo reusa una capa existente y si no, se dibuja directo (opción `cacheWorld`). Prueba unitaria «…no se crea una capa por cuadro…».

## Fase 2: auditoría sobre la vía

- [x] **Sin Web Worker, la búsqueda de correcciones sigue corriendo al cerrar el popover** (`src/lib/fix-search.svelte.ts`). Corrección: `stop()` al cerrar cuando la búsqueda corre en el hilo principal.
  - **Resuelto:** `FixSearch.leave()` al cerrar el popover detiene la búsqueda del hilo principal; la del Worker termina y queda guardada. Prueba «al dejar de mirar…».
- [x] **Un popover abierto durante la reproducción se cierra cuando la reproducción termina** (`Workshop.svelte`). Corrección: cerrar solo cuando `running` pasa de falso a verdadero.
  - **Resuelto:** el efecto se partió en dos: los cambios del diseño cierran; de la reproducción, solo empezar. E2e «un problema abierto durante la reproducción sigue abierto…».
- [x] **El punto de la lectura queda desfasado tras deshacer o rehacer con el teclado**, hasta que se mueve el mouse (`Stage.svelte`). Corrección: limpiar `hover` cuando cambia `live.track`.
  - **Resuelto:** `hover` se limpia cuando cambia `live.track`. E2e «deshacer con el teclado quita la lectura de la pista vieja».
- [x] **La leyenda dice «≤ n_mín» con ruedas anti-levantamiento, pero el motor rechaza con «<»**, y la lista de colores se oculta en ≤ 860 px en vez de ≤ 700 px, sin punto de color (`LoadLegend.svelte`).
  - **Resuelto:** `legendItems` (en `load-profile.ts`) usa «<» con ruedas, como el motor; con la lista oculta el botón muestra un punto con los cuatro tonos. La lista se oculta en ≤ 860 px y no en ≤ 700 px, para no chocar con la ayuda de arriba a la izquierda. Pruebas unitarias y e2e «…un punto de color».

## Fase 3: personalizado sobre el lienzo y pasajeros en el panel

- [x] **El punto elegido se guarda como índice.** Si después de agregar un punto se hace Ctrl+Z, o se deshace o rehace un cambio de plantilla, la selección, el panel y la mini barra saltan al punto vecino (`Workshop.svelte`). Corrección: limpiar la selección cuando cambia `customPoints.length` o al deshacer o rehacer.
  - **Resuelto:** deshacer y rehacer (teclado y barra) sueltan el punto elegido antes de cambiar el diseño. E2e «deshacer un borrado no deja elegido otro punto en su lugar».
- [x] **Clic sobre el cielo no deselecciona el punto** del personalizado; solo deselecciona áreas. La especificación dice «Clic sobre el cielo: deselecciona» (`Stage.svelte`, `onPointerUp`).
  - **Resuelto:** `onPointerUp` suelta el punto si el clic no toca la vía. E2e «un clic en el cielo suelta el punto elegido».
- [x] **El aviso de error al insertar un punto no se borra nunca.** `pointMessage` sigue ahí después de borrar puntos o de cambiar de plantilla, y reemplaza a la ayuda. En ≤ 700 px la ayuda está oculta, así que en el teléfono un intento fallido no da ninguna respuesta (`Stage.svelte`).
  - **Resuelto:** el aviso se borra cuando cambian los puntos o el recorrido, y en ≤ 700 px los avisos se ven aunque la ayuda siga oculta. E2e «un punto que no se puede agregar avisa (también en el teléfono)…».
- [x] **`PointPanel` muestra valores viejos** (`PointPanel.svelte`). Correcciones:
  - el motivo se conserva al cambiar de punto: usar `{#key index}`;
  - si el valor recortado se ve igual que el anterior, el número escrito fuera de rango queda en el campo: reponer `currentTarget.value`;
  - escribir h_L ≤ 0 quita el loop sin avisar.
  - **Resuelto:** el motivo se borra al cambiar de punto; tras cada edición el campo muestra el valor vigente; h_L ≤ 0 no se aplica y explica que se quita con «Quitar loop»; los campos tienen nombre accesible propio. E2e «el panel del punto no deja valores viejos ni quita el loop con h_L = 0».
- [x] **Accesibilidad y descubrimiento** (`PointLayer.svelte`, `custom-points.ts`):
  - las manijas del loop son `role="slider"` pero no responden al teclado;
  - no hay forma de agregar un punto con teclado o tacto: una opción «Agregar punto» en la mini barra lo resolvería;
  - las plantillas solo aparecen al elegir un punto y no se validan: «Loop central» falla con W ≤ 20 m.
  - **Resuelto:** las manijas del loop responden a las flechas (h_L de a 0,5 m, R de a 0,25 m, Shift ×10); la mini barra tiene «Agregar punto» (a mitad de camino, `insertAfter`); una plantilla que no entra dice por qué (`templateProblem`) en vez de fallar callada; la ayuda menciona las plantillas. Pruebas unitarias y e2e.
- [x] **Masa de pasajero vacía** (`PassengerEditor.svelte`):
  - un campo vacío da `NaN` y el asiento muestra «NaN kg»;
  - el error no está ligado al campo (`aria-invalid` / `aria-describedby`).
  - **Resuelto:** un campo vacío no cambia nada y vuelve a mostrar el valor vigente (también la masa del carrito); la masa fuera de rango marca su campo con `aria-invalid` y `aria-describedby` apunta al mensaje. E2e «una masa vacía no deja «NaN kg»…» (RED; mutación sin la protección → RED).

## Fase 4: recursos y cierre

- [x] **La guía no se puede abrir en el teléfono** (`WorkshopBar.svelte`): a ≤ 520 px el botón «Guía y escenarios» se oculta para que entre la barra, y no hay otro camino. Moverla al selector de recorridos (que ya lista los escenarios) o a un menú «más».
  - **Resuelto:** el selector de recorridos tiene «Guía y criterios» junto a los casos de prueba, en todos los anchos. E2e «en el teléfono la guía se abre desde el selector de recorridos».
- [x] **El aviso flotante de descarga fallida no se puede cerrar** (`LoadError.svelte` con `floating`): queda hasta reintentar.
  - **Resuelto:** `LoadError` tiene «Cerrar aviso»; pedir de nuevo la pieza lo vuelve a mostrar. E2e «los avisos de descargas fallidas se apilan sin taparse y se pueden cerrar».
- [x] **El informe muestra decimales con punto en «1. Resultado»** («240.87 m», «4.69 g», «1920.9 N»): las frases las arma `src/physics/evaluation/verdict.js` con `toFixed`. El resto de la interfaz usa coma (`formatNumber`).
  - **Resuelto:** `lib/report-text.ts` (`resultLines`) escribe «1. Resultado» con `formatNumber` a partir de los datos del dictamen; la librería y el script headless no cambian. El intervalo pasa a «entre -1 y 5 g» para no chocar con la coma decimal. Pruebas unitarias y e2e.
- [x] **Los botones del informe dependen de glifos de texto** («🖨 Imprimir / PDF», «⤓ CSV», «⤓ JSON»): sin fuente de emoji, el de imprimir se ve como un cuadrado vacío (pasa en el Chrome de las capturas). Usar los íconos de lucide (`Printer`, `Download`), como el resto de la app.
  - **Resuelto:** íconos de lucide (`Download`, `Printer`, `X`). Misma e2e.
- [x] **Con un loop chico, la manija del radio tapa la de la cima** (`custom-points.ts`, `pointHandles`): con R = 2,75 m y la escala del encuadre (≈ 4 px/m) quedan a ~11 px y el centro de la cima toma la del radio. Con zoom se separan. Separarlas un mínimo en píxeles.
  - **Resuelto:** `lib/loop-handle-layout.ts` aparta la cima de la base y el radio de la cima cuando el loop se ve chico; la cima se mide desde el inicio del gesto. Pruebas unitarias y e2e «…la base, la cima y el radio se pueden tocar sin taparse» (escritorio y teléfono).
- [x] **Los diálogos diferidos se abren esperando hasta 3 `tick()`** (`Workshop.svelte`, `openLazyDialog`): funciona, pero un indicador `pendingOpen` con un `$effect` que abra al montarse sería determinista.
  - **Resuelto:** el pedido queda pendiente y un `$effect` lo abre cuando `bind:this` entrega el diálogo (ya no se tantea con `tick()`). Lo cubren las e2e de carga bajo demanda (informe demorado 1,5 s, PDF).
- [x] **Los avisos flotantes de descarga fallida se superponen** (`LoadError.svelte`): todos usan el mismo lugar fijo; si fallan dos, el segundo tapa al primero. Apilarlos en un contenedor común.
  - **Resuelto:** la guía y el informe se apilan en un contenedor común del taller; el de las correcciones va donde iría el popover y se cierra con él. Misma e2e.
- [x] **La mini barra «debajo del punto» no revisa el borde inferior** (`PointLayer.svelte`): con un loop alto y zoom, si la cima no deja lugar arriba, la barra va debajo de la base aunque la base esté cerca del borde de abajo. Probar arriba del punto como último recurso y limitar `y`.
  - **Resuelto:** `lib/toolbar-placement.ts`: arriba del loop; si no, debajo del punto; si tampoco entra, arriba del punto sin salir del lienzo. Pruebas unitarias de los tres casos.
- [x] **iOS en modo de bajo consumo bloquea el autoplay** y puede dibujar un ícono de reproducir sobre el video del menú (`Menu.svelte`): ocultar `::-webkit-media-controls-start-playback-button` o quitar el video si `play()` se rechaza.
  - **Resuelto:** si `play()` se rechaza, el menú quita el video y queda el póster; además se oculta el botón de reproducir de WebKit. E2e con `play()` bloqueado.
- [x] **En el teléfono, tras «Agregar loop» la manija de la cima tapa la del punto base** y el toque en «Punto 3» lo toma la cima (`custom-points.ts`). Se resuelve junto con el ítem del loop chico.
  - **Resuelto:** mismo arreglo, y el punto elegido y su loop quedan sobre los pines (en el teléfono el pin del problema caía sobre la cima).
- [x] **El título del eje Y de la telemetría se corta** («Fuerza g, n = N/(mg»): no entra en 150 px de alto.
  - **Resuelto:** el eje vertical lleva símbolo y unidad («v (m/s)», «n (g)», «a (m/s²)»…); el encabezado de cada tarjeta ya nombra la magnitud. Prueba unitaria «el eje vertical lleva símbolo y unidad, y entra en una gráfica baja»; captura de la grilla revisada.

## Revisión de la pasada de pendientes

Revisión independiente del 26/11. Se corrigieron con pruebas:
- [x] el informe ponía «entre -1 y 5 g» con «siempre apoyado»: ahora dice «mayor que 0 g (siempre apoyado) y hasta 5 g»;
- [x] una precarga en reposo que fallaba mostraba avisos de piezas que nadie pidió;
- [x] el menú quitaba el video ante cualquier rechazo de `play()`, no solo un bloqueo del autoplay;
- [x] el texto de la arquitectura sobre los puntos de retorno.

Quedan:
- [ ] **Un pedido de diálogo pendiente no se cancela** (`Workshop.svelte`, `openLazyDialog`): si el dictamen desaparece entre el clic en «PDF» y la descarga, la promesa queda colgada y el informe podría abrirse e imprimirse más tarde; un segundo pedido pisa al primero. Resolver con `false` el anterior y limpiar el del informe cuando `result` es null.
- [ ] **En el personalizado, la candidata de altura para «rapidez insuficiente» no escala el obstáculo** (`recommendations/targeted.js`): en el personalizado las alturas de los puntos son `y·H`, así que subir H sube también el obstáculo. Usar H ≥ (pérdidas + margen − v₀²/2g) / (1 − y_obs/H). Las cimas de loops tampoco cuentan como obstáculo.
- [ ] **El nuevo encuadre por la hoja no se frena durante un arrastre** (`Stage.svelte`): si la hoja cambia de alto mientras se arrastra una manija, la animación pisa la proyección congelada; y `zoomedForSelection` puede quedar viejo. Salir si `dragging` y limpiar `zoomedForSelection` al empezar a arrastrar.
- [ ] **La manija de la cima de un loop chico va detrás del dedo** (`loop-handle-layout.ts`): mientras la cima dibujada está corrida, la manija sigue al puntero con hasta 36 px de diferencia. El valor es correcto; es solo visual.
- [ ] **Detalles:** `insertAfter` obtiene el error del máximo llamando a `insertPoint(config, 0, 0)`; sangría de `{#if !hasLoop}` en `PointPanel.svelte`; la forma cerrada atribuye al amortiguador `c·v₀²·τ/2` en vez de `c·v₀²·τ/3` (efecto despreciable).

## Hallazgos anteriores al rediseño

- [x] **El buscador de correcciones no encuentra ninguna en 3 de los 5 escenarios que fallan** (`src/physics/recommendations/`): «Sin energía para la colina», «Zona de frenado insuficiente» y «Resorte ideal». En el frenado, alargar la zona debería bastar. Es el pilar de «ajusta» de la app. Revisar `candidates.js` y `targeted.js`.
  - **Resuelto:** ahora los cinco escenarios que fallan reciben al menos una corrección verificada. Tres causas: (1) «Sin energía para la colina»: la candidata buscaba el obstáculo entre los nodos *más bajos* que la altura inicial y proponía bajarla (10 → 3,87 m); ahora toma lo más alto después de la salida y también propone bajar la colina; (2) «Zona de frenado insuficiente»: la zona necesaria (162 m) pasaba del máximo (150 m) y se descartaba; ahora se alarga lo posible y los frenos aprietan lo que falta; (3) «Resorte ideal»: había un error del motor (ver abajo). Prueba «el escenario que falla «%s» recibe al menos una corrección verificada» (×5).
- [x] **Error del motor encontrado al revisar el buscador: un tren que la fricción frena en una recta se arrastraba a velocidad constante** (`src/physics/integration/step.js`). Con |v| < a·h/2, las etapas de RK4 cambiaban el signo de la fricción de Coulomb y se anulaban (k₁ + 2k₂ + 2k₃ + k₄ = 0): v quedaba fija en ~3·10⁻⁵ m/s y el recorrido terminaba en «tiempo agotado» en lugar de «detenido antes de la estación».
  - **Resuelto:** cuando la fuerza que se opone al movimiento lo detendría dentro del paso, ese tramo se integra en forma cerrada (aceleración constante) y se comprueba el reposo como en un punto de retorno. Prueba «un tren que la fricción frena en una recta queda en reposo…». Los dictámenes de los escenarios de referencia no cambian.
- [ ] **La identidad de git de la carpeta de la universidad usa un correo sin completar** (`REPLACE_ME_university@…` en `~/.gitconfig-university`). Corregirlo antes de hacer push.
