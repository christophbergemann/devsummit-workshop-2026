import type { Scene } from "@babylonjs/core/scene";

/**
 * A System encapsulates a slice of game logic that runs every frame
 * (input handling, AI, race rules, powerups, ...). Systems are owned by a
 * scene and updated in registration order. Add new behaviour by writing a new
 * System rather than bloating entities.
 */
export abstract class System {
  constructor(protected readonly scene: Scene) {}

  /** Called once when the owning scene starts. */
  init(): void {}

  /** Per-frame update. `dt` is seconds since last frame. */
  abstract update(dt: number): void;

  /** Cleanup. */
  dispose(): void {}
}
