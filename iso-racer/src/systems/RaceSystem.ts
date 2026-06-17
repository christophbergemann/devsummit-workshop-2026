import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { System } from "../core/System";
import type { Car } from "../entities/Car";
import type { Track } from "../entities/Track";
import { Config } from "../utils/Config";

export type RacePhase = "countdown" | "racing" | "finished";

export interface RaceStanding {
  car: Car;
  lap: number;
  progress: number; // continuous progress = lap + fractional path position
  position: number; // 1-based
  finishTime: number;
}

/**
 * Owns the race rules: countdown, checkpoint validation, lap counting, live
 * standings and finish detection. It mutates each car's lap/checkpoint fields
 * and exposes standings for the HUD.
 */
export class RaceSystem extends System {
  phase: RacePhase = "countdown";
  countdown = Config.race.countdownSeconds + 1;
  elapsed = 0;
  standings: RaceStanding[] = [];

  private readonly checkpointRadiusSq = 9 * 9;

  constructor(
    scene: Scene,
    private readonly track: Track,
    private readonly cars: Car[]
  ) {
    super(scene);
  }

  get player(): Car | undefined {
    return this.cars.find((c) => c.isPlayer);
  }

  get racingActive(): boolean {
    return this.phase === "racing";
  }

  update(dt: number): void {
    if (this.phase === "countdown") {
      this.countdown -= dt;
      if (this.countdown <= 0) this.phase = "racing";
      this.updateStandings();
      return;
    }

    if (this.phase === "racing") {
      this.elapsed += dt;
      for (const car of this.cars) {
        if (!car.finished) this.checkProgress(car);
      }
      this.updateStandings();

      if (this.cars.every((c) => c.finished)) {
        this.phase = "finished";
      } else if (this.player?.finished) {
        // Let the player see results shortly after finishing.
        this.phase = "finished";
      }
    }
  }

  private checkProgress(car: Car): void {
    const cps = this.track.checkpoints;
    const target = cps[car.nextCheckpoint];
    const dSq = Vector3.DistanceSquared(car.root.position, target.position);
    if (dSq < this.checkpointRadiusSq) {
      car.nextCheckpoint++;
      if (car.nextCheckpoint >= cps.length) {
        car.nextCheckpoint = 0;
        car.lap++;
        if (car.lap >= Config.race.totalLaps) {
          car.finished = true;
          car.finishTime = this.elapsed;
        }
      }
    }
  }

  private continuousProgress(car: Car): number {
    const cpCount = this.track.checkpoints.length;
    return car.lap + car.nextCheckpoint / cpCount;
  }

  private updateStandings(): void {
    this.standings = this.cars
      .map((car) => ({
        car,
        lap: car.lap,
        progress: car.finished
          ? Number.MAX_SAFE_INTEGER - car.finishTime
          : this.continuousProgress(car),
        position: 0,
        finishTime: car.finishTime,
      }))
      .sort((a, b) => b.progress - a.progress);

    this.standings.forEach((s, i) => (s.position = i + 1));
  }
}
