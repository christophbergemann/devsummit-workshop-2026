import type { Scene } from "@babylonjs/core/scene";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

/**
 * Base class for anything that lives in the world and has a per-frame update.
 * Concrete entities (cars, powerups, ...) extend this. Keeping entities thin
 * and composable keeps the architecture extensible.
 */
export abstract class Entity {
  /** Root transform node — all visuals should be parented to this. */
  abstract readonly root: TransformNode;

  protected disposed = false;

  constructor(protected readonly scene: Scene) {}

  /** Per-frame update. `dt` is seconds since last frame. */
  abstract update(dt: number): void;

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.dispose(false, true);
  }

  get isDisposed(): boolean {
    return this.disposed;
  }
}
