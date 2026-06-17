import { Scene } from "@babylonjs/core/scene";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import type { IScene } from "../core/IScene";
import type { SceneManager } from "../core/SceneManager";

/** Title screen with start button and controls help. */
export class MenuScene implements IScene {
  readonly scene: Scene;
  private ui!: AdvancedDynamicTexture;

  constructor(private readonly manager: SceneManager) {
    this.scene = new Scene(manager.engine);
    this.scene.clearColor = new Color4(0.04, 0.04, 0.08, 1);
    const cam = new FreeCamera("menuCam", new Vector3(0, 0, -10), this.scene);
    cam.setTarget(Vector3.Zero());
  }

  start(): void {
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("menu", true, this.scene);

    const panel = new StackPanel();
    panel.spacing = 16;
    this.ui.addControl(panel);

    const title = new TextBlock();
    title.text = "ISO RACER";
    title.color = "#4af";
    title.fontSize = 96;
    title.fontWeight = "800";
    title.height = "140px";
    title.shadowColor = "#08f";
    title.shadowBlur = 30;
    panel.addControl(title);

    const sub = new TextBlock();
    sub.text = "ARCADE ISOMETRIC RACING";
    sub.color = "#88a";
    sub.fontSize = 22;
    sub.height = "40px";
    sub.fontWeight = "600";
    panel.addControl(sub);

    const btn = Button.CreateSimpleButton("play", "▶  RACE");
    btn.width = "260px";
    btn.height = "70px";
    btn.color = "#fff";
    btn.fontSize = 30;
    btn.fontWeight = "700";
    btn.background = "#2a6df0";
    btn.cornerRadius = 12;
    btn.thickness = 0;
    btn.paddingTop = "20px";
    btn.onPointerEnterObservable.add(() => (btn.background = "#3f86ff"));
    btn.onPointerOutObservable.add(() => (btn.background = "#2a6df0"));
    btn.onPointerClickObservable.add(() => {
      void this.manager.switchTo("race");
    });
    panel.addControl(btn);

    const help = new TextBlock();
    help.text =
      "WASD / Arrows to drive   •   SPACE to boost\nCollect glowing pickups for boost charges";
    help.color = "#667";
    help.fontSize = 18;
    help.height = "70px";
    help.paddingTop = "30px";
    panel.addControl(help);

    // Allow Enter / Space to start as well.
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "Space") {
        window.removeEventListener("keydown", onKey);
        void this.manager.switchTo("race");
      }
    };
    window.addEventListener("keydown", onKey);

    this.hideLoader();
  }

  private hideLoader(): void {
    const loader = document.getElementById("loading");
    if (loader) {
      loader.style.opacity = "0";
      setTimeout(() => loader.remove(), 600);
    }
  }

  update(_dt: number): void {}

  dispose(): void {
    this.ui?.dispose();
  }
}

declare global {
  interface Window {
    __lastRaceResult?: import("../systems/RaceSystem").RaceStanding[];
  }
}
