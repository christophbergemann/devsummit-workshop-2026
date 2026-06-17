import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { System } from "../core/System";
import type { Car } from "../entities/Car";
import type { Track } from "../entities/Track";
import { angleDelta, clamp, randRange } from "../utils/math";

/**
 * Drives every non-player car by steering toward a look-ahead point on the
 * racing line and modulating throttle by how sharp the upcoming turn is. Each
 * AI gets a small random skill/aggression profile so the field spreads out.
 */
export class AISystem extends System {
  private profiles = new Map<Car, { skill: number; boostBias: number }>();

  constructor(
    scene: Scene,
    private readonly track: Track,
    private readonly cars: Car[],
    private readonly active: () => boolean
  ) {
    super(scene);
  }

  override init(): void {
    for (const car of this.cars) {
      this.profiles.set(car, {
        skill: randRange(0.85, 1.0),
        boostBias: randRange(0.2, 0.8),
      });
    }
  }

  update(dt: number): void {
    if (!this.active()) {
      for (const car of this.cars) {
        car.controls.throttle = 0;
        car.controls.steer = 0;
        car.controls.boost = false;
      }
      return;
    }

    for (const car of this.cars) {
      if (car.finished) continue;
      const prof = this.profiles.get(car)!;

      const nearIdx = this.track.path.nearestIndex(
        car.root.position,
        car.pathHint,
        16
      );
      car.pathHint = nearIdx;

      const aheadIdx = nearIdx + 6;
      const aim = this.track.path.pointAt(aheadIdx);
      const toAim = aim.subtract(car.root.position);
      const desiredHeading = Math.atan2(toAim.x, toAim.z);
      const delta = angleDelta(car.heading, desiredHeading);

      car.controls.steer = clamp(delta * 2.2, -1, 1);

      // Slow into sharp corners by comparing tangents ahead.
      const t1 = this.track.path.tangentAt(nearIdx);
      const t2 = this.track.path.tangentAt(nearIdx + 8);
      const turnSharpness = 1 - clamp(Vector3.Dot(t1, t2), 0, 1);
      const throttle = clamp(1 - turnSharpness * 1.6, 0.45, 1) * prof.skill;
      car.controls.throttle = throttle;

      // Use boost on straights.
      car.controls.boost =
        car.charges > 0 && turnSharpness < 0.05 && Math.random() < prof.boostBias * dt * 4;
    }
  }
}
