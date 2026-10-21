import {
  recommendationSearch
} from "../physics/recommendations.js";

self.onmessage = event => {
  try {
    const search = recommendationSearch(
      event.data.config,
      event.data.state
    );

    let result = search.next();

    while (!result.done) {
      self.postMessage({
        type: "progress",
        ...result.value
      });

      result = search.next();
    }

    self.postMessage({
      type: "done",
      ...result.value
    });
  } catch (error) {
    self.postMessage({
      type: "error",

      message:
        error instanceof Error
          ? error.message
          : "No se pudo revisar la configuración."
    });
  }
};