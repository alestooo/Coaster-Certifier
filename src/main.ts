import { mount } from "svelte";
import App from "./App.svelte";
import "./app.css";
import "./styles/shared.css";
import "./styles/setup.css";
import "./styles/passengers.css";
import "./styles/simulation.css";
import "./styles/credits.css";

const target = document.getElementById("app");

if (!target) {
  throw new Error("No se encontró el contenedor #app.");
}

export default mount(App, { target });