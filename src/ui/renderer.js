import {
  resolveConfig,
  getTrackInfo
} from "../physics/index.js";

import {
  geometryAt
} from "../physics/geometry.js";

const armMemory = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerpAngle(current, target, factor) {
  const delta = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current)
  );

  return current + delta * factor;
}

function drawMiniArm(
  ctx,
  shoulderX,
  shoulderY,
  angle,
  skin
) {
  const upper = 6;
  const lower = 5;

  const elbowX =
    shoulderX + Math.cos(angle) * upper;

  const elbowY =
    shoulderY + Math.sin(angle) * upper;

  const handAngle =
    angle + Math.sin(angle * 2) * 0.08;

  const handX =
    elbowX + Math.cos(handAngle) * lower;

  const handY =
    elbowY + Math.sin(handAngle) * lower;

  ctx.strokeStyle = skin;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(elbowX, elbowY);
  ctx.lineTo(handX, handY);
  ctx.stroke();

  // Mini mano
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(
    handX,
    handY,
    1.6,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function box(
  ctx,
  x,
  y,
  width,
  height,
  color,
  radius = 4
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(
    x,
    y,
    width,
    height,
    radius
  );
  ctx.fill();
}

function drawLongHairBack(ctx, hair) {
  ctx.fillStyle = hair;

  ctx.beginPath();

  // Arriba izquierda
  ctx.moveTo(-6, -40);

  // Costado izquierdo
  ctx.quadraticCurveTo(
    -10,
    -38,
    -10,
    -31
  );

  ctx.quadraticCurveTo(
    -10,
    -24,
    -9,
    -17
  );

  // Parte baja izquierda
  ctx.quadraticCurveTo(
    -8,
    -14,
    -5,
    -14
  );

  // Centro inferior
  ctx.lineTo(-4, -27);
  ctx.lineTo(4, -27);

  // Parte baja derecha
  ctx.lineTo(5, -14);

  ctx.quadraticCurveTo(
    8,
    -14,
    9,
    -17
  );

  // Costado derecho
  ctx.quadraticCurveTo(
    10,
    -24,
    10,
    -31
  );

  ctx.quadraticCurveTo(
    10,
    -38,
    6,
    -40
  );

  ctx.closePath();
  ctx.fill();
}

function drawHairTop(
  ctx,
  passenger,
  hair
) {
  ctx.fillStyle = hair;

  if (passenger.hairStyle === "shaved") {
    ctx.beginPath();
    ctx.arc(
      0,
      -37,
      6,
      Math.PI,
      Math.PI * 2
    );
    ctx.fill();

    return;
  }

  if (passenger.hairStyle === "long") {
    /*
     * Cabello superior pequeño.
     * Solo cubre la frente/parte superior,
     * nunca la cara completa.
     */
    ctx.beginPath();

    ctx.moveTo(-6.5, -37);

    ctx.quadraticCurveTo(
      -5,
      -42,
      0,
      -42
    );

    ctx.quadraticCurveTo(
      5,
      -42,
      6.5,
      -37
    );

    /*
     * Flequillo inclinado parecido
     * al avatar grande.
     */
    ctx.quadraticCurveTo(
      4,
      -34,
      0,
      -32
    );

    ctx.quadraticCurveTo(
      -4,
      -31,
      -6.5,
      -33
    );

    ctx.closePath();
    ctx.fill();

    return;
  }

  // Cabello corto
  ctx.beginPath();

  ctx.arc(
    0,
    -37,
    7,
    Math.PI,
    Math.PI * 2
  );

  ctx.fill();
}

function drawFace(ctx, skin) {
  // Cara
  ctx.fillStyle = skin;

  ctx.beginPath();
  ctx.arc(
    0,
    -35,
    6,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Ojos
  ctx.fillStyle = "#302438";

  ctx.beginPath();
  ctx.arc(
    -2.2,
    -35,
    0.8,
    0,
    Math.PI * 2
  );

  ctx.arc(
    2.2,
    -35,
    0.8,
    0,
    Math.PI * 2
  );

  ctx.fill();

  // Sonrisa mini
  ctx.strokeStyle = "#6f403c";
  ctx.lineWidth = 0.9;
  ctx.lineCap = "round";

  ctx.beginPath();

  ctx.arc(
    0,
    -33.2,
    2,
    0.15,
    Math.PI - 0.15
  );

  ctx.stroke();
}

function drawHat(
  ctx,
  passenger
) {
  if (!passenger.hat) return;

  ctx.fillStyle =
    passenger.hatColor ??
    "#439c79";

  // Parte redonda
  ctx.beginPath();

  ctx.arc(
    0,
    -40,
    7.5,
    Math.PI,
    Math.PI * 2
  );

  ctx.fill();

  // Visera
  ctx.fillRect(
    -7,
    -41,
    18,
    3
  );
}

function person(
  ctx,
  passenger,
  x,
  motion = {}
) {
  ctx.save();

  ctx.translate(x, 0);

  const hair =
    passenger.hair ??
    "#382921";

  const skin =
    passenger.skin ??
    "#dca577";

  const shirt =
    passenger.shirt ??
    "#8050cf";

  const memoryKey =
    `${passenger.id}-${x}`;

  const previous =
    armMemory.get(memoryKey) ?? {
      left: 2.2,
      right: 0.95
    };

  /*
   * La gravedad global apunta hacia abajo,
   * pero el carrito rota con la pista.
   *
   * Por eso convertimos esa dirección
   * al sistema local del pasajero.
   */
  const downAngle =
    Math.PI / 2 -
    (motion.cartRotation ?? 0);

  /*
   * La aceleración tangencial también
   * modifica ligeramente la posición
   * de los brazos.
   */
  const tangentialPush = clamp(
    -(
      motion.tangentialAcceleration ??
      0
    ) * 0.08,
    -0.55,
    0.55
  );

  /*
   * Cuando la carga baja,
   * los brazos quedan más sueltos.
   *
   * Cuando aumenta,
   * tienden a caer hacia el cuerpo.
   */
  const loadLift = clamp(
    (
      0.9 -
      (motion.load ?? 1)
    ) * 0.5,
    -0.25,
    0.55
  );

  /*
   * Movimiento pequeño para evitar
   * que parezcan completamente rígidos.
   */
  const wiggle =
    Math.sin(
      (motion.time ?? 0) * 8 +
      x * 0.15
    ) * 0.08;

  const leftTarget =
    downAngle -
    0.38 +
    tangentialPush -
    loadLift +
    wiggle;

  const rightTarget =
    downAngle +
    0.38 +
    tangentialPush -
    loadLift -
    wiggle;

  const armState = {
    left: lerpAngle(
      previous.left,
      leftTarget,
      0.22
    ),

    right: lerpAngle(
      previous.right,
      rightTarget,
      0.22
    )
  };

  armMemory.set(
    memoryKey,
    armState
  );

  /*
   * 1. CABELLO LARGO DE ATRÁS
   *
   * Este es el cambio importante.
   * Debe dibujarse ANTES de la cara.
   */
  if (
    passenger.hairStyle ===
    "long"
  ) {
    drawLongHairBack(
      ctx,
      hair
    );
  }

  /*
   * 2. TORSO
   */
  box(
    ctx,
    -7,
    -28,
    14,
    14,
    shirt,
    4
  );

  /*
   * 3. BRACITOS
   */
  drawMiniArm(
    ctx,
    -6,
    -24,
    armState.left,
    skin
  );

  drawMiniArm(
    ctx,
    6,
    -24,
    armState.right,
    skin
  );

  /*
   * 4. CARA
   *
   * Ahora la cara se dibuja encima
   * del cabello posterior.
   */
  drawFace(
    ctx,
    skin
  );

  /*
   * 5. CABELLO SUPERIOR
   *
   * Este solo cubre una pequeña
   * parte superior de la cabeza.
   */
  drawHairTop(
    ctx,
    passenger,
    hair
  );

  /*
   * 6. GORRA
   */
  drawHat(
    ctx,
    passenger
  );

  ctx.restore();
}

function drawCart(
  ctx,
  passengers,
  motion = {}
) {
  passengers.forEach(
    (passenger, index) => {
      person(
        ctx,
        passenger,
        index === 0
          ? -14
          : 14,
        motion
      );
    }
  );

  /*
   * Cuerpo amarillo del carrito
   */
  box(
    ctx,
    -31,
    -19,
    62,
    17,
    "#e8af3f"
  );

  /*
   * Franja clara
   */
  box(
    ctx,
    -26,
    -15,
    52,
    4,
    "#fff0bd",
    1
  );

  /*
   * Barra de seguridad
   */
  ctx.strokeStyle =
    "#4b3266";

  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(-26, -23);
  ctx.lineTo(26, -23);
  ctx.stroke();

  /*
   * Ruedas
   */
  for (
    const wheelX of [-19, 19]
  ) {
    ctx.fillStyle =
      "#322340";

    ctx.beginPath();

    ctx.arc(
      wheelX,
      -2,
      5,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }
}

export function renderSimulation(
  canvas,
  state,
  input,
  passengers = [],
  camera = {}
) {
  const ctx =
    canvas.getContext("2d");

  if (!ctx) return;

  const config =
    resolveConfig(input);

  const track =
    getTrackInfo(config);

  const width =
    canvas.width;

  const height =
    canvas.height;

  const cartCount = Math.max(
    1,
    Math.ceil(
      passengers.length / 2
    )
  );

  const left =
    95 +
    (cartCount - 1) * 74;

  const right =
    190;

  const baseScale =
    Math.min(
      (
        width -
        left -
        right
      ) /
        track.stationX,

      (
        height -
        200
      ) /
        Math.max(
          1,
          track.maxHeight
        )
    );

  const follow =
    camera.mode ===
    "follow";

  const zoom =
    follow
      ? Math.max(
          1,
          Math.min(
            2.5,
            Number(
              camera.zoom
            ) || 1.8
          )
        )
      : 1;

  const scale =
    baseScale * zoom;

  function toX(x) {
    return follow
      ? width * 0.56 +
          (
            x -
            state.position.x
          ) *
            scale
      : left +
          x * scale;
  }

  function toY(y) {
    return follow
      ? height * 0.65 -
          (
            y -
            state.position.y
          ) *
            scale
      : height -
          65 -
          y * scale;
  }

  const groundY =
    toY(0);

  /*
   * Fondo
   */
  const sky =
    ctx.createLinearGradient(
      0,
      0,
      0,
      height
    );

  sky.addColorStop(
    0,
    "#ece5fc"
  );

  sky.addColorStop(
    1,
    "#ffffff"
  );

  ctx.fillStyle = sky;

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  /*
   * Suelo
   */
  ctx.fillStyle =
    "#dfeede";

  ctx.fillRect(
    0,
    Math.max(
      0,
      groundY + 7
    ),
    width,
    Math.max(
      0,
      height -
        groundY -
        7
    )
  );

  const points =
    track.points;

  /*
   * Soportes de la pista
   */
  ctx.strokeStyle =
    "#c7b8d9";

  ctx.lineWidth =
    3 * zoom;

  points.forEach(
    (point, index) => {
      if (
        index % 35 ||
        point.y < 0.1
      ) {
        return;
      }

      ctx.beginPath();

      ctx.moveTo(
        toX(point.x),
        toY(point.y)
      );

      ctx.lineTo(
        toX(point.x),
        groundY + 7
      );

      ctx.stroke();
    }
  );

  /*
   * Estación
   */
  const stationLeft =
    toX(track.springX) -
    25 * zoom;

  const stationWidth =
    (
      track.stationX -
      track.springX
    ) *
      scale +
    95 * zoom;

  box(
    ctx,
    stationLeft,
    groundY -
      105 * zoom,
    stationWidth,
    110 * zoom,
    "#e8dff2"
  );

  box(
    ctx,
    stationLeft +
      10 * zoom,
    groundY -
      80 * zoom,
    stationWidth -
      20 * zoom,
    78 * zoom,
    "#faf6ff"
  );

  box(
    ctx,
    stationLeft -
      10 * zoom,
    groundY -
      120 * zoom,
    stationWidth +
      20 * zoom,
    25 * zoom,
    "#785397"
  );

  box(
    ctx,
    stationLeft -
      10 * zoom,
    groundY +
      8 * zoom,
    stationWidth +
      20 * zoom,
    12 * zoom,
    "#bba4ce"
  );

  ctx.fillStyle =
    "#fff8e8";

  ctx.font =
    `bold ${
      11 * zoom
    }px sans-serif`;

  ctx.textAlign =
    "center";

  ctx.fillText(
    config.brakeMode ===
      "spring"
      ? "ESTACIÓN · RESORTE"
      : "ESTACIÓN · FRENOS",

    stationLeft +
      stationWidth / 2,

    groundY -
      104 * zoom
  );

  /*
   * Extensión de pista para
   * acomodar varios carritos
   */
  const extension =
    geometryAt(
      -(
        (
          cartCount - 1
        ) *
          74 +
        62
      ) /
        baseScale,

      config,
      track
    );

  /*
   * Pista
   */
  ctx.beginPath();

  ctx.moveTo(
    toX(extension.x),
    toY(extension.y)
  );

  points.forEach(
    point => {
      ctx.lineTo(
        toX(point.x),
        toY(point.y)
      );
    }
  );

  ctx.strokeStyle =
    "#69449a";

  ctx.lineWidth =
    5 * zoom;

  ctx.lineJoin =
    "round";

  ctx.stroke();

  /*
   * Resorte de frenado
   */
  if (
    config.brakeMode ===
    "spring"
  ) {
    const compression =
      Math.min(
        config.brakingLength,
        state.springCompression
      );

    const springLeft =
      toX(
        track.springX +
          compression
      );

    const wallX =
      toX(
        track.stationX
      );

    ctx.beginPath();

    ctx.moveTo(
      springLeft,
      groundY -
        14 * zoom
    );

    for (
      let index = 1;
      index < 25;
      index++
    ) {
      ctx.lineTo(
        springLeft +
          (
            wallX -
            springLeft
          ) *
            index /
            24,

        groundY -
          14 * zoom +
          (
            index % 2
              ? -6
              : 6
          ) *
            zoom
      );
    }

    ctx.lineTo(
      wallX,
      groundY -
        14 * zoom
    );

    ctx.strokeStyle =
      "#b17e53";

    ctx.lineWidth =
      2 * zoom;

    ctx.stroke();

    box(
      ctx,
      wallX,
      groundY -
        40 * zoom,
      7 * zoom,
      45 * zoom,
      "#8d739e"
    );
  }

  /*
   * Posición y rotación
   * de cada carrito.
   */
  const carts =
    Array.from(
      {
        length:
          cartCount
      },

      (_, index) => {
        const geometry =
          geometryAt(
            state.distance -
              index *
                74 /
                baseScale,

            config,
            track
          );

        return {
          x:
            toX(
              geometry.x
            ),

          y:
            toY(
              geometry.y
            ),

          rotation:
            -geometry.angle
        };
      }
    );

  /*
   * Convierte una posición local
   * del carrito a coordenadas
   * de pantalla.
   */
  function attachment(
    cart,
    localX,
    localY
  ) {
    return {
      x:
        cart.x +
        (
          localX *
            Math.cos(
              cart.rotation
            ) -
          localY *
            Math.sin(
              cart.rotation
            )
        ) *
          zoom,

      y:
        cart.y +
        (
          localX *
            Math.sin(
              cart.rotation
            ) +
          localY *
            Math.cos(
              cart.rotation
            )
        ) *
          zoom
    };
  }

  /*
   * Uniones entre carritos
   */
  ctx.strokeStyle =
    "#65516e";

  ctx.lineWidth =
    4 * zoom;

  for (
    let index = 1;
    index < carts.length;
    index++
  ) {
    const front =
      attachment(
        carts[index - 1],
        -31,
        -10
      );

    const back =
      attachment(
        carts[index],
        31,
        -10
      );

    ctx.beginPath();

    ctx.moveTo(
      front.x,
      front.y
    );

    ctx.lineTo(
      back.x,
      back.y
    );

    ctx.stroke();
  }

  /*
   * Dibujo de los carritos
   * desde atrás hacia adelante.
   */
  for (
    let index =
      carts.length - 1;

    index >= 0;

    index--
  ) {
    const cart =
      carts[index];

    ctx.save();

    ctx.translate(
      cart.x,
      cart.y
    );

    ctx.rotate(
      cart.rotation
    );

    ctx.scale(
      zoom,
      zoom
    );

    drawCart(
      ctx,

      passengers.slice(
        index * 2,
        index * 2 + 2
      ),

      {
        cartRotation:
          cart.rotation,

        tangentialAcceleration:
          state.tangentialAcceleration,

        load:
          state.load,

        time:
          state.time
      }
    );

    ctx.restore();
  }
}