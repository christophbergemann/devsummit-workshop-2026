import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { System } from "../core/System";
import type { Car } from "../entities/Car";
import type { Track } from "../entities/Track";
import { Powerup, type PowerupKind } from "../entities/Powerup";

/**
 * Spawns pickups around the track and resolves car<->powerup collisions each
 * frame. Effects are applied here so adding a new powerup kind only touches
 * this system + the Powerup entity.
 */
export class PowerupSystem extends System {
  readonly powerups: Powerup[] = [];

  constructor(
    scene: Scene,
    private readonly track: Track,
    private readonly cars: Car[]
  ) {
    super(scene);
  }

  override init(): void {
    const n = this.track.path.points.length;
    const kinds: PowerupKind[] = ["boost", "boost", "shield", "oil"];
    const count = 10;
    for (let i = 0; i < count; i++) {
      const idx = Math.floor((i / count) * n) + 4;
      const base = this.track.path.pointAt(idx);
      const t = this.track.path.tangentAt(idx);
      const right = Vector3.Cross(Vector3.Up(), t).normalize();
      const lateral = (Math.random() - 0.5) * this.track.width * 0.5;
      const pos = base.add(right.scale(lateral));
      const kind = kinds[i % kinds.length];
      this.powerups.push(new Powerup(this.scene, pos, kind));
    }
  }

  update(dt: number): void {
    for (const pu of this.powerups) pu.update(dt);

    const rSq = (Powerup.RADIUS + 0.9) ** 2;
    for (const car of this.cars) {
      if (car.finished) continue;
      for (const pu of this.powerups) {
        if (!pu.active) continue;
        const dSq = Vector3.DistanceSquared(
          car.root.position,
          pu.root.position
        );
        if (dSq < rSq) {
          this.applyEffect(car, pu);
          pu.collect();
        }
      }
    }
  }

  private applyEffect(car: Car, pu: Powerup): void {
    switch (pu.kind) {
      case "boost":
        car.addBoostCharge();
        break;
      case "shield":
        // Shield grants a small instant speed bump (placeholder effect).
        car.speed = Math.min(car.speed + 4, 30);
        break;
      case "oil":
        // Oil slick: a free boost charge but represents a chaotic pickup.
        car.addBoostCharge();
        break;
    }
  }

  override dispose(): void {
    for (const pu of this.powerups) pu.dispose();
  }
}
