import { resolveConfig } from "./config.js";

const cache = new Map();

const SAMPLES = 160;
const LOOP_SHAPE = 0.5;
const TAU = 2 * Math.PI;

// Curva entre puntos del recorrido.
function curve(start, end, u, startSlope = 0) {
  const dx = end.x - start.x;
  const tangent = startSlope * dx;

  const y =
    (2 * u ** 3 - 3 * u ** 2 + 1) * start.y +
    (u ** 3 - 2 * u ** 2 + u) * tangent +
    (-2 * u ** 3 + 3 * u ** 2) * end.y;

  const dy =
    (6 * u ** 2 - 6 * u) * start.y +
    (3 * u ** 2 - 4 * u + 1) * tangent +
    (-6 * u ** 2 + 6 * u) * end.y;

  const ddy =
    (12 * u - 6) * start.y +
    (6 * u - 4) * tangent +
    (-12 * u + 6) * end.y;

  return {
    x: start.x + dx * u,
    y,

    angle: Math.atan2(dy, dx),

    curvature:
      dx * ddy /
      (dx ** 2 + dy ** 2) ** 1.5
  };
}

// Loop con radio local variable:
//
// radio(theta) = R * (1 + q * cos(theta))
//
// Con q = 0,5:
// - radio inferior: 1,5R
// - radio superior: 0,5R
// - altura: 2R
//
// La entrada y la salida son horizontales,
// pero se encuentran en posiciones diferentes.
function loopGeometry(segment, localDistance) {
  const radius = segment.radius;

  const normalized = Math.max(
    0,
    Math.min(TAU, localDistance / radius)
  );

  let theta = normalized;

  // Invertir:
  // s/R = theta + q * sin(theta)
  //
  // Su derivada siempre es positiva.
  for (let iteration = 0; iteration < 8; iteration++) {
    theta -=
      (
        theta +
        LOOP_SHAPE * Math.sin(theta) -
        normalized
      ) /
      (
        1 +
        LOOP_SHAPE * Math.cos(theta)
      );
  }

  const sin = Math.sin(theta);
  const cos = Math.cos(theta);

  return {
    x:
      segment.x +
      radius *
        (
          sin +
          LOOP_SHAPE *
            (
              theta / 2 +
              Math.sin(2 * theta) / 4
            )
        ),

    y:
      segment.y +
      radius *
        (
          1 -
          cos +
          LOOP_SHAPE * sin ** 2 / 2
        ),

    angle: theta,

    curvature:
      1 /
      (
        radius *
        (1 + LOOP_SHAPE * cos)
      ),

    section: segment.section
  };
}

export function getTrackInfo(input) {
  const config = resolveConfig(input);

  const key = JSON.stringify([
    config.mapId,
    config.initialHeight,
    config.trackLength,
    config.loopRadius,
    config.brakingLength,
    config.customPoints
  ]);

  if (cache.has(key)) {
    return cache.get(key);
  }

  const height = config.initialHeight;
  const width = config.trackLength;

  let nodes;

  if (config.mapId === "slope") {
    nodes = [
      { x: 0, y: height },
      { x: width * 0.65, y: 0 },
      { x: width, y: 0 }
    ];
  } else if (config.mapId === "valley") {
    nodes = [
      { x: 0, y: height },
      { x: width * 0.32, y: 0 },
      { x: width * 0.65, y: height * 0.45 },
      { x: width, y: 0 }
    ];
  } else if (config.mapId === "loop") {
    nodes = [
      {
        x: 0,
        y: height
      },
      {
        x: width * 0.28,
        y: 0
      },
      {
        x: width * 0.5,
        y: 0,
        loopRadius: config.loopRadius
      },
      {
        x: width * 0.72,
        y: 0
      },
      {
        x: width,
        y: 0
      }
    ];
  } else {
    nodes = config.customPoints.map(point => ({
      x: point.x * width,
      y: point.y * height,
      loopRadius: point.loopRadius
    }));
  }

  if (nodes[0].y <= nodes[1].y) {
    throw new Error(
      "El primer tramo debe descender para iniciar por gravedad."
    );
  }

  for (let index = 1; index < nodes.length; index++) {
    if (nodes[index].x <= nodes[index - 1].x) {
      throw new Error(
        "Los puntos deben avanzar horizontalmente."
      );
    }

    const radius = nodes[index].loopRadius || 0;

    if (radius && index < nodes.length - 1) {
      const available = Math.min(
        nodes[index].x - nodes[index - 1].x,
        nodes[index + 1].x - nodes[index].x
      );

      if (2 * radius > available) {
        throw new Error(
          `El loop del punto ${index + 1} necesita más ancho o un radio de referencia menor.`
        );
      }
    }
  }

  const segments = [];
  let totalLength = 0;

  function addSegment(segment) {
    segment.start = totalLength;

    totalLength += segment.length;

    segment.end = totalLength;
    segments.push(segment);
  }

  let previousExit = null;

  for (let index = 0; index < nodes.length - 1; index++) {
    const start = previousExit ?? nodes[index];
    const end = nodes[index + 1];

    previousExit = null;

    if (end.x <= start.x) {
      throw new Error(
        "No queda espacio entre la salida del loop y el siguiente punto."
      );
    }

    const slope =
      index === 0
        ? (end.y - start.y) / (end.x - start.x)
        : 0;

    const distances = [0];

    let previous = curve(
      start,
      end,
      0,
      slope
    );

    for (let sample = 1; sample <= SAMPLES; sample++) {
      const point = curve(
        start,
        end,
        sample / SAMPLES,
        slope
      );

      distances.push(
        distances[sample - 1] +
        Math.hypot(
          point.x - previous.x,
          point.y - previous.y
        )
      );

      previous = point;
    }

    const section =
      end.y > start.y
        ? "Subida"
        : end.y < start.y
          ? "Descenso / valle"
          : "Recta horizontal";

    addSegment({
      kind: "curve",
      a: start,
      b: end,
      slope,
      lut: distances,
      length: distances[SAMPLES],
      section
    });

    if (end.loopRadius) {
      const number =
        segments.filter(
          segment => segment.kind === "loop"
        ).length + 1;

      addSegment({
        kind: "loop",
        x: end.x,
        y: end.y,
        radius: end.loopRadius,
        length: TAU * end.loopRadius,
        section: `Loop ${number}`
      });

      // Continuar desde la salida real del loop.
      previousExit = {
        x:
          end.x +
          Math.PI *
            LOOP_SHAPE *
            end.loopRadius,

        y: end.y
      };
    }
  }

  const springStart = totalLength + 8;

  addSegment({
    kind: "flat",
    x: width,
    y: 0,
    length: 8,
    section: "Aproximación"
  });

  addSegment({
    kind: "flat",
    x: width + 8,
    y: 0,
    length: config.brakingLength,
    section: "Resorte"
  });

  const points = segments.flatMap(segment => {
    const divisions =
      segment.kind === "loop" ? 240 : 100;

    return Array.from(
      { length: divisions + 1 },
      (_, index) =>
        segmentGeometry(
          segment,
          segment.length * index / divisions
        )
    );
  });

  const track = {
    segments,
    nodes,
    springStart,
    totalLength,

    springX: width + 8,

    stationX:
      width + 8 + config.brakingLength,

    maxHeight: Math.max(
      ...points.map(point => point.y)
    ),

    minX: Math.min(
      0,
      ...points.map(point => point.x)
    ),

    points,

    loopShape: "variable",

    loopReference:
      "R inferior = 1,5R; R superior = 0,5R; altura = 2R"
  };

  if (cache.size >= 16) {
    cache.delete(
      cache.keys().next().value
    );
  }

  cache.set(key, track);

  return track;
}

function segmentGeometry(segment, localDistance) {
  if (segment.kind === "loop") {
    return loopGeometry(
      segment,
      localDistance
    );
  }

  if (segment.kind === "flat") {
    return {
      x: segment.x + localDistance,
      y: segment.y,
      angle: 0,
      curvature: 0,
      section: segment.section
    };
  }

  let low = 0;
  let high = SAMPLES;

  while (high - low > 1) {
    const middle = (low + high) >> 1;

    if (segment.lut[middle] < localDistance) {
      low = middle;
    } else {
      high = middle;
    }
  }

  const span =
    segment.lut[high] - segment.lut[low];

  const u =
    (
      low +
      (localDistance - segment.lut[low]) / span
    ) / SAMPLES;

  return {
    ...curve(
      segment.a,
      segment.b,
      u,
      segment.slope
    ),

    section: segment.section
  };
}

export function geometryAt(s, config, track) {
  if (s < 0) {
    const start = segmentGeometry(
      track.segments[0],
      0
    );

    return {
      ...start,

      x:
        start.x +
        s * Math.cos(start.angle),

      y:
        start.y +
        s * Math.sin(start.angle)
    };
  }

  const segment =
    track.segments.find(
      item => s < item.end
    ) ??
    track.segments[track.segments.length - 1];

  const result = segmentGeometry(
    segment,
    s - segment.start
  );

  if (
    config.brakeMode === "station" &&
    s >= track.springStart
  ) {
    return {
      ...result,
      section: "Frenado de estación"
    };
  }

  return result;
}

export function getTrackGeometry(s, input) {
  const config = resolveConfig(input);
  const track = getTrackInfo(config);

  return geometryAt(
    s,
    config,
    track
  );
}