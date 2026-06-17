import { Scene } from "@babylonjs/core/scene";
import { System } from "../core/System";
import type { CarControls } from "../entities/Car";

/**
 * Reads keyboard (and basic touch) input and writes into a player car's
 * control struct each frame. Decoupled from the car so we can later swap in a
 * gamepad/replay/network source without changing the car.
 */
export class InputSystem extends System {
  private readonly keys = new Set<string>();
  private touchSteer = 0;
  private touchThrottle = 0;
  private touchBoost = false;

  private readonly onDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Space",
      ].includes(e.code)
    ) {
      e.preventDefault();
    }
  };
  private readonly onUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  constructor(scene: Scene, private readonly target: CarControls) {
    super(scene);
  }

  override init(): void {
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    this.setupTouch();
  }

  private setupTouch(): void {
    const canvas = this.scene.getEngine().getRenderingCanvas();
    if (!canvas) return;
    const updateFromTouch = (e: TouchEvent) => {
      this.touchSteer = 0;
      this.touchThrottle = 0;
      this.touchBoost = false;
      const w = window.innerWidth;
      const h = window.innerHeight;
      for (const t of Array.from(e.touches)) {
        if (t.clientX < w * 0.4) {
          this.touchSteer = t.clientX < w * 0.2 ? -1 : 1;
        } else if (t.clientX > w * 0.6) {
          this.touchThrottle = t.clientY < h * 0.5 ? 1 : -1;
          this.touchBoost = t.clientY < h * 0.25;
        }
      }
    };
    canvas.addEventListener("touchstart", updateFromTouch);
    canvas.addEventListener("touchmove", updateFromTouch);
    canvas.addEventListener("touchend", () => {
      this.touchSteer = 0;
      this.touchThrottle = 0;
      this.touchBoost = false;
    });
  }

  update(_dt: number): void {
    const up = this.keys.has("ArrowUp") || this.keys.has("KeyW");
    const down = this.keys.has("ArrowDown") || this.keys.has("KeyS");
    const left = this.keys.has("ArrowLeft") || this.keys.has("KeyA");
    const right = this.keys.has("ArrowRight") || this.keys.has("KeyD");
    const boost = this.keys.has("Space") || this.keys.has("ShiftLeft");

    this.target.throttle = (up ? 1 : 0) - (down ? 1 : 0) + this.touchThrottle;
    this.target.steer = (right ? 1 : 0) - (left ? 1 : 0) + this.touchSteer;
    this.target.throttle = Math.max(-1, Math.min(1, this.target.throttle));
    this.target.steer = Math.max(-1, Math.min(1, this.target.steer));
    this.target.boost = boost || this.touchBoost;
  }

  override dispose(): void {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
  }
}
