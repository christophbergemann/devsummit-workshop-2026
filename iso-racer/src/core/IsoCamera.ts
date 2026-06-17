import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Config } from "../utils/Config";

/**
 * An orthographic-feel isometric follow camera. We use an ArcRotateCamera at a
 * fixed alpha/beta to get the classic 3/4 isometric look, and switch it to an
 * orthographic projection so there is no perspective distortion across the
 * track. It smoothly tracks a target each frame.
 */
export class IsoCamera {
  readonly camera: ArcRotateCamera;
  private readonly target = new Vector3(0, 0, 0);

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.camera = new ArcRotateCamera(
      "isoCam",
      Config.camera.alpha,
      Config.camera.beta,
      Config.camera.radius,
      Vector3.Zero(),
      scene
    );

    // Orthographic projection => true isometric (no perspective).
    this.camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;
    this.applyOrthoSize(canvas, 22);

    // Lock the camera — it follows, the player doesn't orbit it.
    this.camera.inputs.clear();
    this.camera.minZ = 0.1;
    this.camera.maxZ = 400;

    scene.onBeforeRenderObservable.add(() => this.applyOrthoSize(canvas, 22));
  }

  /** Keep the orthographic frustum proportional to the canvas aspect ratio. */
  private applyOrthoSize(canvas: HTMLCanvasElement, halfHeight: number): void {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    this.camera.orthoTop = halfHeight;
    this.camera.orthoBottom = -halfHeight;
    this.camera.orthoLeft = -halfHeight * aspect;
    this.camera.orthoRight = halfHeight * aspect;
  }

  /** Smoothly follow a world position. */
  follow(position: Vector3): void {
    this.target.x += (position.x - this.target.x) * Config.camera.lerp;
    this.target.y +=
      (position.y + Config.camera.heightOffset - this.target.y) *
      Config.camera.lerp;
    this.target.z += (position.z - this.target.z) * Config.camera.lerp;
    this.camera.setTarget(this.target);
  }
}
