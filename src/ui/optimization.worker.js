import { optimizeDesign } from "../physics/index.js";

self.onmessage = event => {
  try {
    const search = optimizeDesign(event.data.config, event.data.options);
    let step = search.next();

    while (!step.done) {
      self.postMessage({ type: "progress", value: step.value });
      step = search.next();
    }

    self.postMessage({ type: "done", value: step.value });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "No se pudo optimizar el diseño." });
  }
};
