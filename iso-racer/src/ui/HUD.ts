import { Scene } from "@babylonjs/core/scene";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { Control } from "@babylonjs/gui/2D/controls/control";
import type { RaceSystem } from "../systems/RaceSystem";
import type { Car } from "../entities/Car";
import { Config } from "../utils/Config";

/**
 * Full-screen 2D overlay showing speed, lap, position, boost charges and the
 * countdown. Reads from the {@link RaceSystem} each frame; holds no game state.
 */
export class HUD {
  private readonly ui: AdvancedDynamicTexture;
  private readonly speedText: TextBlock;
  private readonly lapText: TextBlock;
  private readonly posText: TextBlock;
  private readonly boostText: TextBlock;
  private readonly bigText: TextBlock;

  constructor(scene: Scene, private readonly race: RaceSystem) {
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("hud", true, scene);

    // Top-left: lap + position panel
    const panel = new StackPanel();
    panel.width = "240px";
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.paddingLeft = "16px";
    panel.paddingTop = "16px";
    this.ui.addControl(panel);

    this.posText = this.makeLabel("P1", 34, "#ffd84a");
    this.lapText = this.makeLabel("LAP 1/3", 22, "#ffffff");
    panel.addControl(this.posText);
    panel.addControl(this.lapText);

    // Bottom-right: speed + boost
    const speedPanel = new StackPanel();
    speedPanel.width = "220px";
    speedPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    speedPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    speedPanel.paddingRight = "20px";
    speedPanel.paddingBottom = "20px";
    this.ui.addControl(speedPanel);

    this.speedText = this.makeLabel("0", 46, "#4af");
    this.speedText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.boostText = this.makeLabel("BOOST: ---", 20, "#ffae3a");
    this.boostText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    speedPanel.addControl(this.speedText);
    speedPanel.addControl(this.boostText);

    // Center big text (countdown / status)
    const bg = new Rectangle();
    bg.thickness = 0;
    bg.background = "transparent";
    this.ui.addControl(bg);
    this.bigText = this.makeLabel("", 120, "#ffffff");
    this.bigText.outlineColor = "#000";
    this.bigText.outlineWidth = 6;
    bg.addControl(this.bigText);
  }

  private makeLabel(text: string, size: number, color: string): TextBlock {
    const t = new TextBlock();
    t.text = text;
    t.color = color;
    t.fontSize = size;
    t.fontFamily = "Segoe UI, sans-serif";
    t.fontWeight = "700";
    t.height = `${size + 8}px`;
    t.shadowColor = "#000";
    t.shadowBlur = 4;
    t.shadowOffsetX = 2;
    t.shadowOffsetY = 2;
    return t;
  }

  update(player: Car | undefined): void {
    if (!player) return;

    // Speed (km/h-ish arcade number)
    this.speedText.text = `${Math.round(Math.abs(player.speed) * 7)}`;

    // Lap
    const lap = Math.min(player.lap + 1, Config.race.totalLaps);
    this.lapText.text = `LAP ${lap}/${Config.race.totalLaps}`;

    // Position
    const standing = this.race.standings.find((s) => s.car === player);
    if (standing) {
      const total = this.race.standings.length;
      this.posText.text = `P${standing.position}/${total}`;
    }

    // Boost charges
    const charges = "▮".repeat(player.charges) + "▯".repeat(3 - player.charges);
    this.boostText.text = player.isBoosting ? "BOOSTING!" : `BOOST ${charges}`;
    this.boostText.color = player.isBoosting ? "#fff14a" : "#ffae3a";

    // Big center text
    if (this.race.phase === "countdown") {
      const n = Math.ceil(this.race.countdown - 1);
      this.bigText.text = n > 0 ? `${n}` : "GO!";
      this.bigText.color = n > 0 ? "#ffffff" : "#4aff6a";
    } else {
      this.bigText.text = "";
    }
  }

  dispose(): void {
    this.ui.dispose();
  }
}
