import type { Scene } from "@babylonjs/core/scene";

/**
 * Contract every game scene must implement. Scenes are managed by the
 * {@link SceneManager} and represent a distinct screen / mode of the game
 * (menu, race, results, ...). Keeping this as an interface lets us add new
 * scenes without touching the manager.
 */
export interface IScene {
  /** The underlying Babylon.js scene. */
  readonly scene: Scene;

  /** Called once when the scene becomes active. */
  start(): void | Promise<void>;

  /** Called every frame with delta time in seconds. */
  update(dt: number): void;

  /** Called when the scene is being torn down. Dispose resources here. */
  dispose(): void;
}

/** Identifiers used to request scene switches. */
export type SceneKey = "menu" | "race" | "results";
