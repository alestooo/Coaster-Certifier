import { recommendationSearch } from "../physics/index.js";

self.onmessage = event => {
  try {
    const search = recommendationSearch(event.data.config);
    let result = search.next();

    while (!result.done) {
      self.postMessage({ type: "progress", ...result.value });
      result = search.next();
    }

    self.postMessage({ type: "done", ...result.value });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "No se pudo revisar la configuración."
    });
  }
};
