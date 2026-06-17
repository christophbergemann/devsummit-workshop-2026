import type { Engine } from "@babylonjs/core/Engines/engine";
import type { IScene, SceneKey } from "./IScene";

/** Factory that lazily builds a scene. */
export type SceneFactory = (manager: SceneManager) => IScene;

/**
 * Owns the active scene and orchestrates transitions between registered scene
 * factories. Only one scene is active at a time; switching disposes the
 * previous one. This is the single extension point for adding new screens.
 */
export class SceneManager {
  private readonly factories = new Map<SceneKey, SceneFactory>();
  private current: IScene | null = null;
  private currentKey: SceneKey | null = null;

  constructor(public readonly engine: Engine) {}

  /** Register a scene factory under a key. */
  register(key: SceneKey, factory: SceneFactory): this {
    this.factories.set(key, factory);
    return this;
  }

  /** Dispose the current scene and activate the one registered under `key`. */
  async switchTo(key: SceneKey): Promise<void> {
    const factory = this.factories.get(key);
    if (!factory) throw new Error(`No scene registered for key "${key}"`);

    if (this.current) {
      this.current.dispose();
      this.current.scene.dispose();
      this.current = null;
    }

    const scene = factory(this);
    this.current = scene;
    this.currentKey = key;
    await scene.start();
  }

  get active(): IScene | null {
    return this.current;
  }

  get activeKey(): SceneKey | null {
    return this.currentKey;
  }

  update(dt: number): void {
    this.current?.update(dt);
  }
}
