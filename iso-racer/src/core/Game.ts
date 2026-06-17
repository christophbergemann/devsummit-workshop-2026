import { Engine } from "@babylonjs/core/Engines/engine";
import { SceneManager } from "./SceneManager";
import { MenuScene } from "../scenes/MenuScene";
import { RaceScene } from "../scenes/RaceScene";
import { ResultsScene } from "../scenes/ResultsScene";

/**
 * Top-level application object. Boots the Babylon engine, wires up the
 * {@link SceneManager} with all available scenes and drives the main loop.
 */
export class Game {
  readonly engine: Engine;
  readonly scenes: SceneManager;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
      adaptToDeviceRatio: true,
    });

    this.scenes = new SceneManager(this.engine)
      .register("menu", (m) => new MenuScene(m))
      .register("race", (m) => new RaceScene(m))
      .register("results", (m) => new ResultsScene(m));

    window.addEventListener("resize", () => this.engine.resize());
  }

  async start(): Promise<void> {
    await this.scenes.switchTo("menu");

    this.engine.runRenderLoop(() => {
      const dt = this.engine.getDeltaTime() / 1000;
      this.scenes.update(dt);
      this.scenes.active?.scene.render();
    });
  }
}
