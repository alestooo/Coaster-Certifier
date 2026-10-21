import Chart from "chart.js/auto";

const definitions = {
  speed: {
    title: "Rapidez (m/s)",

    series: [
      [
        "Rapidez",
        state => state.speed,
        "#8050cf"
      ]
    ]
  },

  energy: {
    title: "Energía (J)",

    series: [
      [
        "Cinética",
        state => state.energies.kinetic,
        "#d49927"
      ],
      [
        "Gravitatoria",
        state => state.energies.gravitational,
        "#368bc0"
      ],
      [
        "Elástica",
        state => state.energies.elastic,
        "#9b65bb"
      ],
      [
        "Mecánica",
        state => state.energies.mechanical,
        "#39936b"
      ],
      [
        "Disipada",
        state => state.energies.dissipated,
        "#cf737b"
      ]
    ]
  },

  normal: {
    title: "Fuerza normal (N)",

    series: [
      [
        "Normal",
        state => state.forces.normal,
        "#8050cf"
      ],
      [
        "Cero",
        () => 0,
        "#ba6d77"
      ]
    ]
  },

  acceleration: {
    title: "Aceleración (m/s²)",

    series: [
      [
        "Tangencial",
        state => state.tangentialAcceleration,
        "#8050cf"
      ],
      [
        "Normal con signo",
        state => state.normalAcceleration,
        "#39936b"
      ]
    ]
  },

  load: {
    title: "Carga normal (g)",

    series: [
      [
        "N / (mg)",
        state => state.load,
        "#8050cf"
      ],
      [
        "Referencia −1 g",
        () => -1,
        "#ba6d77"
      ],
      [
        "Referencia +5 g",
        () => 5,
        "#ba6d77"
      ]
    ]
  },

  spring: {
    title: "Energía elástica (J)",

    series: [
      [
        "Resorte",
        state => state.energies.elastic,
        "#8050cf"
      ]
    ]
  }
};

export function createPhysicsChart(canvas) {
  return new Chart(canvas, {
    type: "line",

    data: {
      datasets: []
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,
      normalized: true,

      elements: {
        point: {
          radius: 0
        },

        line: {
          borderWidth: 2
        }
      },

      scales: {
        x: {
          type: "linear",

          title: {
            display: true,
            text: "Tiempo (s)"
          }
        },

        y: {
          title: {
            display: true,
            text: ""
          }
        }
      },

      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

export function updatePhysicsChart(
  chart,
  states,
  kind = "speed"
) {
  const definition =
    definitions[kind] ?? definitions.speed;

  chart.data.datasets =
    definition.series.map(
      ([label, read, color]) => ({
        label,

        borderColor: color,

        data: states.map(state => ({
          x: state.time,
          y: read(state)
        })),

        borderDash:
          label.startsWith("Referencia") ||
          label === "Cero"
            ? [5, 5]
            : []
      })
    );

  chart.options.scales.y.title.text =
    definition.title;

  chart.update("none");
}