import { Game } from "./core/Game";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
if (!canvas) throw new Error("renderCanvas element not found");

const game = new Game(canvas);
void game.start();
