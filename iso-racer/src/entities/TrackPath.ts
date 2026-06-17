import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Curve3 } from "@babylonjs/core/Maths/math.path";

/**
 * Geometric description of the racing line as a closed Catmull-Rom spline.
 * This is data-only: it knows nothing about rendering. The {@link Track}
 * builds visuals from it, the AI and race logic query it for positions and
 * progress. Swap the control points to make a new circuit.
 */
export class TrackPath {
  readonly points: Vector3[];
  readonly tangents: Vector3[];
  readonly totalLength: number;
  private readonly cumulative: number[];

  constructor(controlPoints: Vector3[], samplesPerSegment = 24) {
    const curve = Curve3.CreateCatmullRomSpline(
      controlPoints,
      samplesPerSegment,
      true // closed loop
    );
    this.points = curve.getPoints();

    // Precompute tangents + cumulative arc length for fast lookups.
    this.tangents = [];
    this.cumulative = [0];
    let len = 0;
    for (let i = 0; i < this.points.length; i++) {
      const a = this.points[i];
      const b = this.points[(i + 1) % this.points.length];
      const seg = b.subtract(a);
      this.tangents.push(seg.normalizeToNew());
      len += seg.length();
      this.cumulative.push(len);
    }
    this.totalLength = len;
  }

  get count(): number {
    return this.points.length;
  }

  /** Point at a sample index (wraps). */
  pointAt(index: number): Vector3 {
    return this.points[((index % this.count) + this.count) % this.count];
  }

  tangentAt(index: number): Vector3 {
    return this.tangents[((index % this.count) + this.count) % this.count];
  }

  /**
   * Find the index of the nearest path sample to a world position, searching
   * near a hint index for performance.
   */
  nearestIndex(pos: Vector3, hint = 0, window = 12): number {
    let best = hint;
    let bestDist = Infinity;
    for (let o = -window; o <= window; o++) {
      const i = ((hint + o) % this.count + this.count) % this.count;
      const d = Vector3.DistanceSquared(this.points[i], pos);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  /** Normalized progress [0,1) for a sample index. */
  progressAt(index: number): number {
    return this.cumulative[index] / this.totalLength;
  }
}
