import {
  resolveConfig,
  getTrackInfo
} from "../physics/index.js";

import {
  geometryAt
} from "../physics/geometry.js";

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
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function person(ctx, passenger, x) {
  ctx.save();
  ctx.translate(x, 0);

  const hair = passenger.hair ?? "#382921";

  if (passenger.hairStyle === "long") {
    box(ctx, -8, -44, 16, 27, hair, 7);
  }

  box(
    ctx,
    -7,
    -28,
    14,
    14,
    passenger.shirt ?? "#8050cf"
  );

  ctx.fillStyle = passenger.skin ?? "#dca577";
  ctx.beginPath();
  ctx.arc(0, -35, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hair;
  ctx.beginPath();

  ctx.arc(
    0,
    -36,
    passenger.hairStyle === "shaved" ? 6 : 7,
    Math.PI,
    Math.PI * 2
  );

  ctx.fill();

  if (passenger.hairStyle === "long") {
    ctx.fillRect(-7, -36, 3, 10);
    ctx.fillRect(4, -36, 3, 10);
  }

  if (passenger.hat) {
    ctx.fillStyle =
      passenger.hatColor ?? "#439c79";

    ctx.beginPath();
    ctx.arc(0, -39, 8, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.fillRect(-8, -40, 19, 3);
  }

  ctx.fillStyle = "#302438";
  ctx.fillRect(-3, -35, 1.5, 2);
  ctx.fillRect(2, -35, 1.5, 2);

  ctx.restore();
}

function drawCart(ctx, passengers) {
  passengers.forEach((passenger, index) => {
    person(ctx, passenger, index === 0 ? -14 : 14);
  });

  box(ctx, -31, -19, 62, 17, "#e8af3f");
  box(ctx, -26, -15, 52, 4, "#fff0bd", 1);

  ctx.strokeStyle = "#4b3266";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(-26, -23);
  ctx.lineTo(26, -23);
  ctx.stroke();

  for (const x of [-19, 19]) {
    ctx.fillStyle = "#322340";
    ctx.beginPath();
    ctx.arc(x, -2, 5, 0, Math.PI * 2);
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
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const config = resolveConfig(input);
  const track = getTrackInfo(config);

  const width = canvas.width;
  const height = canvas.height;

  const cartCount = Math.max(
    1,
    Math.ceil(passengers.length / 2)
  );

  const left = 95 + (cartCount - 1) * 74;
  const right = 190;

  const baseScale = Math.min(
    (width - left - right) / track.stationX,
    (height - 200) / Math.max(1, track.maxHeight)
  );

  const follow = camera.mode === "follow";

  const zoom = follow
    ? Math.max(
        1,
        Math.min(2.5, Number(camera.zoom) || 1.8)
      )
    : 1;

  const scale = baseScale * zoom;

  function toX(x) {
    return follow
      ? width * 0.56 + (x - state.position.x) * scale
      : left + x * scale;
  }

  function toY(y) {
    return follow
      ? height * 0.65 - (y - state.position.y) * scale
      : height - 65 - y * scale;
  }

  const groundY = toY(0);

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#ece5fc");
  sky.addColorStop(1, "#ffffff");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#dfeede";

  ctx.fillRect(
    0,
    Math.max(0, groundY + 7),
    width,
    Math.max(0, height - groundY - 7)
  );

  const points = track.points;

  ctx.strokeStyle = "#c7b8d9";
  ctx.lineWidth = 3 * zoom;

  points.forEach((point, index) => {
    if (index % 35 || point.y < 0.1) return;

    ctx.beginPath();
    ctx.moveTo(toX(point.x), toY(point.y));
    ctx.lineTo(toX(point.x), groundY + 7);
    ctx.stroke();
  });

  const stationLeft = toX(track.springX) - 25 * zoom;

  const stationWidth =
    (track.stationX - track.springX) * scale +
    95 * zoom;

  box(
    ctx,
    stationLeft,
    groundY - 105 * zoom,
    stationWidth,
    110 * zoom,
    "#e8dff2"
  );

  box(
    ctx,
    stationLeft + 10 * zoom,
    groundY - 80 * zoom,
    stationWidth - 20 * zoom,
    78 * zoom,
    "#faf6ff"
  );

  box(
    ctx,
    stationLeft - 10 * zoom,
    groundY - 120 * zoom,
    stationWidth + 20 * zoom,
    25 * zoom,
    "#785397"
  );

  box(
    ctx,
    stationLeft - 10 * zoom,
    groundY + 8 * zoom,
    stationWidth + 20 * zoom,
    12 * zoom,
    "#bba4ce"
  );

  ctx.fillStyle = "#fff8e8";
  ctx.font = `bold ${11 * zoom}px sans-serif`;
  ctx.textAlign = "center";

  ctx.fillText(
    config.brakeMode === "spring"
      ? "ESTACIÓN · RESORTE"
      : "ESTACIÓN · FRENOS",

    stationLeft + stationWidth / 2,
    groundY - 104 * zoom
  );

  const extension = geometryAt(
    -((cartCount - 1) * 74 + 62) / baseScale,
    config,
    track
  );

  ctx.beginPath();
  ctx.moveTo(toX(extension.x), toY(extension.y));

  points.forEach(point => {
    ctx.lineTo(toX(point.x), toY(point.y));
  });

  ctx.strokeStyle = "#69449a";
  ctx.lineWidth = 5 * zoom;
  ctx.lineJoin = "round";
  ctx.stroke();

  if (config.brakeMode === "spring") {
    const compression = Math.min(
      config.brakingLength,
      state.springCompression
    );

    const springLeft = toX(track.springX + compression);
    const wallX = toX(track.stationX);

    ctx.beginPath();
    ctx.moveTo(springLeft, groundY - 14 * zoom);

    for (let index = 1; index < 25; index++) {
      ctx.lineTo(
        springLeft + (wallX - springLeft) * index / 24,

        groundY -
          14 * zoom +
          (index % 2 ? -6 : 6) * zoom
      );
    }

    ctx.lineTo(wallX, groundY - 14 * zoom);

    ctx.strokeStyle = "#b17e53";
    ctx.lineWidth = 2 * zoom;
    ctx.stroke();

    box(
      ctx,
      wallX,
      groundY - 40 * zoom,
      7 * zoom,
      45 * zoom,
      "#8d739e"
    );
  }

  const carts = Array.from(
    { length: cartCount },
    (_, index) => {
      const geometry = geometryAt(
        state.distance - index * 74 / baseScale,
        config,
        track
      );

      return {
        x: toX(geometry.x),
        y: toY(geometry.y),
        rotation: -geometry.angle
      };
    }
  );

  function attachment(cart, localX, localY) {
    return {
      x:
        cart.x +
        (
          localX * Math.cos(cart.rotation) -
          localY * Math.sin(cart.rotation)
        ) * zoom,

      y:
        cart.y +
        (
          localX * Math.sin(cart.rotation) +
          localY * Math.cos(cart.rotation)
        ) * zoom
    };
  }

  ctx.strokeStyle = "#65516e";
  ctx.lineWidth = 4 * zoom;

  for (let index = 1; index < carts.length; index++) {
    const front = attachment(carts[index - 1], -31, -10);
    const back = attachment(carts[index], 31, -10);

    ctx.beginPath();
    ctx.moveTo(front.x, front.y);
    ctx.lineTo(back.x, back.y);
    ctx.stroke();
  }

  for (let index = carts.length - 1; index >= 0; index--) {
    const cart = carts[index];

    ctx.save();
    ctx.translate(cart.x, cart.y);
    ctx.rotate(cart.rotation);
    ctx.scale(zoom, zoom);

    drawCart(
      ctx,
      passengers.slice(index * 2, index * 2 + 2)
    );

    ctx.restore();
  }
}