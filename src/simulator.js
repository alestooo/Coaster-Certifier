import {
  DEFAULT_CONFIG,
  createInitialState,
  step,
} from "./physics/index.js";

import { renderSimulation } from "./ui/renderer.js";

const config = { ...DEFAULT_CONFIG };

const canvas = document.querySelector("#simulation");
const results = document.querySelector("#results");

let state = createInitialState(config);
let running = false;
let previousTime = null;
let accumulator = 0;

function draw() {
  renderSimulation(canvas, state, config);

  results.textContent = [
    `Estado: ${state.status}`,
    `Tiempo: ${state.time.toFixed(2)} s`,
    `Distancia: ${state.distance.toFixed(2)} m`,
    `Rapidez: ${state.speed.toFixed(2)} m/s`,
    `Normal: ${state.forces.normal.toFixed(2)} N`,
    `Energía cinética: ${state.energies.kinetic.toFixed(2)} J`,
    `Energía potencial: ${state.energies.gravitational.toFixed(2)} J`,
    `Energía mecánica: ${state.energies.mechanical.toFixed(2)} J`,
  ].join("\n");
}

document.querySelector("#start").addEventListener("click", () => {
  if (state.status === "running") {
    running = true;
    previousTime = null;
  }
});

document.querySelector("#pause").addEventListener("click", () => {
  running = false;
  previousTime = null;
});

document.querySelector("#reset").addEventListener("click", () => {
  state = createInitialState(config);
  running = false;
  accumulator = 0;
  previousTime = null;
  draw();
});

function animate(timestamp) {
  const elapsed =
    previousTime === null
      ? 0
      : Math.min((timestamp - previousTime) / 1000, 0.1);

  previousTime = timestamp;

  if (running) {
    accumulator += elapsed;

    while (accumulator >= config.timeStep) {
      state = step(state, config, config.timeStep);
      accumulator -= config.timeStep;

      if (state.status !== "running") {
        running = false;
        accumulator = 0;
        break;
      }
    }

    draw();
  }

  requestAnimationFrame(animate);
}

draw();
requestAnimationFrame(animate);