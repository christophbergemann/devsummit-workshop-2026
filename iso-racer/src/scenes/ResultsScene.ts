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

/** Post-race standings screen with a rematch button. */
export class ResultsScene implements IScene {
  readonly scene: Scene;
  private ui!: AdvancedDynamicTexture;

  constructor(private readonly manager: SceneManager) {
    this.scene = new Scene(manager.engine);
    this.scene.clearColor = new Color4(0.04, 0.04, 0.08, 1);
    const cam = new FreeCamera("resCam", new Vector3(0, 0, -10), this.scene);
    cam.setTarget(Vector3.Zero());
  }

  start(): void {
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("results", true, this.scene);
    const panel = new StackPanel();
    panel.spacing = 10;
    this.ui.addControl(panel);

    const title = new TextBlock();
    title.text = "RESULTS";
    title.color = "#ffd84a";
    title.fontSize = 72;
    title.fontWeight = "800";
    title.height = "100px";
    panel.addControl(title);

    const standings = window.__lastRaceResult ?? [];
    standings.forEach((s) => {
      const row = new TextBlock();
      const time =
        s.finishTime > 0 ? `${s.finishTime.toFixed(2)}s` : "DNF";
      const medal = s.position === 1 ? "🏆 " : `${s.position}. `;
      row.text = `${medal}${s.car.name.padEnd(10)} ${time}`;
      row.color = s.car.isPlayer ? "#4af" : "#ccd";
      row.fontSize = 30;
      row.fontWeight = s.car.isPlayer ? "800" : "500";
      row.height = "44px";
      panel.addControl(row);
    });

    const btn = Button.CreateSimpleButton("again", "↻  RACE AGAIN");
    btn.width = "300px";
    btn.height = "64px";
    btn.color = "#fff";
    btn.fontSize = 26;
    btn.fontWeight = "700";
    btn.background = "#2a6df0";
    btn.cornerRadius = 12;
    btn.thickness = 0;
    btn.paddingTop = "24px";
    btn.onPointerClickObservable.add(() => {
      void this.manager.switchTo("race");
    });
    panel.addControl(btn);

    const menuBtn = Button.CreateSimpleButton("menu", "MAIN MENU");
    menuBtn.width = "300px";
    menuBtn.height = "50px";
    menuBtn.color = "#aab";
    menuBtn.fontSize = 20;
    menuBtn.background = "transparent";
    menuBtn.thickness = 0;
    menuBtn.onPointerClickObservable.add(() => {
      void this.manager.switchTo("menu");
    });
    panel.addControl(menuBtn);
  }

  update(_dt: number): void {}

  dispose(): void {
    this.ui?.dispose();
  }
}
