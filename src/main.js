import "./ui/styles.css";
import "./ui/menu.css";

const menuScreen = document.querySelector("#menu-screen");
const gameScreen = document.querySelector("#game-screen");
const playButton = document.querySelector("#play-button");
const backButton = document.querySelector("#back-button");
const creditsButton = document.querySelector("#credits-button");
const creditsDialog = document.querySelector("#credits-dialog");

let simulatorLoaded = false;

playButton.addEventListener("click", async () => {
  playButton.disabled = true;

  menuScreen.hidden = true;
  gameScreen.hidden = false;

  try {
    if (!simulatorLoaded) {
      await import("./simulator.js");
      simulatorLoaded = true;
    }

    document.querySelector("#game-title").focus();
  } catch (error) {
    console.error("No se pudo abrir el simulador:", error);

    gameScreen.hidden = true;
    menuScreen.hidden = false;

    alert("No se pudo abrir el simulador. Revisá la consola del navegador.");
    playButton.focus();
  } finally {
    playButton.disabled = false;
  }
});

backButton.addEventListener("click", () => {
  document.querySelector("#pause").click();

  gameScreen.hidden = true;
  menuScreen.hidden = false;

  playButton.focus();
});

creditsButton.addEventListener("click", () => {
  creditsDialog.showModal();
});

creditsDialog.addEventListener("close", () => {
  creditsButton.focus();
});